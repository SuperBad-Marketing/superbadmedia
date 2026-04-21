import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const COST_ANOMALY_DETECTORS = [
  "hard_threshold",
  "rate",
  "learned_band",
] as const;

export type CostAnomalyDetector = (typeof COST_ANOMALY_DETECTORS)[number];

export const COST_ANOMALY_TIERS = ["low", "mid", "severe"] as const;

export type CostAnomalyTier = (typeof COST_ANOMALY_TIERS)[number];

/**
 * Detected cost anomalies. One row per {detector, job} per 24h window.
 * Schema per `docs/specs/cost-usage-observatory.md` §4.1.
 */
export const cost_anomalies = sqliteTable(
  "cost_anomalies",
  {
    id: text("id").primaryKey(),
    detector: text("detector", { enum: COST_ANOMALY_DETECTORS }).notNull(),
    job: text("job").notNull(),
    actor_scope: text("actor_scope", { mode: "json" }),
    tier: text("tier", { enum: COST_ANOMALY_TIERS }).notNull(),
    first_fired_at_ms: integer("first_fired_at_ms").notNull(),
    last_fired_at_ms: integer("last_fired_at_ms").notNull(),
    fire_count: integer("fire_count").notNull().default(1),
    observed_value: real("observed_value").notNull(),
    expected_band: text("expected_band", { mode: "json" }).notNull(),
    diagnosis_json: text("diagnosis_json", { mode: "json" }),
    diagnosis_cost_aud: real("diagnosis_cost_aud"),
    acknowledged_at_ms: integer("acknowledged_at_ms"),
    acknowledged_until_ms: integer("acknowledged_until_ms"),
    kill_switch_triggered_at_ms: integer("kill_switch_triggered_at_ms"),
    resolved_at_ms: integer("resolved_at_ms"),
  },
  (t) => ({
    by_job: index("cost_anomalies_job_idx").on(t.job, t.first_fired_at_ms),
    by_tier: index("cost_anomalies_tier_idx").on(t.tier, t.first_fired_at_ms),
    unresolved: index("cost_anomalies_unresolved_idx").on(
      t.resolved_at_ms,
      t.tier,
      t.last_fired_at_ms,
    ),
  }),
);

export type CostAnomalyRow = typeof cost_anomalies.$inferSelect;
export type CostAnomalyInsert = typeof cost_anomalies.$inferInsert;
