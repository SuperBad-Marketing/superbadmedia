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
