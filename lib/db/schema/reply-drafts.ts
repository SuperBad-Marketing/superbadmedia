import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const REPLY_CLASSIFICATIONS = [
  "positive",
  "question",
  "objection",
  "negative",
  "auto_responder",
] as const;
export type ReplyClassificationType = (typeof REPLY_CLASSIFICATIONS)[number];

export const REPLY_DRAFT_STATUSES = [
  "pending_approval",
  "approved",
  "sent",
  "rejected",
] as const;
export type ReplyDraftStatus = (typeof REPLY_DRAFT_STATUSES)[number];

export const replyDrafts = sqliteTable(
  "reply_drafts",
  {
    id: text("id").primaryKey(),

    candidate_id: text("candidate_id").notNull(),
    in_reply_to_draft_id: text("in_reply_to_draft_id"),

    prospect_reply_text: text("prospect_reply_text").notNull(),
    prospect_reply_classification: text("prospect_reply_classification", {
      enum: REPLY_CLASSIFICATIONS,
    }).notNull(),

    subject: text("subject").notNull(),
    body_markdown: text("body_markdown").notNull(),

    model_used: text("model_used").notNull(),
    prompt_version: text("prompt_version").notNull(),
    generation_ms: integer("generation_ms"),
    drift_check_score: integer("drift_check_score"),
    drift_check_flagged: integer("drift_check_flagged", { mode: "boolean" })
      .notNull()
      .default(false),

    andy_nudge: text("andy_nudge"),

    status: text("status", { enum: REPLY_DRAFT_STATUSES })
      .notNull()
      .default("pending_approval"),
    approved_at_ms: integer("approved_at_ms"),
    approved_by: text("approved_by").references(() => user.id),
    sent_at_ms: integer("sent_at_ms"),

    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_candidate: index("reply_drafts_candidate_idx").on(t.candidate_id),
    by_status: index("reply_drafts_status_idx").on(t.status, t.created_at_ms),
  }),
);

export type ReplyDraftRow = typeof replyDrafts.$inferSelect;
export type ReplyDraftInsert = typeof replyDrafts.$inferInsert;
