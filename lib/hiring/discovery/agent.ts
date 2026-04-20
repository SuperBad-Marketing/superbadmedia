import settings from "@/lib/settings";
import { invokeLlmText } from "@/lib/ai/invoke";
import {
  buildDiscoverySearchQueriesPrompt,
  buildDiscoveryResultsFilterPrompt,
  type DiscoveryAgentPromptInput,
} from "@/lib/ai/prompts/hiring/discovery-agent";
import { ingestPortfolioUrl } from "@/lib/hiring/portfolio";
import { scoreCandidateAgainstBriefs } from "@/lib/hiring/score-candidate";
import {
  createCandidate,
  updateCandidate,
  listCandidates,
  listRoleBriefs,
  updateRoleBrief,
} from "@/lib/hiring/queries";
import { logActivity } from "@/lib/activity-log";
import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";
import type { DiscoveryCandidate, DiscoveryRunResult } from "./types";
import { DISCOVERY_SOURCES } from "./sources";
import { logDiscoveryCall } from "./log";

const SERPAPI_SEARCH_URL = "https://serpapi.com/search.json";

interface SerpApiResult {
  organic_results?: Array<{
    link?: string;
    title?: string;
    snippet?: string;
  }>;
}

async function searchWeb(query: string): Promise<string[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  const start = Date.now();
  try {
    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      engine: "google",
      num: "10",
    });

    const response = await fetch(`${SERPAPI_SEARCH_URL}?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      await logDiscoveryCall(
        "hiring-discovery-agent",
        Date.now() - start,
        0.005,
        { query_length: query.length },
      );
      return [];
    }

    const data = (await response.json()) as SerpApiResult;
    await logDiscoveryCall(
      "hiring-discovery-agent",
      Date.now() - start,
      0.005,
      { results_count: data.organic_results?.length ?? 0 },
    );

    return (data.organic_results ?? [])
      .map((r) => r.link)
      .filter((link): link is string => typeof link === "string");
  } catch {
    await logDiscoveryCall(
      "hiring-discovery-agent",
      Date.now() - start,
      0.005,
    );
    return [];
  }
}

function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
}

function parseBriefContext(brief: RoleBriefRow): DiscoveryAgentPromptInput {
  const rateRange =
    brief.rate_min_aud != null && brief.rate_max_aud != null
      ? `$${brief.rate_min_aud}–$${brief.rate_max_aud}/${brief.rate_unit ?? "per_hour"}`
      : null;

  return {
    role_name: brief.role_name,
    style_summary: brief.style_summary ?? "",
    extracted_tags: safeJsonArray(brief.extracted_tags_json),
    style_do_list: safeJsonArray(brief.style_do_list_json),
    discovery_search_hints: safeJsonArray(brief.discovery_search_hints_json),
    location_pref_city: brief.location_pref_city,
    remote_ok: !!brief.remote_ok,
    rate_range: rateRange,
  };
}

async function getExistingCandidateUrls(
  roleBriefId: string,
): Promise<Set<string>> {
  const existing = await listCandidates({ role_brief_id: roleBriefId });
  const urls = new Set<string>();
  for (const c of existing) {
    const val = c.portfolio_urls_json;
    if (Array.isArray(val)) {
      for (const u of val) {
        if (typeof u === "string") urls.add(u.toLowerCase());
      }
    }
  }
  return urls;
}

function extractNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    return last
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 100);
  } catch {
    return null;
  }
}

export async function runDiscoveryForBrief(
  brief: RoleBriefRow,
): Promise<DiscoveryRunResult> {
  const costCap = await settings.get(
    "hiring.discovery.llm_max_cost_aud_per_run",
  );
  const candidatesCap = await settings.get(
    "hiring.discovery.llm_candidates_per_run",
  );
  const agentEnabled = await settings.get(
    "hiring.discovery.llm_agent_enabled",
  );

  const result: DiscoveryRunResult = {
    role_brief_id: brief.id,
    candidates: [],
    total_cost_aud: 0,
    urls_discovered: 0,
    urls_ingested: 0,
    urls_skipped_duplicate: 0,
    cost_cap_hit: false,
  };

  const existingUrls = await getExistingCandidateUrls(brief.id);
  const allDiscoveredUrls: string[] = [];

  // --- Path A: Platform feed sources (lightweight, no cost cap) ---
  for (const source of DISCOVERY_SOURCES) {
    try {
      const sourceResult = await source.fetch(brief);
      result.total_cost_aud += sourceResult.cost_aud;
      for (const url of sourceResult.urls) {
        if (!allDiscoveredUrls.includes(url.toLowerCase())) {
          allDiscoveredUrls.push(url);
        }
      }
    } catch {
      // Source failure is non-fatal — continue with other sources
    }
  }

  // --- Path B: LLM+search agent (cost-capped) ---
  if (agentEnabled) {
    const briefContext = parseBriefContext(brief);
    const promptText = buildDiscoverySearchQueriesPrompt(briefContext);

    const start = Date.now();
    let queriesText: string;
    try {
      queriesText = await invokeLlmText({
        job: "hiring-discovery-agent",
        prompt: promptText,
        maxTokens: 500,
      });
      result.total_cost_aud += 0.02;
    } catch {
      queriesText = "[]";
    }

    await logDiscoveryCall(
      "hiring-discovery-agent",
      Date.now() - start,
      0.02,
      { phase: 1 },
    );

    let queries: string[] = [];
    try {
      const cleaned = queriesText.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as unknown;
      if (Array.isArray(parsed)) {
        queries = parsed
          .filter((q): q is string => typeof q === "string")
          .slice(0, 10);
      }
    } catch {
      // LLM returned non-JSON — no searches this run
    }

    const searchUrls: string[] = [];
    for (const query of queries) {
      if (result.total_cost_aud >= costCap) {
        result.cost_cap_hit = true;
        break;
      }

      const urls = await searchWeb(query);
      result.total_cost_aud += 0.005;
      for (const u of urls) {
        if (!searchUrls.includes(u)) searchUrls.push(u);
      }
    }

    if (searchUrls.length > 0 && result.total_cost_aud < costCap) {
      const filterStart = Date.now();
      try {
        const filterText = await invokeLlmText({
          job: "hiring-discovery-agent",
          prompt: buildDiscoveryResultsFilterPrompt(
            brief.role_name,
            brief.style_summary ?? "",
            briefContext.extracted_tags,
            searchUrls.slice(0, 30),
          ),
          maxTokens: 500,
        });
        result.total_cost_aud += 0.02;

        await logDiscoveryCall(
          "hiring-discovery-agent",
          Date.now() - filterStart,
          0.02,
          { phase: 2 },
        );

        const cleanedFilter = filterText
          .replace(/```json\s*|```/g, "")
          .trim();
        const filtered = JSON.parse(cleanedFilter) as unknown;
        if (Array.isArray(filtered)) {
          for (const u of filtered) {
            if (
              typeof u === "string" &&
              !allDiscoveredUrls.includes(u.toLowerCase())
            ) {
              allDiscoveredUrls.push(u);
            }
          }
        }
      } catch {
        for (const u of searchUrls.slice(0, 15)) {
          if (!allDiscoveredUrls.includes(u.toLowerCase())) {
            allDiscoveredUrls.push(u);
          }
        }
      }
    }
  }

  result.urls_discovered = allDiscoveredUrls.length;

  // --- Ingest + score discovered URLs ---
  const scoredCandidates: DiscoveryCandidate[] = [];

  for (const url of allDiscoveredUrls) {
    if (existingUrls.has(url.toLowerCase())) {
      result.urls_skipped_duplicate++;
      continue;
    }

    if (result.total_cost_aud >= costCap) {
      result.cost_cap_hit = true;
      break;
    }

    try {
      const signal = await ingestPortfolioUrl(url);
      result.urls_ingested++;

      const scores = await scoreCandidateAgainstBriefs(signal, [brief]);
      const topScore = scores[0];

      if (topScore && topScore.score > 0) {
        scoredCandidates.push({
          url,
          name: topScore.name_guess ?? extractNameFromUrl(url),
          platform: signal.platform,
          signal,
          score: topScore.score,
          reasoning: topScore.reasoning,
          source_name: "discovery",
        });
      }

      result.total_cost_aud += 0.01;
    } catch {
      // Ingest failure is non-fatal
    }
  }

  // --- Sort by score, take top N, persist as Sourced ---
  scoredCandidates.sort((a, b) => b.score - a.score);
  const topCandidates = scoredCandidates.slice(0, candidatesCap);

  for (const dc of topCandidates) {
    try {
      const candidate = await createCandidate({
        role_brief_id: brief.id,
        stage: "sourced",
        source: "auto_discovered",
        discovery_source: dc.source_name,
        name: dc.name ?? "Unknown",
        portfolio_urls_json: [dc.url],
      });

      await updateCandidate(candidate.id, {
        portfolio_signal_json: dc.signal as unknown as Record<string, unknown>,
        portfolio_signal_fetched_at_ms: dc.signal.fetched_at,
        brief_match_score: dc.score,
      });

      await logActivity({
        kind: "candidate_sourced",
        body: `Discovery agent sourced candidate for ${brief.role_name}`,
        meta: {
          candidate_id: candidate.id,
          role_brief_id: brief.id,
          role_name: brief.role_name,
          score: dc.score,
          platform: dc.platform,
          source: dc.source_name,
        },
      });

      result.candidates.push(dc);
    } catch {
      // Candidate creation failure is non-fatal
    }
  }

  // Update last discovery run timestamp
  await updateRoleBrief(brief.id, {
    last_discovery_run_at_ms: Date.now(),
  });

  return result;
}

export async function runDiscoveryForAllOpenBriefs(): Promise<
  DiscoveryRunResult[]
> {
  const briefs = await listRoleBriefs({ status: ["open"] });
  const results: DiscoveryRunResult[] = [];

  for (const brief of briefs) {
    const cadence = await settings.get("hiring.discovery.llm_run_cadence");
    if (cadence === "off") continue;

    const result = await runDiscoveryForBrief(brief);
    results.push(result);
  }

  return results;
}
