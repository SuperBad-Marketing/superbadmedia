/**
 * Google Ads Transparency Center discovery source via SerpAPI.
 *
 * Catches the "runs Google ads but not Meta" segment (spec §3.1).
 * Uses SerpAPI's `google_ads_transparencycenter` engine to search for
 * advertisers by keyword/category in a given region.
 *
 * SerpAPI credential shared with Content Engine + Google Maps source.
 *
 * Owner: LG-2. Consumer: discovery orchestrator.
 */

import { getCredential } from "@/lib/integrations/getCredential";
import { SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { DiscoveredCandidate, DiscoverySearchParams } from "../types";

interface TransparencyResult {
  advertiser_name?: string;
  advertiser_id?: string;
  domain?: string;
  ads_count?: number;
  region?: string;
  format?: string;
  last_shown?: string;
}

interface TransparencyResponse {
  ads_results?: TransparencyResult[];
  advertiser_results?: TransparencyResult[];
  search_metadata?: { status: string };
  error?: string;
}

/**
 * Extract a domain from various URL/domain formats.
 */
function normaliseDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    // Might already be a bare domain
    const cleaned = raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
    return cleaned.includes(".") ? cleaned : null;
  }
}

/**
 * Search the Google Ads Transparency Center via SerpAPI for advertisers
 * running Google ads in a given region/category.
 *
 * @param params Discovery search parameters from Settings.
 * @returns Array of discovered candidates with partial google_ads profile.
 */
export async function searchGoogleAdsTransparency(
  params: DiscoverySearchParams,
): Promise<{ candidates: DiscoveredCandidate[]; error?: string }> {
  const apiKey = await getCredential("serpapi");
  if (!apiKey) {
    return {
      candidates: [],
      error: "SerpAPI credential not found — complete the API key setup wizard first.",
    };
  }

  const start = Date.now();

  const searchText = params.category || params.brief;
  const queryParams = new URLSearchParams({
    engine: "google_ads_transparencycenter",
    text: searchText,
    api_key: apiKey,
    region: "AU",
  });

  try {
    const response = await fetch(
      `${SERPAPI_API_BASE}/search.json?${queryParams.toString()}`,
    );
    const duration = Date.now() - start;

    if (!response.ok) {
      await logExternalCall("serpapi.google_ads_transparency", duration, 0);
      return {
        candidates: [],
        error: `SerpAPI Google Ads Transparency error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as TransparencyResponse;

    if (data.error) {
      await logExternalCall("serpapi.google_ads_transparency", duration, 0);
      return {
        candidates: [],
        error: `SerpAPI Google Ads Transparency error: ${data.error}`,
      };
    }

    // The API may return results under `advertiser_results` or `ads_results`
    const results = data.advertiser_results ?? data.ads_results ?? [];
    await logExternalCall(
      "serpapi.google_ads_transparency",
      duration,
      results.length,
    );

    // Deduplicate by advertiser_id
    const seenAdvertisers = new Set<string>();
    const candidates: DiscoveredCandidate[] = [];

    for (const result of results) {
      const advertiserId = result.advertiser_id ?? result.advertiser_name;
      if (!advertiserId) continue;
      if (seenAdvertisers.has(advertiserId)) continue;
      seenAdvertisers.add(advertiserId);

      const domain = normaliseDomain(result.domain);
      const name = result.advertiser_name ?? domain ?? "Unknown Advertiser";

      candidates.push({
        company_name: name,
        domain,
        source: "google_ads_transparency",
        partial_profile: {
          google_ads: {
            active_creative_count: result.ads_count ?? 1,
            has_active_campaigns: true,
          },
        },
        raw_source_data: {
          advertiser_id: result.advertiser_id,
          region: result.region,
          format: result.format,
          last_shown: result.last_shown,
        },
      });
    }

    return { candidates };
  } catch (err) {
    const duration = Date.now() - start;
    await logExternalCall("serpapi.google_ads_transparency", duration, 0);
    return {
      candidates: [],
      error: `Google Ads Transparency fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function logExternalCall(
  job: string,
  durationMs: number,
  resultCount: number,
): Promise<void> {
  try {
    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job,
      actor_type: "internal",
      units: JSON.stringify({
        search_queries: 1,
        results_returned: resultCount,
      }),
      estimated_cost_aud: 0.005, // SerpAPI ~ $50/5000 searches
      created_at_ms: Date.now(),
    });
  } catch {
    // Best-effort logging
  }
}
