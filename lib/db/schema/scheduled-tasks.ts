import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Platform-wide deferred work primitive. Owned by Quote Builder's spec
 * (§5.4) but seeded platform-wide from Phase 5 A6 because multiple specs
 * register handlers. Every new task type extends `SCHEDULED_TASK_TYPES`
 * and registers a handler in `lib/scheduled-tasks/worker.ts`.
 */
export const SCHEDULED_TASK_TYPES = [
  // --- Quote Builder (8) ---
  "quote_expire",
  "quote_reminder_3d",
  "quote_pdf_render",
  "quote_email_send",
  "manual_invoice_generate",
  "manual_invoice_send",
  "subscription_pause_resume_reminder",
  "subscription_pause_resume",
  // --- Branded Invoicing (1) ---
  "invoice_overdue_reminder",
  // --- Client Context Engine (2) ---
  "context_summary_regenerate",
  "context_action_item_extract",
  // --- Content Engine (6) ---
  "content_keyword_research",
  "content_generate_draft",
  "content_fan_out",
  "content_newsletter_send",
  "content_ranking_snapshot",
  "content_outreach_match",
  // --- Client Management (2) ---
  "client_data_export",
  "intro_funnel_portal_migration",
  // --- Daily Cockpit (1) ---
  "cockpit_brief_regenerate",
  // --- Unified Inbox (6) ---
  "inbox_draft_reply",
  "inbox_draft_generate",
  "inbox_hygiene_purge",
  "inbox_morning_digest",
  "inbox_graph_subscription_renew",
  "inbox_initial_import",
  "inbox_ticket_auto_resolve_idle",
  // --- SaaS Subscription Billing (4) ---
  "saas_data_loss_warning",
  "saas_annual_renewal_reminder",
  "saas_card_expiry_warning",
  "saas_subscription_usage_reset",
  "saas_subscription_tier_downgrade_apply",
  // --- Cost & Usage Observatory (5) ---
  "cost_anomaly_detector_hard",
  "cost_anomaly_detector_rate",
  "cost_anomaly_detector_learned",
  "cost_anomaly_diagnose",
  "weekly_digest_send",
  // --- Setup Wizards (3) ---
  "wizard_resume_nudge",
  "wizard_expiry_warn",
  "wizard_expire",
  // --- Onboarding + Segmentation (2) ---
  "onboarding_nudge_email",
  "practical_setup_reminder_email",
  // --- Finance Dashboard (6) ---
  "finance_snapshot_take",
  "finance_narrative_regenerate",
  "finance_observatory_rollup",
  "finance_stripe_fee_rollup",
  "recurring_expense_book",
  "finance_export_generate",
] as const;

export type ScheduledTaskType = (typeof SCHEDULED_TASK_TYPES)[number];

export const SCHEDULED_TASK_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
] as const;

export type ScheduledTaskStatus = (typeof SCHEDULED_TASK_STATUSES)[number];

export const scheduled_tasks = sqliteTable(
  "scheduled_tasks",
  {
    id: text("id").primaryKey(),
    task_type: text("task_type", { enum: SCHEDULED_TASK_TYPES }).notNull(),
    run_at_ms: integer("run_at_ms").notNull(),
    payload: text("payload", { mode: "json" }),
    status: text("status", { enum: SCHEDULED_TASK_STATUSES })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    last_attempted_at_ms: integer("last_attempted_at_ms"),
    last_error: text("last_error"),
    idempotency_key: text("idempotency_key").unique(),
    created_at_ms: integer("created_at_ms").notNull(),
    done_at_ms: integer("done_at_ms"),
    reclaimed_at_ms: integer("reclaimed_at_ms"),
  },
  (t) => ({
    by_due: index("scheduled_tasks_due_idx").on(t.status, t.run_at_ms),
    by_type: index("scheduled_tasks_type_idx").on(t.task_type, t.status),
  }),
);

export type ScheduledTaskRow = typeof scheduled_tasks.$inferSelect;
export type ScheduledTaskInsert = typeof scheduled_tasks.$inferInsert;

/**
 * Thin observability primitive — the worker writes here every tick. Admin
 * cockpit renders a red banner when `now() - last_tick_at_ms > 5 minutes`.
 */
export const worker_heartbeats = sqliteTable("worker_heartbeats", {
  worker_name: text("worker_name").primaryKey(),
  last_tick_at_ms: integer("last_tick_at_ms").notNull(),
  last_tick_tasks_processed: integer("last_tick_tasks_processed").notNull(),
});

export type WorkerHeartbeatRow = typeof worker_heartbeats.$inferSelect;
