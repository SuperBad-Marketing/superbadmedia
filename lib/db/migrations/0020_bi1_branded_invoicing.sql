-- BI-1: Branded Invoicing schema foundation.
-- Source of truth: docs/specs/branded-invoicing.md §5.
-- Additive only. Reversible by:
--
--   DROP TABLE invoices;
--   ALTER TABLE companies DROP COLUMN payment_terms_days;
--
-- scheduled_tasks.task_type + activity_log.kind enum additions for
-- Branded Invoicing landed earlier (enums are schema-level TypeScript
-- unions — the SQL `text` column accepts any string).

ALTER TABLE `companies` ADD COLUMN `payment_terms_days` integer NOT NULL DEFAULT 14;--> statement-breakpoint

CREATE TABLE `invoices` (
  `id` text PRIMARY KEY NOT NULL,
  `invoice_number` text NOT NULL UNIQUE,
  `deal_id` text NOT NULL REFERENCES `deals`(`id`) ON DELETE CASCADE,
  `company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `quote_id` text REFERENCES `quotes`(`id`) ON DELETE SET NULL,
  `token` text NOT NULL UNIQUE,
  `status` text NOT NULL DEFAULT 'draft',
  `cycle_index` integer,
  `cycle_start_ms` integer,
  `cycle_end_ms` integer,
  `issue_date_ms` integer NOT NULL,
  `due_at_ms` integer NOT NULL,
  `paid_at_ms` integer,
  `paid_via` text,
  `stripe_payment_intent_id` text,
  `total_cents_inc_gst` integer NOT NULL,
  `total_cents_ex_gst` integer NOT NULL,
  `gst_cents` integer NOT NULL,
  `gst_applicable` integer NOT NULL,
  `line_items_json` text NOT NULL,
  `scope_summary` text,
  `supersedes_invoice_id` text REFERENCES `invoices`(`id`) ON DELETE SET NULL,
  `thread_message_id` text,
  `reminder_count` integer NOT NULL DEFAULT 0,
  `last_reminder_at_ms` integer,
  `auto_send_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `invoices_company_status_idx` ON `invoices` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_due_idx` ON `invoices` (`due_at_ms`,`status`);--> statement-breakpoint
CREATE INDEX `invoices_deal_idx` ON `invoices` (`deal_id`);--> statement-breakpoint

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('invoice.review_window_days', '3', 'integer', 'Days between manual_invoice_generate (draft creation + cockpit notification) and manual_invoice_send (auto-dispatch). Spec Q21/Q22.', 0),
  ('invoice.overdue_reminder_days', '3', 'integer', 'Days after due_at before the automated overdue reminder fires. Spec Q18.', 0);
