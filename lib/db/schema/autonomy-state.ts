import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Per-track streak tracking + graduation state for the earned-autonomy
 * system (spec §9.2).
 *
 * Owner: Lead Generation spec §4.8.
 * Write path: `transitionAutonomyState()` in `lib/lead-gen/autonomy.ts`
 * is the ONLY function that mutates this table (§12.F).
 */

export const AUTONOMY_MODES = [
  "manual",
  "probation",
  "auto_send",
  "circuit_broken",
] as const;
export type AutonomyMode = (typeof AUTONOMY_MODES)[number];

export const autonomyState = sqliteTable("autonomy_state", {
  track: text("track", { enum: ["saas", "retainer"] }).primaryKey(),

  mode: text("mode", { enum: AUTONOMY_MODES }).notNull().default("manual"),

  // Streak counter toward graduation
  clean_approval_streak: integer("clean_approval_streak")
    .notNull()
    .default(0),
  graduation_threshold: integer("graduation_threshold")
    .notNull()
    .default(10),

  // Probation window
  probation_sends_remaining: integer("probation_sends_remaining"),
  probation_threshold: integer("probation_threshold").notNull().default(5),

  // Maintenance standard (rolling 20-send window)
  rolling_window_size: integer("rolling_window_size").notNull().default(20),
  maintenance_floor_pct: integer("maintenance_floor_pct")
    .notNull()
    .default(80),

  // Circuit breaker
  circuit_broken_at: integer("circuit_broken_at", { mode: "timestamp_ms" }),
  circuit_broken_reason: text("circuit_broken_reason"),

  last_graduated_at: integer("last_graduated_at", { mode: "timestamp_ms" }),
  last_demoted_at: integer("last_demoted_at", { mode: "timestamp_ms" }),
});

export type AutonomyStateRow = typeof autonomyState.$inferSelect;
export type AutonomyStateInsert = typeof autonomyState.$inferInsert;
