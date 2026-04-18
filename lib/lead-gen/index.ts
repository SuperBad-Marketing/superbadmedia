/**
 * Lead Generation module barrel export.
 *
 * Owner: Lead Generation spec.
 * LG-1: data model + DNC enforcement + sender identity.
 * LG-2: discovery sources + orchestrator + types.
 */

export {
  isBlockedFromOutreach,
  addDncEmail,
  addDncDomain,
  removeDncEmail,
  removeDncDomain,
} from "./dnc";

export { SUPERBAD_SENDER, SUPERBAD_FROM_STRING } from "./sender";

// LG-2: Types
export type {
  ViabilityProfile,
  DiscoveredCandidate,
  DiscoverySearchParams,
  SourceResult,
} from "./types";

// LG-2: Discovery sources
export { searchMetaAdLibrary } from "./sources/meta-ad-library";
export { searchGoogleMaps } from "./sources/google-maps";
export { searchGoogleAdsTransparency } from "./sources/google-ads-transparency";

// LG-2: Discovery orchestrator
export { runDiscovery } from "./discovery";
export type { DiscoveryRunResult } from "./discovery";

// LG-3: Enrichment pipeline
export { enrichCandidate } from "./enrich";
export type { EnrichmentResult } from "./enrich";
export {
  fetchPageSpeed,
  fetchWhois,
  fetchInstagram,
  fetchYouTube,
  scrapeWebsite,
  fetchMapsExtras,
  guessInstagramHandle,
  inferTeamSize,
  inferPricingTier,
  parseRelativeDate,
} from "./enrich";
