CREATE TABLE IF NOT EXISTS `case_snippets` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL REFERENCES `companies`(`id`),
  `milestone_type` text NOT NULL,
  `vertical` text NOT NULL,
  `location` text,
  `headline` text NOT NULL,
  `paragraph` text NOT NULL,
  `metrics_line` text,
  `status` text NOT NULL DEFAULT 'pending',
  `approved_at` integer,
  `auto_approved` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `case_snippets_status_vertical_idx` ON `case_snippets` (`status`, `vertical`, `created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `case_snippets_company_idx` ON `case_snippets` (`company_id`);--> statement-breakpoint
UPDATE `autonomy_state` SET `graduation_threshold` = 5 WHERE `graduation_threshold` = 10;--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('snippet.auto_approve_hours', '48', 'integer', 'Hours before pending snippet auto-approves', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('retargeting.meta_pixel_id', '', 'string', 'Meta Pixel ID for outreach click tracking', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('retargeting.google_conversion_id', '', 'string', 'Google Ads conversion ID for outreach click tracking', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('autonomy.graduation_threshold', '5', 'integer', 'Clean approvals needed to unlock probation', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('autonomy.minor_edit_char_threshold', '3', 'integer', 'Max character diff to classify as minor edit', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('autonomy.material_edit_ratio_threshold', '0.2', 'decimal', 'Body change ratio above which edit is material', 0);