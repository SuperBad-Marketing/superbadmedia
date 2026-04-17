import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./user";

/**
 * Every Claude-generated draft for a cold outreach touch. Lives here
 * through approval, mutates into an `outreach_sends` row on
 * approval + send.
 *
 * Owner: Lead Generation spec §4.2.
 * Consumers: approval queue UI, autonomy state machine.
 */

export const OUTREACH_TOUCH_KINDS = [
  "first_touch",
  "follow_up",
  "stale_nudge",
] as const;
export type OutreachTouchKind = (typeof OUTREACH_TOUCH_KINDS)[number];

export const OUTREACH_DRAFT_STATUSES = [
  "pending_approval",
  "approved_queued",
  "sent",
  "rejected",
  "superseded",
  "expired",
] as const;
export type OutreachDraftStatus = (typeof OUTREACH_DRAFT_STATUSES)[number];

export const OUTREACH_APPROVAL_KINDS = [
  "manual",
  "auto_send",
  "nudged_manual",
] as const;
export type OutreachApprovalKind = (typeof OUTREACH_APPROVAL_KINDS)[number];

export const outreachDrafts = sqliteTable(
  "outreach_drafts",
  {
    id: text("id").primaryKey(),

    // What this draft is for
    candidate_id: text("candidate_id"),
    deal_id: text("deal_id"),
    sequence_id: text("sequence_id"),
    touch_kind: text("touch_kind", {
      enum: OUTREACH_TOUCH_KINDS,
    }).notNull(),
    touch_index: integer("touch_index").notNull(),

    // Draft content
    subject: text("subject").notNull(),
    body_markdown: text("body_markdown").notNull(),

    // Generation metadata
    model_used: text("model_used").notNull(),
    prompt_version: text("prompt_version").notNull(),
    generation_ms: integer("generation_ms"),
    drift_check_score: integer("drift_check_score"),
    drift_check_regenerated: integer("drift_check_regenerated", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    drift_check_flagged: integer("drift_check_flagged", { mode: "boolean" })
      .notNull()
      .default(false),

    // Approval state
    status: text("status", { enum: OUTREACH_DRAFT_STATUSES })
      .notNull()
      .default("pending_approval"),
    approved_at: integer("approved_at", { mode: "timestamp_ms" }),
    approved_by: text("approved_by").references(() => user.id),
    approval_kind: text("approval_kind", { enum: OUTREACH_APPROVAL_KINDS }),

    // Nudge chat (reusing Content Engine rejection-chat primitive)
    nudge_thread_json: text("nudge_thread_json", { mode: "json" }),

    created_at: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    by_candidate: index("outreach_drafts_candidate_idx").on(t.candidate_id),
    by_deal: index("outreach_drafts_deal_idx").on(t.deal_id),
    by_sequence: index("outreach_drafts_sequence_idx").on(t.sequence_id),
    by_status: index("outreach_drafts_status_idx").on(t.status, t.created_at),
  }),
);

export type OutreachDraftRow = typeof outreachDrafts.$inferSelect;
export type OutreachDraftInsert = typeof outreachDrafts.$inferInsert;
