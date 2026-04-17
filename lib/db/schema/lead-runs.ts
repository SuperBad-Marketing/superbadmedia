import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Append-only audit log of every daily run + ad-hoc run. Powers the
 * Runs tab and the Metrics panel.
 *
 * Owner: Lead Generation spec §4.5.
 * Consumers: metrics panel, Daily Cockpit, runs-log tab.
 */

export const LEAD_RUN_TRIGGERS = [
  "scheduled",
  "run_now",
  "manual_brief",
] as const;
export type LeadRunTrigger = (typeof LEAD_RUN_TRIGGERS)[number];

export const leadRuns = sqliteTable(
  "lead_runs",
  {
    id: text("id").primaryKey(),
    run_started_at: integer("run_started_at", { mode: "timestamp_ms" })
      .notNull(),
    run_completed_at: integer("run_completed_at", { mode: "timestamp_ms" }),
    trigger: text("trigger", { enum: LEAD_RUN_TRIGGERS }).notNull(),
    manual_brief_text: text("manual_brief_text"),

    found_count: integer("found_count").notNull().default(0),
    dnc_filtered_count: integer("dnc_filtered_count").notNull().default(0),
    qualified_count: integer("qualified_count").notNull().default(0),
    drafted_count: integer("drafted_count").notNull().default(0),

    warmup_cap_at_run: integer("warmup_cap_at_run").notNull(),
    effective_cap_at_run: integer("effective_cap_at_run").notNull(),
    capped_reason: text("capped_reason"),

    error: text("error"),
    per_source_errors_json: text("per_source_errors_json", { mode: "json" }),
  },
  (t) => ({
    by_started: index("lead_runs_started_idx").on(t.run_started_at),
  }),
);

export type LeadRunRow = typeof leadRuns.$inferSelect;
export type LeadRunInsert = typeof leadRuns.$inferInsert;
