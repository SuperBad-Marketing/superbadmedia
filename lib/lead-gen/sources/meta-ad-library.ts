/**
 * Meta Ad Library API — primary discovery source for ad-running businesses.
 *
 * Queries the public Meta Ad Library API for active advertisers in a given
 * location. Free, public, high rate limits. Returns `DiscoveredCandidate[]`
 * with partial viability profile seeded from ad data.
 *
 * Owner: LG-2. Consumer: discovery orchestrator.
 *
 * API docs: Meta Ad Library API (Graph API `/ads_archive` endpoint).
 * Requires an app access token (long-lived page token or app-id|app-secret).
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { META_GRAPH_API_VERSION } from "@/lib/integrations/vendors/meta-ads";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { DiscoveredCandidate, DiscoverySearchParams } from "../types";

const META_AD_LIBRARY_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/ads_archive`;

/**
 * Required fields for the Ad Library API response.
 */
const AD_LIBRARY_FIELDS = [
  "page_id",
  "page_name",
  "ad_delivery_start_time",
  "ad_creative_bodies",
  "ad_creative_link_captions",
  "ad_creative_link_titles",
  "estimated_audience_size",
].join(",");

interface AdLibraryResult {
  page_id: string;
  page_name: string;
  ad_delivery_start_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
  estimated_audience_size?: { lower_bound: number; upper_bound: number };
}

interface AdLibraryResponse {
  data?: AdLibraryResult[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number };
}

/**
 * Classify ad spend bracket from estimated audience size bounds.
 * Rough heuristic — Meta doesn't expose actual spend in the Ad Library.
 */
function classifySpendBracket(
  audience?: { lower_bound: number; upper_bound: number },
): "unknown" | "low" | "medium" | "high" {
  if (!audience) return "unknown";
  const mid = (audience.lower_bound + audience.upper_bound) / 2;
  if (mid < 5_000) return "low";
  if (mid < 50_000) return "medium";
  return "high";
}

/**
 * Extract a domain from ad creative link captions (Meta often includes
 * the advertiser's domain in the link caption).
 */
function extractDomainFromCreatives(result: AdLibraryResult): string | null {
  const captions = result.ad_creative_link_captions ?? [];
  for (const caption of captions) {
    // Link captions are often just the domain, e.g. "acmecafe.com.au"
    const cleaned = caption
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();

    if (cleaned.includes(".") && !cleaned.includes(" ")) {
      return cleaned;
    }
  }
  return null;
}

/**
 * Search the Meta Ad Library for active advertisers matching a query.
 *
 * @param params Discovery search parameters from Settings.
 * @returns Array of discovered candidates with partial meta_ads profile.
 */
export async function searchMetaAdLibrary(
  params: DiscoverySearchParams,
): Promise<{ candidates: DiscoveredCandidate[]; error?: string }> {
  const accessToken = await getCredential("meta-ads");
  if (!accessToken) {
    return {
      candidates: [],
      error: "Meta Ads credential not found — complete the setup wizard first.",
    };
  }

  const start = Date.now();

  const searchTerms = params.category || params.brief;
  const queryParams = new URLSearchParams({
    access_token: accessToken,
    search_terms: searchTerms,
    ad_reached_countries: '["AU"]',
    ad_active_status: "ACTIVE",
    ad_type: "ALL",
    fields: AD_LIBRARY_FIELDS,
    limit: String(Math.min(params.max_candidates * 2, 50)),
  });

  try {
    const response = await fetch(
      `${META_AD_LIBRARY_BASE}?${queryParams.toString()}`,
    );
    const duration = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text();
      await logExternalCall("meta.ad_library.search", duration, 0, params);
      return {
        candidates: [],
        error: `Meta Ad Library API error: ${response.status} — ${errorBody}`,
      };
    }

    const data = (await response.json()) as AdLibraryResponse;

    if (data.error) {
      await logExternalCall("meta.ad_library.search", duration, 0, params);
      return {
        candidates: [],
        error: `Meta Ad Library API error: ${data.error.message}`,
      };
    }

    const results = data.data ?? [];
    await logExternalCall(
      "meta.ad_library.search",
      duration,
      results.length,
      params,
    );

    // Deduplicate by page_id (same advertiser can have multiple ads)
    const seenPageIds = new Set<string>();
    const candidates: DiscoveredCandidate[] = [];

    for (const result of results) {
      if (seenPageIds.has(result.page_id)) continue;
      seenPageIds.add(result.page_id);

      const domain = extractDomainFromCreatives(result);
      const spendBracket = classifySpendBracket(result.estimated_audience_size);

      candidates.push({
        company_name: result.page_name,
        domain,
        source: "meta_ad_library",
        partial_profile: {
          meta_ads: {
            active_ad_count: 1, // At least 1 — Ad Library doesn't give exact count per page in a single query
            estimated_spend_bracket: spendBracket,
            has_active_creatives: true,
          },
        },
        raw_source_data: {
          page_id: result.page_id,
          ad_delivery_start_time: result.ad_delivery_start_time,
          estimated_audience_size: result.estimated_audience_size,
        },
      });
    }

    return { candidates };
  } catch (err) {
    const duration = Date.now() - start;
    await logExternalCall("meta.ad_library.search", duration, 0, params);
    return {
      candidates: [],
      error: `Meta Ad Library fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function logExternalCall(
  job: string,
  durationMs: number,
  resultCount: number,
  params: DiscoverySearchParams,
): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job,
      actor_type: "internal",
      units: JSON.stringify({
        search_queries: 1,
        results_returned: resultCount,
        category: params.category,
      }),
      estimated_cost_aud: 0, // Free API
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging — don't break the pipeline
  }
}
