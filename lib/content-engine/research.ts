/**
 * Content Engine — keyword research via SerpAPI (primary) + Apify (fallback).
 *
 * Stage 1 of the pipeline (spec §2.1): weekly `scheduled_tasks` job per
 * owner fetches SERP data for seed keywords, scores rankability, runs
 * content-gap analysis on top 3 results, and queues topics with outlines.
 *
 * SerpAPI is primary (fast, cheap). Apify Google Search Scraper is the
 * automatic fallback when SerpAPI returns 5xx. Both keys are sourced from
 * `integration_connections` or env vars via `getCredential()`.
 *
 * Emits progress events via `emitResearchProgress()` for the admin SSE
 * stream so the UI can show per-keyword stage updates.
 *
 * Owner: CE-2. Consumer: `content_keyword_research` scheduled-task handler.
 */
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentTopics } from "@/lib/db/schema/content-topics";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { getCredential } from "@/lib/integrations/getCredential";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import { APIFY_API_BASE } from "@/lib/integrations/vendors/apify";
import { scoreKeywordRankability } from "./rankability";
import { generateTopicOutline } from "./topic-queue";
import { emitResearchProgress } from "./research-progress";
import { randomUUID } from "node:crypto";

export interface SerpResult {
  position: number;
  title: string;
  link: string;
  domain: string;
  snippet: string;
}

export interface SerpSnapshot {
  keyword: string;
  results: SerpResult[];
  searchedAt: number;
  source: "serpapi" | "apify";
}

/**
 * Fetch organic SERP results for a keyword via SerpAPI.
 */
async function fetchSerpApiResults(
  keyword: string,
  apiKey: string,
  location?: string,
): Promise<SerpSnapshot> {
  const params = new URLSearchParams({
    q: keyword,
    api_key: apiKey,
    engine: "google",
    num: "10",
  });
  if (location) params.set("location", location);

  const response = await fetch(
    `${SERPAPI_API_BASE}/search.json?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(
      `SerpAPI ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    organic_results?: Array<{
      position: number;
      title: string;
      link: string;
      snippet?: string;
    }>;
  };

  return {
    keyword,
    results: (data.organic_results ?? []).slice(0, 10).map((r) => ({
      position: r.position,
      title: r.title,
      link: r.link,
      domain: extractDomain(r.link),
      snippet: r.snippet ?? "",
    })),
    searchedAt: Date.now(),
    source: "serpapi",
  };
}

/**
 * Fetch organic SERP results via Apify Google Search Scraper (fallback).
 * Uses the synchronous run endpoint — blocks up to 60s.
 */
async function fetchApifyResults(
  keyword: string,
  apiToken: string,
  location?: string,
): Promise<SerpSnapshot> {
  const input: Record<string, unknown> = {
    queries: keyword,
    maxPagesPerQuery: 1,
    resultsPerPage: 10,
    countryCode: "au",
    languageCode: "en",
  };
  if (location) input.customDataFunction = location;

  const response = await fetch(
    `${APIFY_API_BASE}/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${apiToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Apify ${response.status} ${response.statusText}`,
    );
  }

  const items = (await response.json()) as Array<{
    organicResults?: Array<{
      position?: number;
      title?: string;
      url?: string;
      description?: string;
    }>;
  }>;

  const organicResults = items[0]?.organicResults ?? [];

  return {
    keyword,
    results: organicResults.slice(0, 10).map((r, i) => ({
      position: r.position ?? i + 1,
      title: r.title ?? "",
      link: r.url ?? "",
      domain: extractDomain(r.url ?? ""),
      snippet: r.description ?? "",
    })),
    searchedAt: Date.now(),
    source: "apify",
  };
}

/**
 * Fetch SERP results — tries SerpAPI first, falls back to Apify on 5xx.
 */
export async function fetchSerpResults(
  keyword: string,
  serpApiKey: string,
  apifyToken: string | null,
  location?: string,
): Promise<SerpSnapshot> {
  try {
    return await fetchSerpApiResults(keyword, serpApiKey, location);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is5xx = /5\d{2}/.test(msg);

    if (is5xx && apifyToken) {
      return await fetchApifyResults(keyword, apifyToken, location);
    }

    throw err;
  }
}

/**
 * Run the full keyword research pipeline for a company.
 *
 * Emits progress events so the admin UI can show real-time stage updates.
 */
export async function runKeywordResearch(
  companyId: string,
): Promise<{ topicsQueued: number; skipped: number; errors: number }> {
  if (!killSwitches.content_automations_enabled) {
    return { topicsQueued: 0, skipped: 0, errors: 0 };
  }

  const serpApiKey = await getCredential("serpapi");
  if (!serpApiKey) {
    throw new Error(
      "SerpAPI credential not found — complete the API key setup wizard first.",
    );
  }
  const apifyToken = await getCredential("apify");

  const config = await db
    .select()
    .from(contentEngineConfig)
    .where(eq(contentEngineConfig.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!config) {
    throw new Error(
      `No content_engine_config found for company ${companyId}`,
    );
  }

  const seedKeywords = (config.seed_keywords as string[] | null) ?? [];
  if (seedKeywords.length === 0) {
    return { topicsQueued: 0, skipped: 0, errors: 0 };
  }

  const existingTopics = await db
    .select({ keyword: contentTopics.keyword })
    .from(contentTopics)
    .where(
      and(
        eq(contentTopics.company_id, companyId),
        inArray(contentTopics.status, ["queued", "generating", "generated"]),
      ),
    );
  const existingKeywords = new Set(
    existingTopics.map((t) => t.keyword.toLowerCase()),
  );

  const total = seedKeywords.length;
  let topicsQueued = 0;
  let skipped = 0;
  let errors = 0;

  emitResearchProgress({
    companyId,
    stage: "started",
    totalKeywords: total,
    currentIndex: 0,
    keyword: null,
    detail: null,
    error: null,
  });

  for (let i = 0; i < seedKeywords.length; i++) {
    const keyword = seedKeywords[i];

    if (existingKeywords.has(keyword.toLowerCase())) {
      skipped++;
      emitResearchProgress({
        companyId,
        stage: "keyword_skipped",
        totalKeywords: total,
        currentIndex: i + 1,
        keyword,
        detail: "already queued",
        error: null,
      });
      continue;
    }

    try {
      emitResearchProgress({
        companyId,
        stage: "fetching_serp",
        totalKeywords: total,
        currentIndex: i + 1,
        keyword,
        detail: null,
        error: null,
      });

      const serpSnapshot = await fetchSerpResults(
        keyword,
        serpApiKey,
        apifyToken,
      );

      emitResearchProgress({
        companyId,
        stage: "scoring",
        totalKeywords: total,
        currentIndex: i + 1,
        keyword,
        detail: `via ${serpSnapshot.source}`,
        error: null,
      });

      const { score, contentGaps } = await scoreKeywordRankability(
        keyword,
        serpSnapshot,
      );

      if (score <= 0) {
        skipped++;
        emitResearchProgress({
          companyId,
          stage: "keyword_skipped",
          totalKeywords: total,
          currentIndex: i + 1,
          keyword,
          detail: "low rankability",
          error: null,
        });
        continue;
      }

      emitResearchProgress({
        companyId,
        stage: "generating_outline",
        totalKeywords: total,
        currentIndex: i + 1,
        keyword,
        detail: `score: ${score}`,
        error: null,
      });

      const outline = await generateTopicOutline(
        keyword,
        contentGaps,
        companyId,
      );

      const now = Date.now();
      await db.insert(contentTopics).values({
        id: randomUUID(),
        company_id: companyId,
        keyword,
        rankability_score: score,
        content_gaps: contentGaps,
        outline,
        serp_snapshot: serpSnapshot,
        status: "queued",
        created_at_ms: now,
      });

      topicsQueued++;
      emitResearchProgress({
        companyId,
        stage: "keyword_done",
        totalKeywords: total,
        currentIndex: i + 1,
        keyword,
        detail: `score: ${score}, queued`,
        error: null,
      });
    } catch (err) {
      errors++;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `Content Engine: keyword research failed for "${keyword}":`,
        err,
      );
      emitResearchProgress({
        companyId,
        stage: "keyword_error",
        totalKeywords: total,
        currentIndex: i + 1,
        keyword,
        detail: null,
        error: errMsg,
      });
    }
  }

  emitResearchProgress({
    companyId,
    stage: "complete",
    totalKeywords: total,
    currentIndex: total,
    keyword: null,
    detail: `${topicsQueued} queued, ${skipped} skipped, ${errors} errors`,
    error: null,
  });

  await logActivity({
    companyId,
    kind: "content_topic_researched",
    body: `Keyword research completed: ${topicsQueued} topics queued, ${skipped} skipped, ${errors} errors`,
    meta: {
      topics_queued: topicsQueued,
      skipped,
      errors,
      seed_keywords_count: seedKeywords.length,
    },
  });

  return { topicsQueued, skipped, errors };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
