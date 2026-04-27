import { searchMetaAdLibraryApify } from "./sources/apify-meta-ad-library";
import { searchInstagramLocation } from "./sources/apify-instagram-location";
import { searchGoogleMaps } from "./sources/google-maps";
import type {
  DiscoveredCandidate,
  DiscoverySearchParams,
  SourceResult,
} from "./types";

const BROAD_SWEEP_CATEGORIES = [
  "restaurants",
  "retail stores",
  "health and beauty",
  "professional services",
  "fitness and wellness",
  "trades and construction",
  "automotive",
  "hospitality and accommodation",
  "creative and design",
  "education and training",
  "food and beverage",
  "medical and dental",
];

let broadSweepIndex = 0;

function nextBroadCategory(): string {
  const cat = BROAD_SWEEP_CATEGORIES[broadSweepIndex % BROAD_SWEEP_CATEGORIES.length];
  broadSweepIndex++;
  return cat;
}

export interface DiscoveryRunResult {
  candidates: DiscoveredCandidate[];
  source_results: SourceResult[];
  total_found_before_dedup: number;
  dedup_removed: number;
}

/**
 * Run all three discovery sources in parallel:
 *   1. Meta Ad Library (Apify) — businesses actively running ads
 *   2. Instagram location — businesses with local content presence
 *   3. Google Maps broad sweep — auto-cycling categories, catches the rest
 *
 * Deduplication by domain. Priority: Meta Ads > Instagram > Maps.
 */
export async function runDiscovery(
  params: DiscoverySearchParams,
): Promise<DiscoveryRunResult> {
  const mapsParams = {
    ...params,
    category: params.category || nextBroadCategory(),
  };

  const [metaResult, instagramResult, mapsResult] =
    await Promise.allSettled([
      timedSource("meta_ad_library", () => searchMetaAdLibraryApify(params)),
      timedSource("instagram_location", () => searchInstagramLocation(params)),
      timedSource("google_maps", () => searchGoogleMaps(mapsParams)),
    ]);

  const sourceResults: SourceResult[] = [
    extractSourceResult(metaResult, "meta_ad_library"),
    extractSourceResult(instagramResult, "instagram_location"),
    extractSourceResult(mapsResult, "google_maps"),
  ];

  const allCandidates: DiscoveredCandidate[] = sourceResults.flatMap(
    (sr) => sr.candidates,
  );

  const totalBeforeDedup = allCandidates.length;

  const seenDomains = new Set<string>();
  const deduplicated: DiscoveredCandidate[] = [];

  for (const candidate of allCandidates) {
    if (candidate.domain) {
      const normDomain = candidate.domain.toLowerCase();
      if (seenDomains.has(normDomain)) continue;
      seenDomains.add(normDomain);
    }
    deduplicated.push(candidate);
  }

  return {
    candidates: deduplicated,
    source_results: sourceResults,
    total_found_before_dedup: totalBeforeDedup,
    dedup_removed: totalBeforeDedup - deduplicated.length,
  };
}

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
