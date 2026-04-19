import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { intro_funnel_submissions } from "./intro-funnel-submissions";
import { deals } from "./deals";

export const RECOMMENDATION_TYPES = [
  "retainer",
  "saas",
  "neither",
  "either_strong",
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_CONFIDENCES = ["high", "medium", "low"] as const;
export type RecommendationConfidence =
  (typeof RECOMMENDATION_CONFIDENCES)[number];

export const intro_funnel_retainer_fit = sqliteTable(
  "intro_funnel_retainer_fit",
  {
    id: text("id").primaryKey(),
    submission_id: text("submission_id")
      .notNull()
      .references(() => intro_funnel_submissions.id, { onDelete: "cascade" }),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),

    recommendation_type: text("recommendation_type", {
      enum: RECOMMENDATION_TYPES,
    }).notNull(),
    confidence: text("confidence", {
      enum: RECOMMENDATION_CONFIDENCES,
    }).notNull(),
    reasoning_text: text("reasoning_text").notNull(),
    flags_json: text("flags_json", { mode: "json" }),

    model: text("model").notNull(),
    prompt_version: text("prompt_version").notNull(),
    drift_check_passed: integer("drift_check_passed", { mode: "boolean" })
      .notNull()
      .default(true),

    generated_at_ms: integer("generated_at_ms").notNull(),
  },
  (t) => ({
    by_submission: index("ifrf_submission_idx").on(t.submission_id),
    by_deal: index("ifrf_deal_idx").on(t.deal_id),
  }),
);

export type IntroFunnelRetainerFitRow =
  typeof intro_funnel_retainer_fit.$inferSelect;
export type IntroFunnelRetainerFitInsert =
  typeof intro_funnel_retainer_fit.$inferInsert;
