CREATE TABLE `role_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`role_name` text NOT NULL,
	`engagement_type` text NOT NULL DEFAULT 'contractor',
	`status` text NOT NULL DEFAULT 'draft',
	`rate_min_aud` integer,
	`rate_max_aud` integer,
	`rate_unit` text,
	`target_hours_per_week` integer,
	`location_pref_city` text,
	`remote_ok` integer NOT NULL DEFAULT 1,
	`open_count` integer NOT NULL DEFAULT 1,
	`reference_urls_json` text,
	`reference_signals_json` text,
	`style_summary` text,
	`extracted_tags_json` text,
	`style_do_list_json` text,
	`style_avoid_list_json` text,
	`discovery_search_hints_json` text,
	`andy_overrides` text,
	`last_regenerated_at_ms` integer,
	`last_discovery_run_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `role_briefs_status_idx` ON `role_briefs` (`status`);
--> statement-breakpoint
CREATE INDEX `role_briefs_engagement_type_idx` ON `role_briefs` (`engagement_type`);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`role_brief_id` text REFERENCES `role_briefs`(`id`),
	`stage` text NOT NULL,
	`stage_before_archive` text,
	`source` text NOT NULL,
	`discovery_source` text,
	`engagement_type` text NOT NULL DEFAULT 'contractor',
	`name` text NOT NULL,
	`email` text,
	`location_city` text,
	`portfolio_urls_json` text,
	`rate_expectation_aud` integer,
	`rate_expectation_unit` text,
	`availability_hours_per_week` integer,
	`available_from_ms` integer,
	`application_followup_question` text,
	`application_followup_reply` text,
	`followup_status` text,
	`portfolio_signal_json` text,
	`portfolio_signal_fetched_at_ms` integer,
	`brief_match_score` real,
	`bench_status` text,
	`paused_until_ms` integer,
	`hourly_rate_aud` integer,
	`weekly_capacity_hours` integer,
	`onboarding_completed_at_ms` integer,
	`abn` text,
	`legal_name` text,
	`agreement_signed_at_ms` integer,
	`bank_details` text,
	`archived_at_ms` integer,
	`first_seen_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `candidates_role_brief_idx` ON `candidates` (`role_brief_id`);
--> statement-breakpoint
CREATE INDEX `candidates_stage_idx` ON `candidates` (`stage`, `updated_at_ms`);
--> statement-breakpoint
CREATE INDEX `candidates_email_idx` ON `candidates` (`email`);
--> statement-breakpoint
CREATE INDEX `candidates_bench_idx` ON `candidates` (`bench_status`, `paused_until_ms`);
--> statement-breakpoint
CREATE TABLE `trial_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL REFERENCES `candidates`(`id`) ON DELETE CASCADE,
	`role_brief_id` text NOT NULL REFERENCES `role_briefs`(`id`),
	`internal_content_ref` text,
	`task_description` text NOT NULL,
	`budget_cap_aud` integer NOT NULL,
	`rate_per_unit_aud` integer NOT NULL,
	`rate_unit` text NOT NULL,
	`sent_at_ms` integer NOT NULL,
	`due_at_ms` integer NOT NULL,
	`delivered_at_ms` integer,
	`delivery_url_or_asset` text,
	`andy_review_notes` text,
	`rating` integer,
	`disposition` text NOT NULL DEFAULT 'pending',
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trial_tasks_candidate_idx` ON `trial_tasks` (`candidate_id`);
--> statement-breakpoint
CREATE INDEX `trial_tasks_role_brief_idx` ON `trial_tasks` (`role_brief_id`);
--> statement-breakpoint
CREATE INDEX `trial_tasks_disposition_idx` ON `trial_tasks` (`disposition`);
--> statement-breakpoint
CREATE TABLE `candidate_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL REFERENCES `candidates`(`id`) ON DELETE CASCADE,
	`archived_at_ms` integer NOT NULL,
	`stage_when_archived` text NOT NULL,
	`reason_code` text NOT NULL,
	`reason_free_text` text,
	`reflection_text` text,
	`disposition_direction` text NOT NULL,
	`un_archived_at_ms` integer,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `candidate_archives_candidate_idx` ON `candidate_archives` (`candidate_id`, `archived_at_ms`);
