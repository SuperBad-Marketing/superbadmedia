CREATE TABLE IF NOT EXISTS `briefs` (
  `id` text PRIMARY KEY NOT NULL,
  `reference_number` text NOT NULL,
  `brief_type` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `source` text NOT NULL,
  `business_name` text NOT NULL,
  `contact_name` text NOT NULL,
  `contact_email` text NOT NULL,
  `company_id` text REFERENCES `companies`(`id`) ON DELETE SET NULL,
  `match_confidence` integer,
  `match_method` text,
  `matched_at_ms` integer,
  `matched_by` text,
  `description` text NOT NULL,
  `delivery_date_ms` integer NOT NULL,
  `project_title` text,
  `brief_kind` text,
  `style_references` text,
  `key_messages` text,
  `target_audience` text,
  `deliverables_breakdown` text,
  `location_details` text,
  `talent_notes` text,
  `budget_range` text,
  `additional_notes` text,
  `attachments_json` text DEFAULT '[]',
  `auto_task_id` text REFERENCES `tasks`(`id`) ON DELETE SET NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `briefs_reference_number_unique` ON `briefs` (`reference_number`);
CREATE INDEX IF NOT EXISTS `briefs_company_idx` ON `briefs` (`company_id`);
CREATE INDEX IF NOT EXISTS `briefs_status_idx` ON `briefs` (`status`);
CREATE INDEX IF NOT EXISTS `briefs_delivery_idx` ON `briefs` (`delivery_date_ms`);
CREATE INDEX IF NOT EXISTS `briefs_reference_idx` ON `briefs` (`reference_number`);

CREATE TABLE IF NOT EXISTS `brief_task_links` (
  `id` text PRIMARY KEY NOT NULL,
  `brief_id` text NOT NULL REFERENCES `briefs`(`id`) ON DELETE CASCADE,
  `task_id` text NOT NULL REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  `created_at_ms` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `brief_task_links_unique_idx` ON `brief_task_links` (`brief_id`, `task_id`);
CREATE INDEX IF NOT EXISTS `brief_task_links_brief_idx` ON `brief_task_links` (`brief_id`);
CREATE INDEX IF NOT EXISTS `brief_task_links_task_idx` ON `brief_task_links` (`task_id`);
