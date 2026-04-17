import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Single-row config table for the warmup ramp. One row for the single
 * sender in v1. Multi-sender retrofit documented in spec §18.7.
 *
 * Owner: Lead Generation spec §4.7.
 * Read/write path: `enforceWarmupCap()` in `lib/lead-gen/warmup.ts`
 * is the ONLY function that reads or writes this table (§12.I).
 */

export const resendWarmupState = sqliteTable("resend_warmup_state", {
  id: text("id").primaryKey().default("default"),
  sender_local_part: text("sender_local_part").notNull(),
  sender_domain: text("sender_domain").notNull(),
  started_at: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  current_week: integer("current_week").notNull().default(1),
  daily_cap: integer("daily_cap").notNull().default(5),
  sent_today: integer("sent_today").notNull().default(0),
  sent_today_reset_at: integer("sent_today_reset_at", {
    mode: "timestamp_ms",
  }).notNull(),
  manual_override: integer("manual_override", { mode: "boolean" })
    .notNull()
    .default(false),
});

export type ResendWarmupStateRow = typeof resendWarmupState.$inferSelect;
export type ResendWarmupStateInsert = typeof resendWarmupState.$inferInsert;
