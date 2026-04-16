import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { messages, NOTIFICATION_PRIORITIES } from "./messages";
import { user } from "./user";

/**
 * Shared notification record for the platform. Landed by UI-3 as the
 * output table for the Q10 notification triage classifier (spec §7.2).
 *
 * Extends beyond inbox — per spec §10.4 this table also carries SaaS
 * payment failures, Content Engine milestones, Daily Cockpit anomalies,
 * etc., once the shared dispatcher primitive ships. For now only the
 * inbox classifier writes here; `message_id` is therefore always set in
 * UI-3, but left nullable to match that future shape.
 *
 * `fired_transport` semantics (UI-3):
 *  - `"none"`     → silent by design; morning digest reads these.
 *  - `NULL`       → push/urgent classified, transport not yet fired —
 *                   consumed by the future dispatcher (UI-E slice of
 *                   spec §17) which updates the row to `"web_push"` or
 *                   `"pwa_push"` when it actually delivers.
 * Divergence from spec §5.1 (enum-only, non-nullable): deliberate —
 * spec assumes classifier + dispatcher ship together; BUILD_PLAN splits
 * them across UI-3 + UI-E, so the NULL state represents "queued but
 * not yet delivered". Resolved when UI-E lands.
 */
export const NOTIFICATION_TRANSPORTS = [
  "web_push",
  "pwa_push",
  "none",
] as const;
export type NotificationTransport = (typeof NOTIFICATION_TRANSPORTS)[number];

export const NOTIFICATION_CORRECTION_ACTIONS = [
  "user_opened",
  "user_corrected_up",
  "user_corrected_down",
] as const;
export type NotificationCorrectionAction =
  (typeof NOTIFICATION_CORRECTION_ACTIONS)[number];

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    message_id: text("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    priority: text("priority", { enum: NOTIFICATION_PRIORITIES }).notNull(),
    fired_transport: text("fired_transport", {
      enum: NOTIFICATION_TRANSPORTS,
    }),
    fired_at_ms: integer("fired_at_ms").notNull(),
    reason: text("reason").notNull(),
    correction_action: text("correction_action", {
      enum: NOTIFICATION_CORRECTION_ACTIONS,
    }),
    correction_at_ms: integer("correction_at_ms"),
  },
  (t) => ({
    by_user: index("notifications_user_idx").on(t.user_id, t.fired_at_ms),
    by_message: index("notifications_message_idx").on(t.message_id),
    by_priority: index("notifications_priority_idx").on(
      t.priority,
      t.fired_at_ms,
    ),
  }),
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;
