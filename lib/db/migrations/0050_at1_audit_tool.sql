CREATE TABLE IF NOT EXISTS `audit_submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `business_name` text NOT NULL,
  `website_url` text NOT NULL,
  `domain` text NOT NULL,
  `contact_name` text NOT NULL,
  `contact_email` text NOT NULL,
  `instagram_handle` text,
  `facebook_page_url` text,
  `youtube_channel` text,
  `google_maps_url` text,
  `viability_profile_json` text NOT NULL,
  `overall_score` integer NOT NULL,
  `overall_grade` text NOT NULL,
  `category_scores_json` text NOT NULL,
  `explanations_json` text,
  `pdf_generated_at` integer,
  `pdf_emailed_at` integer,
  `deal_id` text REFERENCES `deals`(`id`),
  `company_id` text REFERENCES `companies`(`id`),
  `contact_id` text REFERENCES `contacts`(`id`),
  `followup_draft_id` text,
  `ip_hash` text NOT NULL,
  `retry_pending` integer NOT NULL DEFAULT 0,
  `retry_signals_json` text,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_submissions_domain_idx` ON `audit_submissions` (`domain`, `created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_submissions_email_idx` ON `audit_submissions` (`contact_email`, `created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_submissions_company_idx` ON `audit_submissions` (`company_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_rate_limits` (
  `ip_hash` text PRIMARY KEY NOT NULL,
  `submission_count` integer NOT NULL DEFAULT 1,
  `window_start` integer NOT NULL
);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('audit.daily_cap', '50', 'integer', 'Max audits per day across all visitors', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('audit.rate_limit_per_ip', '3', 'integer', 'Max submissions per IP per 24h', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('audit.scoring_boost', '8', 'integer', 'Scoring boost for self-auditors in daily search', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('audit.profile_reuse_days', '90', 'integer', 'Days before audit viability profile is stale for lead gen reuse', 0);