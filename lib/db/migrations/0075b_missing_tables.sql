-- Repair: create tables that were applied via drizzle-kit push locally
-- but never had a migration file for production.

CREATE TABLE IF NOT EXISTS `video_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `video_type` text NOT NULL,
  `engine` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `initial_prompt` text NOT NULL,
  `resolved_prompt` text,
  `brief_json` text,
  `brand_source` text DEFAULT 'superbad' NOT NULL,
  `client_id` text,
  `ad_hoc_brand_json` text,
  `external_job_id` text,
  `model_used` text,
  `duration_sec` integer,
  `aspect_ratio` text,
  `credits_used` integer,
  `output_url` text,
  `thumbnail_url` text,
  `error_message` text,
  `created_at` integer NOT NULL,
  `queued_at` integer,
  `completed_at` integer,
  `generation_ms` integer,
  `content_studio_post_id` text
);
CREATE INDEX IF NOT EXISTS `video_jobs_status_idx` ON `video_jobs` (`status`,`created_at`);
CREATE INDEX IF NOT EXISTS `video_jobs_client_idx` ON `video_jobs` (`client_id`);

CREATE TABLE IF NOT EXISTS `invite_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `candidate_id` text NOT NULL,
  `role_brief_id` text,
  `subject` text NOT NULL,
  `body` text NOT NULL,
  `confidence` real NOT NULL,
  `drift_check_score` real,
  `drift_check_pass` integer,
  `status` text DEFAULT 'pending_review' NOT NULL,
  `hold_reason` text,
  `sent_at_ms` integer,
  `email_message_id` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`),
  FOREIGN KEY (`role_brief_id`) REFERENCES `role_briefs`(`id`)
);
CREATE INDEX IF NOT EXISTS `invite_drafts_candidate_idx` ON `invite_drafts` (`candidate_id`);
CREATE INDEX IF NOT EXISTS `invite_drafts_role_brief_idx` ON `invite_drafts` (`role_brief_id`);
CREATE INDEX IF NOT EXISTS `invite_drafts_status_idx` ON `invite_drafts` (`status`,`created_at_ms`);
