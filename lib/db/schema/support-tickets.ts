import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Support tickets raised via `reportIssue()` from any client-facing surface.
 * Owner: B1. Consumer: `/lite/admin/errors` triage dashboard.
 */
export const support_tickets = sqliteTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id"),
    surface: text("surface").notNull(),
    page_url: text("page_url").notNull(),
    description: text("description"),
    /** Sentry session replay URL — populated when replay SDK is available (post-B1). */
    session_replay_url: text("session_replay_url"),
    /** Sentry issue ID — set when sentry_enabled kill-switch is on. */
    sentry_issue_id: text("sentry_issue_id"),
    status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
    created_at_ms: integer("created_at_ms").notNull(),
    resolved_at_ms: integer("resolved_at_ms"),
  },
  (t) => ({
    by_status: index("support_tickets_status_idx").on(t.status, t.created_at_ms),
    by_user: index("support_tickets_user_idx").on(t.user_id),
  }),
);

export type SupportTicketRow = typeof support_tickets.$inferSelect;
export type SupportTicketInsert = typeof support_tickets.$inferInsert;
