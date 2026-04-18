/**
 * Lead Generation module barrel export.
 *
 * Owner: Lead Generation spec.
 * LG-1: data model + DNC enforcement + sender identity.
 * LG-2: discovery sources + orchestrator + types.
 * LG-3: enrichment pipeline.
 * LG-4: scoring engine + candidate creation + daily search runner.
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
// LG-4: Scoring engine
export {
  scoreForSaasTrack,
  scoreForRetainerTrack,
  assignTrack,
  rescoreCandidate,
  SAAS_FLOOR,
  RETAINER_FLOOR,
  REACTIVE_MIN,
  REACTIVE_MAX,
} from "./scoring";
export type {
  ScoringBreakdown,
  TrackAssignment,
  RescoreResult,
  RescoreBreakdown,
  EngagementEvent,
  ReplyClassification,
  FileNote,
} from "./scoring";

// LG-4: Candidate creation
export { createCandidate } from "./candidate";
export type { CreateCandidateInput, CreateCandidateResult } from "./candidate";

// LG-4: Daily search runner
export { runDailySearch, next3amMelbourneMs } from "./daily-search";
export type { DailySearchInput, DailySearchResult } from "./daily-search";

// LG-5: Contact discovery + draft generation
export { discoverContact } from "./contact-discovery";
export type { ContactDiscoveryResult } from "./contact-discovery";
export { generateDraft } from "./draft-generator";
export type {
  GenerateDraftInput,
  GenerateDraftResult,
  GenerateDraftOutcome,
} from "./draft-generator";

// LG-6: Warmup ramp enforcement
export { enforceWarmupCap, recordWarmupSend, initWarmupState } from "./warmup";
export type { WarmupCapResult } from "./warmup";

// LG-3: Enrichment pipeline (re-exports)
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
