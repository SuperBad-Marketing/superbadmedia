import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Individual answer rows for a Brand DNA Assessment.
 *
 * Each row captures a single question answer within one profile attempt.
 * The `question_id` references the static question bank content files
 * (TypeScript/JSON in the codebase — not DB tables). The `tags_awarded`
 * JSON captures which signal tags this answer produced, used for aggregation
 * into the profile's `signal_tags` frequency map.
 *
 * Owner: BDA-1. Consumer: BDA-2 (renders questions), BDA-3 (profile generation).
 */

export const BRAND_DNA_ANSWER_OPTIONS = ["a", "b", "c", "d"] as const;
export type BrandDnaAnswerOption = (typeof BRAND_DNA_ANSWER_OPTIONS)[number];

export const brand_dna_answers = sqliteTable(
  "brand_dna_answers",
  {
    id: text("id").primaryKey(),
    /** FK to brand_dna_profiles.id — the profile this answer belongs to. */
    profile_id: text("profile_id").notNull(),
    /**
     * String key referencing the question bank content file.
     * Format: "<section>_<track>_<shape>_<index>", e.g. "s1_founder_solo_001".
     * Exact format locked in the content mini-session.
     */
    question_id: text("question_id").notNull(),
    /** Section number: 1–5 for core sections, 6 for supplement. */
    section: integer("section").notNull(),
    /** Which of the four options was selected. */
    selected_option: text("selected_option", {
      enum: BRAND_DNA_ANSWER_OPTIONS,
    }).notNull(),
    /**
     * Signal tags this answer produced, as a JSON array of strings.
     * 1–3 tags per answer. E.g. ["warmth", "analogue"].
     */
    tags_awarded: text("tags_awarded").notNull(),
    /** UTC epoch ms when the answer was submitted. */
    answered_at_ms: integer("answered_at_ms").notNull(),
  },
  (t) => ({
    by_profile: index("brand_dna_answers_profile_idx").on(
      t.profile_id,
      t.section,
    ),
    by_question: index("brand_dna_answers_question_idx").on(
      t.profile_id,
      t.question_id,
    ),
  }),
);

export type BrandDnaAnswerRow = typeof brand_dna_answers.$inferSelect;
export type BrandDnaAnswerInsert = typeof brand_dna_answers.$inferInsert;
