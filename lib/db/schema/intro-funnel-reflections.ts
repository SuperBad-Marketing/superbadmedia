import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { intro_funnel_submissions } from "./intro-funnel-submissions";
import { deals } from "./deals";

export const DECISION_CTA_CHOICES = ["yes_talk", "think_about_it"] as const;
export type DecisionCtaChoice = (typeof DECISION_CTA_CHOICES)[number];

export const intro_funnel_reflections = sqliteTable(
  "intro_funnel_reflections",
  {
    id: text("id").primaryKey(),
    submission_id: text("submission_id")
      .notNull()
      .references(() => intro_funnel_submissions.id, { onDelete: "cascade" }),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),

    answers_json: text("answers_json", { mode: "json" }).notNull(),
    safety_valve_triggered: integer("safety_valve_triggered", {
      mode: "boolean",
    })
      .notNull()
      .default(false),

    synthesis_text: text("synthesis_text"),
    synthesis_model: text("synthesis_model"),
    synthesis_prompt_version: text("synthesis_prompt_version"),
    synthesis_drift_check_passed: integer("synthesis_drift_check_passed", {
      mode: "boolean",
    }),
    synthesis_generated_at_ms: integer("synthesis_generated_at_ms"),

    decision_cta_choice: text("decision_cta_choice", {
      enum: DECISION_CTA_CHOICES,
    }),
    decision_made_at_ms: integer("decision_made_at_ms"),

    completed_at_ms: integer("completed_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_submission: index("ifr_submission_idx").on(t.submission_id),
    by_deal: index("ifr_deal_idx").on(t.deal_id),
  }),
);

export type IntroFunnelReflectionRow =
  typeof intro_funnel_reflections.$inferSelect;
export type IntroFunnelReflectionInsert =
  typeof intro_funnel_reflections.$inferInsert;
