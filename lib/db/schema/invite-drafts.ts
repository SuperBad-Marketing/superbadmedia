import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { candidates } from "./candidates";
import { role_briefs } from "./role-briefs";

export const INVITE_DRAFT_STATUSES = [
  "pending_review",
  "sent",
  "expired",
] as const;
export type InviteDraftStatus = (typeof INVITE_DRAFT_STATUSES)[number];

export const INVITE_HOLD_REASONS = [
  "low_confidence",
  "daily_cap",
  "candidate_throttle",
  "cross_role_cap",
  "drift_check_failed",
] as const;
export type InviteHoldReason = (typeof INVITE_HOLD_REASONS)[number];

export const invite_drafts = sqliteTable(
  "invite_drafts",
  {
    id: text("id").primaryKey(),
    candidate_id: text("candidate_id")
      .notNull()
      .references(() => candidates.id),
    role_brief_id: text("role_brief_id").references(() => role_briefs.id),

    subject: text("subject").notNull(),
    body: text("body").notNull(),
    confidence: real("confidence").notNull(),

    drift_check_score: real("drift_check_score"),
    drift_check_pass: integer("drift_check_pass", { mode: "boolean" }),

    status: text("status", { enum: INVITE_DRAFT_STATUSES })
      .notNull()
      .default("pending_review"),
    hold_reason: text("hold_reason", { enum: INVITE_HOLD_REASONS }),

    sent_at_ms: integer("sent_at_ms"),
    email_message_id: text("email_message_id"),

    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_candidate: index("invite_drafts_candidate_idx").on(t.candidate_id),
    by_role_brief: index("invite_drafts_role_brief_idx").on(t.role_brief_id),
    by_status: index("invite_drafts_status_idx").on(
      t.status,
      t.created_at_ms,
    ),
  }),
);

export type InviteDraftRow = typeof invite_drafts.$inferSelect;
export type InviteDraftInsert = typeof invite_drafts.$inferInsert;
