/**
 * Lead Generation module barrel export.
 *
 * Owner: Lead Generation spec.
 * LG-1: data model + DNC enforcement + sender identity.
 * LG-2: types + discovery source adapters.
 * LG-3: enrichment adapters + mergeProfiles.
 */

export {
  isBlockedFromOutreach,
  addDncEmail,
  addDncDomain,
  removeDncEmail,
  removeDncDomain,
} from "./dnc";

export { SUPERBAD_SENDER, SUPERBAD_FROM_STRING } from "./sender";

export type {
  ViabilityProfile,
  DiscoveryCandidate,
  DiscoverySearchInput,
  DiscoveryResult,
} from "./types";

export {
  searchMetaAdLibrary,
  searchGoogleMaps,
  searchGoogleAdsTransparency,
} from "./sources";

export {
  enrichPageSpeed,
  enrichDomainAge,
  enrichInstagram,
  enrichYouTube,
  enrichWebsiteScrape,
  enrichMapsPhotos,
  mergeProfiles,
} from "./enrichment";

export { enforceWarmupCap } from "./warmup";
export type { WarmupCapResult } from "./warmup";

export { deduplicateCandidates } from "./dedup";

export { runLeadGenDaily } from "./orchestrator";
export type { LeadRunSummary } from "./orchestrator";

export {
  scoreForSaasTrack,
  scoreForRetainerTrack,
  assignTrack,
  SAAS_QUALIFICATION_FLOOR,
  RETAINER_QUALIFICATION_FLOOR,
} from "./scoring";
export type { ScoringBreakdown } from "./scoring";
