import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const RUNDOWN_SEQUENCE_TRACKS = ["melbourne", "non_melbourne"] as const;
export type RundownSequenceTrack = (typeof RUNDOWN_SEQUENCE_TRACKS)[number];

export const RUNDOWN_SEQUENCE_STATUSES = [
  "pending",
  "sent",
  "cancelled",
  "failed",
] as const;
export type RundownSequenceStatus = (typeof RUNDOWN_SEQUENCE_STATUSES)[number];

export const rundown_sequence_emails = sqliteTable(
  "rundown_sequence_emails",
  {
    id: text("id").primaryKey(),
    session_id: text("session_id").notNull(),
    candidate_id: text("candidate_id").notNull(),
    email_number: integer("email_number").notNull(),
    track: text("track", { enum: RUNDOWN_SEQUENCE_TRACKS }).notNull(),
    scheduled_task_id: text("scheduled_task_id"),

    status: text("status", { enum: RUNDOWN_SEQUENCE_STATUSES })
      .notNull()
      .default("pending"),

    // ── Generated content ──
    subject: text("subject"),
    body_html: text("body_html"),

    // ── Engagement tracking ──
    sent_at_ms: integer("sent_at_ms"),
    opened_at_ms: integer("opened_at_ms"),
    open_count: integer("open_count").notNull().default(0),
    clicked_at_ms: integer("clicked_at_ms"),
    clicked_links: text("clicked_links", { mode: "json" }).$type<string[]>(),
    reply_received_at_ms: integer("reply_received_at_ms"),
    reply_classification: text("reply_classification"),
    resend_message_id: text("resend_message_id"),

    // ── Cancellation ──
    cancelled_at_ms: integer("cancelled_at_ms"),
    cancel_reason: text("cancel_reason"),

    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_session: index("rundown_seq_session_idx").on(t.session_id),
    by_candidate: index("rundown_seq_candidate_idx").on(t.candidate_id),
    by_status: index("rundown_seq_status_idx").on(t.status, t.email_number),
    by_task: index("rundown_seq_task_idx").on(t.scheduled_task_id),
  }),
);

export type RundownSequenceEmailRow = typeof rundown_sequence_emails.$inferSelect;
export type RundownSequenceEmailInsert = typeof rundown_sequence_emails.$inferInsert;
