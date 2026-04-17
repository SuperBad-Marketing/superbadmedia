/**
 * Brand DNA Assessment — full question bank.
 *
 * 98 core questions across 5 sections + 15 supplement questions = 113 total.
 * Content authored in CMS-1 (2026-04-17). Authoritative source: docs/content/brand-dna/.
 *
 * Owner: CMS-1. Consumer: BDA-3 (tag aggregation for profile generation).
 */

export type {
  SectionNumber,
  Track,
  Question,
  QuestionOption,
  SupplementQuestion,
} from "./types";

import type { SectionNumber, Question } from "./types";
import { SECTION_1 } from "./section-1";
import { SECTION_2 } from "./section-2";
import { SECTION_3 } from "./section-3";
import { SECTION_4 } from "./section-4";
import { SECTION_5 } from "./section-5";
export { SUPPLEMENT_BANK } from "./supplement";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Human-readable titles for each of the five core sections. */
export const SECTION_TITLES: Record<SectionNumber, string> = {
  1: "Aesthetic Identity",
  2: "Communication DNA",
  3: "Values & Instincts",
  4: "Creative Compass",
  5: "Brand Aspiration",
};

/** Short descriptors shown as subheadings in the section title card. */
export const SECTION_SUBTITLES: Record<SectionNumber, string> = {
  1: "How you see the world.",
  2: "How you land in a room.",
  3: "What moves under the surface.",
  4: "What you can\u2019t stop looking at \u2014 and what you\u2019d never make.",
  5: "The gap between where you are and where you\u2019re going.",
};

/** Title and subtitle for the supplement section (founder_supplement track only). */
export const SUPPLEMENT_TITLE = "Where the Brand Splits From You";
export const SUPPLEMENT_SUBTITLE = "The version of this that isn\u2019t you.";

// ── Aggregated bank ───────────────────────────────────────────────────────────

/** All 98 core questions across sections 1–5. */
export const QUESTION_BANK: Question[] = [
  ...SECTION_1,
  ...SECTION_2,
  ...SECTION_3,
  ...SECTION_4,
  ...SECTION_5,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return all questions for a given section (1–5). */
export function getQuestionsForSection(
  section: SectionNumber,
): Question[] {
  return QUESTION_BANK.filter((q) => q.section === section);
}

/** Return a single question by its id, or undefined if not found. */
export function getQuestionById(id: string): Question | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}

/**
 * Return the questions a specific track sees for a section.
 * Shared questions are always included. Track-exclusive questions
 * are included only for their matching track.
 */
export function getQuestionsForTrack(
  section: SectionNumber,
  track: "founder" | "business",
): Question[] {
  return QUESTION_BANK.filter(
    (q) => q.section === section && (q.track === "shared" || q.track === track),
  );
}

/**
 * Resolve the display text for a question given the respondent's track.
 * Returns the appropriate framing string.
 */
export function resolveQuestionText(
  question: Question,
  track: "founder" | "business",
): string {
  if (typeof question.text === "string") return question.text;
  return question.text[track];
}
