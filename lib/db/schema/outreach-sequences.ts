import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

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
    candidate_id: text("candidate_id"),
    deal_id: text("deal_id"),
    track: text("track", { enum: ["saas", "retainer"] }).notNull(),

    status: text("status", { enum: OUTREACH_SEQUENCE_STATUSES })
      .notNull()
      .default("active"),
    stopped_reason: text("stopped_reason"),

    consecutive_non_engagements: integer("consecutive_non_engagements")
      .notNull()
      .default(0),
    cutoff_threshold: integer("cutoff_threshold").notNull().default(3),

    next_touch_due_at: integer("next_touch_due_at", { mode: "timestamp_ms" }),
    last_touch_at: integer("last_touch_at", { mode: "timestamp_ms" }),
    touches_sent: integer("touches_sent").notNull().default(0),

    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    by_candidate: index("outreach_sequences_candidate_idx").on(t.candidate_id),
    by_deal: index("outreach_sequences_deal_idx").on(t.deal_id),
    by_status: index("outreach_sequences_status_idx").on(
      t.status,
      t.next_touch_due_at,
    ),
  }),
);

export type OutreachSequenceRow = typeof outreachSequences.$inferSelect;
export type OutreachSequenceInsert = typeof outreachSequences.$inferInsert;
