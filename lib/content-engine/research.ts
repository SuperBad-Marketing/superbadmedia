/**
 * Content Engine — keyword research via SerpAPI.
 *
 * Stage 1 of the pipeline (spec §2.1): weekly `scheduled_tasks` job per
 * owner fetches SERP data for seed keywords, scores rankability, runs
 * content-gap analysis on top 3 results, and queues topics with outlines.
 *
 * SerpAPI key sourced from `integration_connections` (vault-encrypted).
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
import { scoreKeywordRankability } from "./rankability";
import { generateTopicOutline } from "./topic-queue";
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
}

/**
 * Fetch organic SERP results for a keyword via SerpAPI.
 * Returns the top 10 organic results.
 */
export async function fetchSerpResults(
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
      `SerpAPI request failed: ${response.status} ${response.statusText}`,
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

  const results: SerpResult[] = (data.organic_results ?? [])
    .slice(0, 10)
    .map((r) => ({
      position: r.position,
      title: r.title,
      link: r.link,
      domain: extractDomain(r.link),
      snippet: r.snippet ?? "",
    }));

  return {
    keyword,
    results,
    searchedAt: Date.now(),
  };
}

/**
 * Run the full keyword research pipeline for a company.
 *
 * 1. Load seed keywords from `content_engine_config`
 * 2. For each keyword, fetch SERP via SerpAPI
 * 3. Score rankability (domain authority heuristic + content gap via Haiku)
 * 4. Generate outline for qualifying topics (Haiku)
 * 5. Insert into `content_topics` queue
 *
 * Returns the number of topics queued.
 */
export async function runKeywordResearch(
  companyId: string,
): Promise<{ topicsQueued: number; skipped: number }> {
  if (!killSwitches.content_automations_enabled) {
    return { topicsQueued: 0, skipped: 0 };
  }

  const apiKey = await getCredential("serpapi");
  if (!apiKey) {
    throw new Error(
      "SerpAPI credential not found — complete the API key setup wizard first.",
    );
  }

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
    return { topicsQueued: 0, skipped: 0 };
  }

  // Check which keywords already have topics (avoid duplicates)
  const existingTopics = await db
    .select({ keyword: contentTopics.keyword })
    .from(contentTopics)
    .where(
      and(
        eq(contentTopics.company_id, companyId),
        inArray(
          contentTopics.status,
          ["queued", "generating", "generated"],
        ),
      ),
    );
  const existingKeywords = new Set(
    existingTopics.map((t) => t.keyword.toLowerCase()),
  );

  let topicsQueued = 0;
  let skipped = 0;

  for (const keyword of seedKeywords) {
    if (existingKeywords.has(keyword.toLowerCase())) {
      skipped++;
      continue;
    }

    try {
      const serpSnapshot = await fetchSerpResults(keyword, apiKey);

      const { score, contentGaps } = await scoreKeywordRankability(
        keyword,
        serpSnapshot,
      );

      // Only queue topics with a positive rankability score
      if (score <= 0) {
        skipped++;
        continue;
      }

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
    } catch (err) {
      // Log but don't abort the entire research run for one keyword
      console.error(
        `Content Engine: keyword research failed for "${keyword}":`,
        err,
      );
    }
  }

  await logActivity({
    companyId,
    kind: "content_topic_researched",
    body: `Keyword research completed: ${topicsQueued} topics queued, ${skipped} skipped`,
    meta: {
      topics_queued: topicsQueued,
      skipped,
      seed_keywords_count: seedKeywords.length,
    },
  });

  return { topicsQueued, skipped };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
