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
export { searchMetaAdLibraryApify } from "./sources/apify-meta-ad-library";
export { searchInstagramLocation } from "./sources/apify-instagram-location";
export { searchGoogleMaps } from "./sources/google-maps";
export { searchMetaAdLibrary } from "./sources/meta-ad-library";
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

// LG-8: Autonomy state machine (§9.2, §9.3, §9.5, §12.F)
export {
  transitionAutonomyState,
  getAutonomyStates,
  getAutonomyRow,
  getAutoSendDelayMs,
} from "./autonomy";
export type {
  AutonomyEvent,
  AutonomyTransitionResult,
  AutonomyStateView,
} from "./autonomy";

// LG-9: Sequence engine + engagement evaluator
export { runSequenceScheduler, executeSend, getNextTouchDueMs } from "./sequence-engine";
export type { SequenceRunResult, SendDraftResult } from "./sequence-engine";
export { evaluateEngagementTiers, classifyEngagementTier } from "./engagement-evaluator";
export type { EvaluateEngagementResult, EngagementTier } from "./engagement-evaluator";

// LG-10: Unsubscribe token
export {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  createUnsubscribeUrl,
} from "./unsubscribe-token";
export type { UnsubscribePayload } from "./unsubscribe-token";

// LG-10: Stale nudge generator
export { generateStaleNudges } from "./stale-nudge";
export type { StaleNudgeResult } from "./stale-nudge";

// LG-7: Query functions (pure reads per §12.M)
export {
  getRecentRuns,
  getCandidatesForRun,
  getPendingDrafts,
  getFunnelMetrics,
  getApprovalRateSparkline,
  getWarmupProgress,
  getQueueHeaderData,
} from "./queries";
export type {
  QueueDraft,
  FunnelData,
  ApprovalSparklinePoint,
  WarmupProgress,
  QueueHeaderData,
} from "./queries";

// Vertical rotation
export {
  getNextVertical,
  recordVerticalSearch,
  listVerticals,
  createVertical,
  updateVertical,
  toggleVertical,
  deleteVertical,
} from "./vertical-rotation";
export type { SelectedVertical } from "./vertical-rotation";

// ICP pre-filter
export { prefilterCandidate, prefilterCandidates } from "./icp-prefilter";
export type { IcpPrefilterResult } from "./icp-prefilter";

// Apify email finder
export { findEmailsViaApify } from "./sources/apify-email-finder";
export type { ApifyEmailResult } from "./sources/apify-email-finder";

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

// Reply handling
export { handleInboundReply } from "./reply-handler";
export type { InboundReply, HandleReplyResult } from "./reply-handler";

// Reply drop-off sequence
export { processDropOffSequence } from "./reply-drop-off";
export type { DropOffRunResult } from "./reply-drop-off";

// Discount codes
export { createDiscountCode, validateDiscountCode, redeemDiscountCode } from "./discount-codes";
export type { ValidateCodeResult } from "./discount-codes";
