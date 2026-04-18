/**
 * Discovery orchestrator — runs all three primary sources in parallel,
 * deduplicates by domain, and returns a unified candidate list.
 *
 * This is step 2 of the daily run sequence (spec §3.4):
 *   "Query all sources in parallel for the standing brief (or manual brief
 *    if override). Per-source failures logged to lead_runs.error; run
 *    continues with remaining sources."
 *
 * Owner: LG-2. Consumer: daily search runner (LG-4).
 */

import { searchMetaAdLibrary } from "./sources/meta-ad-library";
import { searchGoogleMaps } from "./sources/google-maps";
import { searchGoogleAdsTransparency } from "./sources/google-ads-transparency";
import type {
  DiscoveredCandidate,
  DiscoverySearchParams,
  SourceResult,
} from "./types";

/**
 * Result of a full discovery run across all three sources.
 */
export interface DiscoveryRunResult {
  /** Deduplicated candidates, sorted by source priority. */
  candidates: DiscoveredCandidate[];

  /** Per-source result details (for lead_runs.per_source_errors_json). */
  source_results: SourceResult[];

  /** Total candidates found before dedup. */
  total_found_before_dedup: number;

  /** How many were removed as duplicates. */
  dedup_removed: number;
}

/**
 * Run all three discovery sources in parallel and return a deduplicated
 * unified candidate list.
 *
 * Each source runs independently — if one fails, the others still return
 * results. Per-source errors are captured in `source_results` for the
 * `lead_runs.per_source_errors_json` audit column.
 *
 * Deduplication is by domain (lowercased). When two sources discover the
 * same domain, the first source in priority order wins:
 *   1. Meta Ad Library (ad-running = strongest signal)
 *   2. Google Ads Transparency (ad-running on Google)
 *   3. Google Maps (location-based, most common duplicates)
 *
 * Candidates without a domain are never deduped against each other
 * (we can't know they're the same business without a domain).
 */
export async function runDiscovery(
  params: DiscoverySearchParams,
): Promise<DiscoveryRunResult> {
  // Run all three sources in parallel (spec §3.4 step 2)
  const [metaResult, mapsResult, transparencyResult] =
    await Promise.allSettled([
      timedSource("meta_ad_library", () => searchMetaAdLibrary(params)),
      timedSource("google_maps", () => searchGoogleMaps(params)),
      timedSource("google_ads_transparency", () =>
        searchGoogleAdsTransparency(params),
      ),
    ]);

  const sourceResults: SourceResult[] = [
    extractSourceResult(metaResult, "meta_ad_library"),
    extractSourceResult(transparencyResult, "google_ads_transparency"),
    extractSourceResult(mapsResult, "google_maps"),
  ];

  // Combine all candidates in priority order
  const allCandidates: DiscoveredCandidate[] = sourceResults.flatMap(
    (sr) => sr.candidates,
  );

  const totalBeforeDedup = allCandidates.length;

  // Deduplicate by domain (priority order: Meta > Transparency > Maps)
  const seenDomains = new Set<string>();
  const deduplicated: DiscoveredCandidate[] = [];

  for (const candidate of allCandidates) {
    if (candidate.domain) {
      const normDomain = candidate.domain.toLowerCase();
      if (seenDomains.has(normDomain)) continue;
      seenDomains.add(normDomain);
    }
    // Candidates without a domain always pass (can't dedup without one)
    deduplicated.push(candidate);
  }

  return {
    candidates: deduplicated,
    source_results: sourceResults,
    total_found_before_dedup: totalBeforeDedup,
    dedup_removed: totalBeforeDedup - deduplicated.length,
  };
}

/**
 * Wrap a source call with timing.
 */
async function timedSource(
  source: DiscoveredCandidate["source"],
  fn: () => Promise<{ candidates: DiscoveredCandidate[]; error?: string }>,
): Promise<SourceResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      source,
      candidates: result.candidates,
      error: result.error,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      source,
      candidates: [],
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start,
    };
  }
}

/**
 * Extract a SourceResult from a Promise.allSettled outcome.
 */
function extractSourceResult(
  settled: PromiseSettledResult<SourceResult>,
  source: DiscoveredCandidate["source"],
): SourceResult {
  if (settled.status === "fulfilled") {
    return settled.value;
  }
  return {
    source,
    candidates: [],
    error:
      settled.reason instanceof Error
        ? settled.reason.message
        : String(settled.reason),
    duration_ms: 0,
  };
}
