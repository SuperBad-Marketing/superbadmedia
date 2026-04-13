/**
 * Brand DNA module — public API surface.
 *
 * BDA-1: invite issuance and redemption primitives.
 * BDA-2: question bank, section insight generation.
 * BDA-3: profile generation, company blend, reveal choreography.
 */

// ── BDA-1: invite primitives ─────────────────────────────────────────────────
export { issueBrandDnaInvite } from "./issue-invite";
export type { IssueBrandDnaInviteInput, IssueBrandDnaInviteResult } from "./issue-invite";

export { redeemBrandDnaInvite } from "./redeem-invite";
export type { RedeemedBrandDnaInvite } from "./redeem-invite";

// ── BDA-2: question bank + insight generation ────────────────────────────────
export {
  QUESTION_BANK,
  SECTION_TITLES,
  SECTION_SUBTITLES,
  getQuestionsForSection,
  getQuestionById,
} from "./question-bank";
export type { Question, QuestionOption } from "./question-bank";

export { generateSectionInsight } from "./generate-insight";
