CREATE TABLE IF NOT EXISTS `expenses` (
  `id` text PRIMARY KEY NOT NULL,
  `amount_inc_gst` integer NOT NULL,
  `gst_amount` integer,
  `category` text NOT NULL,
  `vendor` text NOT NULL,
  `description` text,
  `expense_date` text NOT NULL,
  `source` text NOT NULL DEFAULT 'manual',
  `source_ref` text,
  `status` text NOT NULL DEFAULT 'confirmed',
  `manual_override` integer NOT NULL DEFAULT 0,
  `receipt_path` text,
  `candidate_id` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expenses_date_idx` ON `expenses` (`expense_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expenses_category_date_idx` ON `expenses` (`category`, `expense_date`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `expenses_source_ref_idx` ON `expenses` (`source`, `source_ref`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recurring_expenses` (
  `id` text PRIMARY KEY NOT NULL,
  `vendor` text NOT NULL,
  `category` text NOT NULL,
  `amount_inc_gst` integer NOT NULL,
  `gst_amount` integer,
  `frequency` text NOT NULL,
  `next_fire_date` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `finance_snapshots` (
  `snapshot_date` text PRIMARY KEY NOT NULL,
  `metrics_json` text,
  `projection_json` text,
  `narrative_text` text,
  `narrative_generated_at_ms` integer,
  `narrative_callouts` text,
  `stale_flags` text,
  `created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `compliance_milestones` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `period_label` text NOT NULL,
  `filed_at_ms` integer NOT NULL,
  `note` text
);