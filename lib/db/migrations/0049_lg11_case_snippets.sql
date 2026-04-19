-- LG-11: case_snippets table + autonomy graduation threshold 10→5 + settings keys
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
);

CREATE INDEX IF NOT EXISTS `case_snippets_status_vertical_idx` ON `case_snippets` (`status`, `vertical`, `created_at`);
CREATE INDEX IF NOT EXISTS `case_snippets_company_idx` ON `case_snippets` (`company_id`);

-- Autonomy graduation threshold: 10 → 5
UPDATE `autonomy_state` SET `graduation_threshold` = 5 WHERE `graduation_threshold` = 10;

-- Settings keys
INSERT OR IGNORE INTO `settings` (`key`, `value`, `description`) VALUES
  ('snippet.auto_approve_hours', '48', 'Hours before pending snippet auto-approves'),
  ('retargeting.meta_pixel_id', NULL, 'Meta Pixel ID for outreach click tracking'),
  ('retargeting.google_conversion_id', NULL, 'Google Ads conversion ID for outreach click tracking'),
  ('autonomy.graduation_threshold', '5', 'Clean approvals needed to unlock probation'),
  ('autonomy.minor_edit_char_threshold', '3', 'Max character diff to classify as minor edit'),
  ('autonomy.material_edit_ratio_threshold', '0.2', 'Body change ratio above which edit is material');
