CREATE TABLE IF NOT EXISTS `reply_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `candidate_id` text NOT NULL,
  `in_reply_to_draft_id` text,
  `prospect_reply_text` text NOT NULL,
  `prospect_reply_classification` text NOT NULL,
  `subject` text NOT NULL,
  `body_markdown` text NOT NULL,
  `model_used` text NOT NULL,
  `prompt_version` text NOT NULL,
  `generation_ms` integer,
  `drift_check_score` integer,
  `drift_check_flagged` integer NOT NULL DEFAULT 0,
  `andy_nudge` text,
  `status` text NOT NULL DEFAULT 'pending_approval',
  `approved_at_ms` integer,
  `approved_by` text REFERENCES `user`(`id`),
  `sent_at_ms` integer,
  `created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reply_drafts_candidate_idx` ON `reply_drafts` (`candidate_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reply_drafts_status_idx` ON `reply_drafts` (`status`, `created_at_ms`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `discount_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `candidate_id` text NOT NULL,
  `code` text NOT NULL,
  `tier` text NOT NULL,
  `original_price_cents` integer NOT NULL,
  `expires_at_ms` integer NOT NULL,
  `redeemed_at_ms` integer,
  `created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `discount_codes_code_unique` ON `discount_codes` (`code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `discount_codes_candidate_idx` ON `discount_codes` (`candidate_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `discount_codes_expiry_idx` ON `discount_codes` (`expires_at_ms`);
--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD COLUMN `quoted_session_price_cents` integer;
--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD COLUMN `quoted_production_price_cents` integer;
--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD COLUMN `reply_status` text;
--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD COLUMN `last_reply_at_ms` integer;
--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD COLUMN `reply_draft_id` text;
