-- LG-1: Lead Generation data model — 8 new tables + settings keys + contacts enum extension

CREATE TABLE IF NOT EXISTS `lead_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `run_started_at` integer NOT NULL,
  `run_completed_at` integer,
  `trigger` text NOT NULL,
  `manual_brief_text` text,
  `found_count` integer NOT NULL DEFAULT 0,
  `dnc_filtered_count` integer NOT NULL DEFAULT 0,
  `qualified_count` integer NOT NULL DEFAULT 0,
  `drafted_count` integer NOT NULL DEFAULT 0,
  `warmup_cap_at_run` integer NOT NULL,
  `effective_cap_at_run` integer NOT NULL,
  `capped_reason` text,
  `error` text,
  `per_source_errors_json` text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_runs_started_idx` ON `lead_runs` (`run_started_at`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `lead_candidates` (
  `id` text PRIMARY KEY NOT NULL,
  `company_name` text NOT NULL,
  `domain` text,
  `contact_email` text,
  `contact_name` text,
  `contact_role` text,
  `email_confidence` text,
  `viability_profile_json` text NOT NULL,
  `saas_score` integer NOT NULL,
  `retainer_score` integer NOT NULL,
  `qualified_track` text NOT NULL,
  `scoring_debug_json` text,
  `soft_adjustment` integer NOT NULL DEFAULT 0,
  `soft_adjustment_rationale` text,
  `lead_run_id` text NOT NULL,
  `sourced_from` text NOT NULL,
  `pending_draft_id` text,
  `promoted_to_deal_id` text,
  `promoted_at` integer,
  `skipped_at` integer,
  `skipped_reason` text,
  `reactive_adjustment` integer NOT NULL DEFAULT 0,
  `reactive_adjustment_json` text,
  `rescored_at` integer,
  `rescore_count` integer NOT NULL DEFAULT 0,
  `below_floor_after_rescore` integer NOT NULL DEFAULT 0,
  `track_change_used` integer NOT NULL DEFAULT 0,
  `previous_track` text,
  `track_changed_at` integer,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_candidates_run_idx` ON `lead_candidates` (`lead_run_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_candidates_track_idx` ON `lead_candidates` (`qualified_track`, `created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_candidates_domain_idx` ON `lead_candidates` (`domain`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_candidates_promoted_idx` ON `lead_candidates` (`promoted_to_deal_id`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `outreach_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `candidate_id` text,
  `deal_id` text,
  `sequence_id` text,
  `touch_kind` text NOT NULL,
  `touch_index` integer NOT NULL,
  `subject` text NOT NULL,
  `body_markdown` text NOT NULL,
  `model_used` text NOT NULL,
  `prompt_version` text NOT NULL,
  `generation_ms` integer,
  `drift_check_score` integer,
  `drift_check_regenerated` integer NOT NULL DEFAULT 0,
  `drift_check_flagged` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'pending_approval',
  `approved_at` integer,
  `approved_by` text REFERENCES `user`(`id`),
  `approval_kind` text,
  `nudge_thread_json` text,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_drafts_candidate_idx` ON `outreach_drafts` (`candidate_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_drafts_deal_idx` ON `outreach_drafts` (`deal_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_drafts_sequence_idx` ON `outreach_drafts` (`sequence_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_drafts_status_idx` ON `outreach_drafts` (`status`, `created_at`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `outreach_sends` (
  `id` text PRIMARY KEY NOT NULL,
  `draft_id` text NOT NULL REFERENCES `outreach_drafts`(`id`),
  `sequence_id` text NOT NULL,
  `deal_id` text NOT NULL,
  `resend_message_id` text NOT NULL UNIQUE,
  `sent_at` integer NOT NULL,
  `first_opened_at` integer,
  `open_count` integer NOT NULL DEFAULT 0,
  `first_open_dwell_sec` integer,
  `first_clicked_at` integer,
  `click_count` integer NOT NULL DEFAULT 0,
  `replied_at` integer,
  `bounced_at` integer,
  `bounce_kind` text,
  `unsubscribed_at` integer,
  `engagement_tier` integer
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_sends_sequence_idx` ON `outreach_sends` (`sequence_id`, `sent_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_sends_deal_idx` ON `outreach_sends` (`deal_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_sends_resend_idx` ON `outreach_sends` (`resend_message_id`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `outreach_sequences` (
  `id` text PRIMARY KEY NOT NULL,
  `deal_id` text NOT NULL REFERENCES `deals`(`id`),
  `track` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `stopped_reason` text,
  `consecutive_non_engagements` integer NOT NULL DEFAULT 0,
  `cutoff_threshold` integer NOT NULL DEFAULT 3,
  `next_touch_due_at` integer,
  `last_touch_at` integer,
  `touches_sent` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_sequences_deal_idx` ON `outreach_sequences` (`deal_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `outreach_sequences_status_idx` ON `outreach_sequences` (`status`, `next_touch_due_at`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `dnc_emails` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `reason` text,
  `source` text NOT NULL,
  `added_at` integer NOT NULL,
  `added_by` text REFERENCES `user`(`id`)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dnc_emails_email_idx` ON `dnc_emails` (`email`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `dnc_domains` (
  `id` text PRIMARY KEY NOT NULL,
  `domain` text NOT NULL UNIQUE,
  `reason` text,
  `added_at` integer NOT NULL,
  `added_by` text NOT NULL REFERENCES `user`(`id`)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dnc_domains_domain_idx` ON `dnc_domains` (`domain`);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `resend_warmup_state` (
  `id` text PRIMARY KEY NOT NULL DEFAULT 'default',
  `sender_local_part` text NOT NULL,
  `sender_domain` text NOT NULL,
  `started_at` integer NOT NULL,
  `current_week` integer NOT NULL DEFAULT 1,
  `daily_cap` integer NOT NULL DEFAULT 5,
  `sent_today` integer NOT NULL DEFAULT 0,
  `sent_today_reset_at` integer NOT NULL,
  `manual_override` integer NOT NULL DEFAULT 0
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `autonomy_state` (
  `track` text PRIMARY KEY NOT NULL,
  `mode` text NOT NULL DEFAULT 'manual',
  `clean_approval_streak` integer NOT NULL DEFAULT 0,
  `graduation_threshold` integer NOT NULL DEFAULT 10,
  `probation_sends_remaining` integer,
  `probation_threshold` integer NOT NULL DEFAULT 5,
  `rolling_window_size` integer NOT NULL DEFAULT 20,
  `maintenance_floor_pct` integer NOT NULL DEFAULT 80,
  `circuit_broken_at` integer,
  `circuit_broken_reason` text,
  `last_graduated_at` integer,
  `last_demoted_at` integer
);--> statement-breakpoint

-- Seed autonomy_state rows for both tracks
INSERT OR IGNORE INTO `autonomy_state` (`track`, `mode`) VALUES ('saas', 'manual');--> statement-breakpoint
INSERT OR IGNORE INTO `autonomy_state` (`track`, `mode`) VALUES ('retainer', 'manual');--> statement-breakpoint

-- Lead Generation settings keys (per BUILD_PLAN Wave 13)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.daily_search_enabled', 'false', 'boolean', 'Enable the daily 3am Lead Gen search run', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.daily_max_per_day', '8', 'integer', 'Max new prospects per daily run (before warmup clamp)', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.dedup_window_days', '90', 'integer', 'Days to look back for candidate deduplication', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.location_radius_km', '25', 'integer', 'Search radius in km from location centre', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.location_centre', 'Melbourne', 'string', 'Location centre for search radius', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.category', '', 'string', 'Optional category filter for Google Maps (e.g. cafes, dental clinics)', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.standing_brief', '', 'string', 'Standing brief text fed to Claude draft generator and search queries', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.run_time', '03:00', 'string', 'Daily search run time (Melbourne local, HH:MM)', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('lead_generation.auto_send_delay_minutes', '15', 'integer', 'Delay before auto-send in probation/auto_send mode', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('warmup.week_one_cap', '5', 'integer', 'Warmup ramp: daily cap during week 1', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('warmup.week_two_cap', '10', 'integer', 'Warmup ramp: daily cap during week 2', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('warmup.week_three_cap', '15', 'integer', 'Warmup ramp: daily cap during week 3', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('warmup.week_four_cap', '20', 'integer', 'Warmup ramp: daily cap during week 4', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('warmup.graduated_cap', '30', 'integer', 'Warmup ramp: daily cap after week 4 (graduated)', 0);