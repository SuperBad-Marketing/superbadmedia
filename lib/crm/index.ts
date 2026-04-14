export { createDealFromLead } from "./create-deal-from-lead";
export type {
  CreateDealFromLeadInput,
  CreateDealFromLeadResult,
  CreateDealCompanyInput,
  CreateDealContactInput,
} from "./create-deal-from-lead";
export {
  normaliseEmail,
  normalisePhone,
  normaliseCompanyName,
  normaliseDomain,
} from "./normalise";
export { validateDeal } from "./validate-deal";
export type {
  ValidateDealInput,
  ValidateDealResult,
  ValidateDealOk,
  ValidateDealErr,
} from "./validate-deal";
export {
  transitionDealStage,
  LEGAL_TRANSITIONS,
} from "./transition-deal-stage";
export type { TransitionDealStageOpts } from "./transition-deal-stage";
export { isDealStale } from "./is-stale";
export type { IsDealStaleInput, PipelineStaleThresholds } from "./is-stale";
export { snoozeDeal } from "./snooze-deal";
export type { SnoozeDealOpts } from "./snooze-deal";
export {
  TRIAL_SHOOT_SEQUENCE,
  TRIAL_SHOOT_STATUSES,
  isForwardTransition,
  isTrialShootComplete,
  legalForwardTargets,
} from "./trial-shoot-status";
export type { TrialShootStatus } from "./trial-shoot-status";
export {
  advanceTrialShootStatus,
  advanceTrialShootStatusOnFeedback,
} from "./advance-trial-shoot-status";
export type {
  AdvanceTrialShootStatusOpts,
  AdvanceTrialShootStatusResult,
} from "./advance-trial-shoot-status";
export { updateTrialShootPlan } from "./update-trial-shoot-plan";
export type { UpdateTrialShootPlanOpts } from "./update-trial-shoot-plan";
export { finaliseDealAsWon, finaliseDealAsLost } from "./finalise-deal";
export type {
  FinaliseWonPayload,
  FinaliseLostPayload,
  FinaliseDealOpts,
} from "./finalise-deal";
