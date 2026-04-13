import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/**
 * Primary ledger for every external API call (LLM, Stripe, Resend, Twilio,
 * Remotion, etc). Source of truth for Cost & Usage Observatory (Wave 21).
 * Schema per `docs/specs/cost-usage-observatory.md` §4.1.
 */
export const EXTERNAL_CALL_ACTOR_TYPES = [
  "internal",
  "external",
  "shared",
  "prospect",
] as const;

export type ExternalCallActorType = (typeof EXTERNAL_CALL_ACTOR_TYPES)[number];

export const external_call_log = sqliteTable(
  "external_call_log",
  {
    id: text("id").primaryKey(),
    job: text("job").notNull(),
    actor_type: text("actor_type", { enum: EXTERNAL_CALL_ACTOR_TYPES }).notNull(),
    actor_id: text("actor_id"),
    shared_cohort_id: text("shared_cohort_id"),
    units: text("units", { mode: "json" }).notNull(),
    estimated_cost_aud: real("estimated_cost_aud").notNull(),
    prompt_version_hash: text("prompt_version_hash"),
    converted_from_candidate_id: text("converted_from_candidate_id"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_job: index("external_call_log_job_idx").on(t.job, t.created_at_ms),
    by_actor: index("external_call_log_actor_idx").on(t.actor_id, t.created_at_ms),
    by_actor_type: index("external_call_log_actor_type_idx").on(
      t.actor_type,
      t.created_at_ms,
    ),
  }),
);

export type ExternalCallLogRow = typeof external_call_log.$inferSelect;
export type ExternalCallLogInsert = typeof external_call_log.$inferInsert;
