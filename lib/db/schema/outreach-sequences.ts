import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { deals } from "./deals";

/**
 * One per active contact thread. Holds the state machine for
 * engagement-gated continuation (spec §11).
 *
 * Owner: Lead Generation spec §4.4.
 * Consumers: sequence scheduler, engagement tier evaluator.
 */

export const OUTREACH_SEQUENCE_STATUSES = [
  "active",
  "paused",
  "stopped_engagement",
  "stopped_reply",
  "stopped_bounce",
  "stopped_unsubscribe",
  "stopped_manual",
] as const;
export type OutreachSequenceStatus =
  (typeof OUTREACH_SEQUENCE_STATUSES)[number];

export const outreachSequences = sqliteTable(
  "outreach_sequences",
  {
    id: text("id").primaryKey(),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id),
    track: text("track", { enum: ["saas", "retainer"] }).notNull(),

    status: text("status", { enum: OUTREACH_SEQUENCE_STATUSES })
      .notNull()
      .default("active"),
    stopped_reason: text("stopped_reason"),

    // Engagement cutoff counter — spec Q9
    consecutive_non_engagements: integer("consecutive_non_engagements")
      .notNull()
      .default(0),
    cutoff_threshold: integer("cutoff_threshold").notNull().default(3),

    // Scheduling
    next_touch_due_at: integer("next_touch_due_at", { mode: "timestamp_ms" }),
    last_touch_at: integer("last_touch_at", { mode: "timestamp_ms" }),
    touches_sent: integer("touches_sent").notNull().default(0),

    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    by_deal: index("outreach_sequences_deal_idx").on(t.deal_id),
    by_status: index("outreach_sequences_status_idx").on(
      t.status,
      t.next_touch_due_at,
    ),
  }),
);

export type OutreachSequenceRow = typeof outreachSequences.$inferSelect;
export type OutreachSequenceInsert = typeof outreachSequences.$inferInsert;
