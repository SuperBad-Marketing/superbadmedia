CREATE TABLE `six_week_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`company_id` text,
	`status` text DEFAULT 'generating' NOT NULL,
	`generation_version` integer DEFAULT 1 NOT NULL,
	`parent_plan_id` text,
	`strategy_json` text,
	`strategy_generated_at_ms` integer,
	`strategy_approved_at_ms` integer,
	`weeks_json` text,
	`weeks_generated_at_ms` integer,
	`self_review_passed` integer,
	`self_review_issues_json` text,
	`reviewed_by` text,
	`approved_at_ms` integer,
	`regen_count` integer DEFAULT 0 NOT NULL,
	`released_at_ms` integer,
	`activated_at_ms` integer,
	`activation_path` text,
	`revision_requested_at_ms` integer,
	`revision_note` text,
	`revision_resolution` text,
	`revision_reply_sent_at_ms` integer,
	`revision_reply_body` text,
	`revision_reply_dismissed_at_ms` integer,
	`migrated_to_client_context_at_ms` integer,
	`refresh_reviewed_at_ms` integer,
	`retainer_payment_received_at_ms` integer,
	`portal_expiry_email_sent_at_ms` integer,
	`portal_archived_at_ms` integer,
	`portal_extended_until_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `swp_deal_idx` ON `six_week_plans` (`deal_id`);--> statement-breakpoint
CREATE INDEX `swp_company_idx` ON `six_week_plans` (`company_id`);--> statement-breakpoint
CREATE INDEX `swp_status_idx` ON `six_week_plans` (`status`);--> statement-breakpoint
CREATE INDEX `swp_parent_idx` ON `six_week_plans` (`parent_plan_id`);--> statement-breakpoint
CREATE TABLE `six_week_plan_task_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`task_index` integer NOT NULL,
	`completed_at_ms` integer,
	FOREIGN KEY (`plan_id`) REFERENCES `six_week_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `swptp_plan_idx` ON `six_week_plan_task_progress` (`plan_id`);--> statement-breakpoint
CREATE INDEX `swptp_plan_week_idx` ON `six_week_plan_task_progress` (`plan_id`,`week_number`);--> statement-breakpoint
CREATE TABLE `trial_shoot_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`infra_email_list` text,
	`infra_email_list_note` text,
	`infra_ad_experience` text,
	`infra_ad_experience_note` text,
	`infra_lead_magnet` text,
	`infra_lead_magnet_note` text,
	`infra_website_status` text,
	`infra_website_cms` text,
	`infra_social_cadence` text,
	`infra_social_primary_platform` text,
	`infra_competitors` text,
	`goals_json` text,
	`signal_energy` integer,
	`signal_fluency` integer,
	`signal_icp_clarity` integer,
	`signal_conversion_ready` integer,
	`observations` text,
	`enrichment_prefill_json` text,
	`filled_at_ms` integer,
	`filled_by` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filled_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trial_shoot_notes_deal_id_unique` ON `trial_shoot_notes` (`deal_id`);--> statement-breakpoint
CREATE INDEX `tsn_deal_idx` ON `trial_shoot_notes` (`deal_id`);--> statement-breakpoint
CREATE TABLE `active_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`origin` text NOT NULL,
	`source_id` text,
	`status` text DEFAULT 'pending_refresh_review' NOT NULL,
	`payload_json` text,
	`pending_refresh_review` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`reviewed_at_ms` integer,
	FOREIGN KEY (`client_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_strategies_client_id_unique` ON `active_strategies` (`client_id`);--> statement-breakpoint
CREATE INDEX `as_client_idx` ON `active_strategies` (`client_id`);--> statement-breakpoint
CREATE INDEX `as_status_idx` ON `active_strategies` (`status`);--> statement-breakpoint
CREATE TABLE `context_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`conversation_summary` text,
	`summary_generated_at_ms` integer,
	`draft_content` text,
	`draft_channel` text,
	`draft_nudge_history` text,
	`draft_generated_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `context_summaries_contact_id_unique` ON `context_summaries` (`contact_id`);--> statement-breakpoint
CREATE INDEX `context_summaries_contact_idx` ON `context_summaries` (`contact_id`);--> statement-breakpoint
CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`description` text NOT NULL,
	`owner` text NOT NULL,
	`due_date_ms` integer,
	`source` text NOT NULL,
	`source_message_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`completed_at_ms` integer,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `action_items_contact_status_idx` ON `action_items` (`contact_id`,`status`);--> statement-breakpoint
CREATE INDEX `action_items_owner_status_idx` ON `action_items` (`owner`,`status`,`due_date_ms`);--> statement-breakpoint
CREATE TABLE `llm_usage_log` (
	`id` text PRIMARY KEY NOT NULL,
	`call_type` text NOT NULL,
	`contact_id` text,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `llm_usage_log_type_idx` ON `llm_usage_log` (`call_type`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `llm_usage_log_contact_idx` ON `llm_usage_log` (`contact_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_at_ms` integer,
	`entity_type` text,
	`entity_id` text,
	`checklist` text,
	`checklist_auto_complete` integer DEFAULT true NOT NULL,
	`recurrence` text,
	`recurrence_day` integer,
	`parent_recurrence_id` text,
	`source_braindump_id` text,
	`approval_requested_at_ms` integer,
	`approval_viewed_at_ms` integer,
	`approved_at_ms` integer,
	`approved_by_contact_id` text,
	`rejected_at_ms` integer,
	`rejection_feedback` text,
	`approval_token` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` text NOT NULL,
	`completed_at_ms` integer,
	FOREIGN KEY (`approved_by_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_status_due_idx` ON `tasks` (`status`,`due_at_ms`);--> statement-breakpoint
CREATE INDEX `tasks_entity_idx` ON `tasks` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `tasks_kind_status_idx` ON `tasks` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `tasks_approval_token_idx` ON `tasks` (`approval_token`);--> statement-breakpoint
CREATE INDEX `tasks_parent_recurrence_idx` ON `tasks` (`parent_recurrence_id`);--> statement-breakpoint
CREATE INDEX `tasks_source_braindump_idx` ON `tasks` (`source_braindump_id`);--> statement-breakpoint
CREATE TABLE `braindumps` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_text` text NOT NULL,
	`surface_context` text,
	`parsed_at_ms` integer,
	`committed_at_ms` integer,
	`task_count` integer DEFAULT 0 NOT NULL,
	`content_count` integer DEFAULT 0 NOT NULL,
	`script_count` integer DEFAULT 0 NOT NULL,
	`mood_signal_json` text,
	`created_by` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `role_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`role_name` text NOT NULL,
	`engagement_type` text DEFAULT 'contractor' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rate_min_aud` integer,
	`rate_max_aud` integer,
	`rate_unit` text,
	`target_hours_per_week` integer,
	`location_pref_city` text,
	`remote_ok` integer DEFAULT true NOT NULL,
	`open_count` integer DEFAULT 1 NOT NULL,
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
CREATE INDEX `role_briefs_status_idx` ON `role_briefs` (`status`);--> statement-breakpoint
CREATE INDEX `role_briefs_engagement_type_idx` ON `role_briefs` (`engagement_type`);--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`role_brief_id` text,
	`stage` text NOT NULL,
	`stage_before_archive` text,
	`source` text NOT NULL,
	`discovery_source` text,
	`engagement_type` text DEFAULT 'contractor' NOT NULL,
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
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`role_brief_id`) REFERENCES `role_briefs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `candidates_role_brief_idx` ON `candidates` (`role_brief_id`);--> statement-breakpoint
CREATE INDEX `candidates_stage_idx` ON `candidates` (`stage`,`updated_at_ms`);--> statement-breakpoint
CREATE INDEX `candidates_email_idx` ON `candidates` (`email`);--> statement-breakpoint
CREATE INDEX `candidates_bench_idx` ON `candidates` (`bench_status`,`paused_until_ms`);--> statement-breakpoint
CREATE TABLE `trial_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`role_brief_id` text NOT NULL,
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
	`disposition` text DEFAULT 'pending' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_brief_id`) REFERENCES `role_briefs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trial_tasks_candidate_idx` ON `trial_tasks` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `trial_tasks_role_brief_idx` ON `trial_tasks` (`role_brief_id`);--> statement-breakpoint
CREATE INDEX `trial_tasks_disposition_idx` ON `trial_tasks` (`disposition`);--> statement-breakpoint
CREATE TABLE `candidate_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`archived_at_ms` integer NOT NULL,
	`stage_when_archived` text NOT NULL,
	`reason_code` text NOT NULL,
	`reason_free_text` text,
	`reflection_text` text,
	`disposition_direction` text NOT NULL,
	`un_archived_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidate_archives_candidate_idx` ON `candidate_archives` (`candidate_id`,`archived_at_ms`);--> statement-breakpoint
CREATE TABLE `bench_magic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`ott_hash` text NOT NULL,
	`issued_for` text DEFAULT 'bench_access' NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`consumed_at_ms` integer,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bench_magic_links_ott_hash_unique` ON `bench_magic_links` (`ott_hash`);--> statement-breakpoint
CREATE INDEX `bench_magic_links_ott_hash_idx` ON `bench_magic_links` (`ott_hash`);--> statement-breakpoint
CREATE INDEX `bench_magic_links_candidate_idx` ON `bench_magic_links` (`candidate_id`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `invite_drafts` (
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
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_brief_id`) REFERENCES `role_briefs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invite_drafts_candidate_idx` ON `invite_drafts` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `invite_drafts_role_brief_idx` ON `invite_drafts` (`role_brief_id`);--> statement-breakpoint
CREATE INDEX `invite_drafts_status_idx` ON `invite_drafts` (`status`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `contractor_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`amount_aud` integer NOT NULL,
	`reference` text NOT NULL,
	`pdf_filename` text,
	`notes` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`submitted_at_ms` integer NOT NULL,
	`reviewed_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contractor_invoices_candidate_idx` ON `contractor_invoices` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `contractor_invoices_status_idx` ON `contractor_invoices` (`status`);--> statement-breakpoint
CREATE TABLE `candidate_edit_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`field_name` text NOT NULL,
	`old_value` text,
	`new_value` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`reviewed_at_ms` integer,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidate_edit_requests_candidate_idx` ON `candidate_edit_requests` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `candidate_edit_requests_status_idx` ON `candidate_edit_requests` (`status`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_inc_gst` integer NOT NULL,
	`gst_amount` integer,
	`category` text NOT NULL,
	`vendor` text NOT NULL,
	`description` text,
	`expense_date` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`manual_override` integer DEFAULT false NOT NULL,
	`receipt_path` text,
	`candidate_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expenses_date_idx` ON `expenses` (`expense_date`);--> statement-breakpoint
CREATE INDEX `expenses_category_date_idx` ON `expenses` (`category`,`expense_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_source_ref_idx` ON `expenses` (`source`,`source_ref`);--> statement-breakpoint
CREATE TABLE `recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor` text NOT NULL,
	`category` text NOT NULL,
	`amount_inc_gst` integer NOT NULL,
	`gst_amount` integer,
	`frequency` text NOT NULL,
	`next_fire_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `finance_snapshots` (
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
CREATE TABLE `compliance_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`period_label` text NOT NULL,
	`filed_at_ms` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `finance_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`period_label` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`file_path` text,
	`filename` text,
	`file_size_bytes` integer,
	`error_message` text,
	`requested_at_ms` integer NOT NULL,
	`completed_at_ms` integer,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hidden_egg_fires` (
	`id` text PRIMARY KEY NOT NULL,
	`egg_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`user_id` text,
	`visitor_id` text,
	`fired_at_ms` integer NOT NULL,
	`trigger_evidence` text NOT NULL,
	`session_id` text,
	`outcome` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `hef_egg_user_idx` ON `hidden_egg_fires` (`egg_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `hef_egg_visitor_idx` ON `hidden_egg_fires` (`egg_id`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `hef_fired_idx` ON `hidden_egg_fires` (`fired_at_ms`);--> statement-breakpoint
CREATE TABLE `ambient_copy_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`slot` text NOT NULL,
	`context_hash` text NOT NULL,
	`generated_text` text NOT NULL,
	`drift_check_score` integer,
	`generated_at_ms` integer NOT NULL,
	`expires_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `acc_slot_hash_idx` ON `ambient_copy_cache` (`slot`,`context_hash`);--> statement-breakpoint
CREATE TABLE `riddle_novel_wrong_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`riddle_id` text NOT NULL,
	`input_hash` text NOT NULL,
	`response` text NOT NULL,
	`drift_check_score` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`riddle_id`) REFERENCES `riddles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rnwc_riddle_hash_idx` ON `riddle_novel_wrong_cache` (`riddle_id`,`input_hash`);--> statement-breakpoint
CREATE TABLE `riddle_resolutions` (
	`id` text PRIMARY KEY NOT NULL,
	`riddle_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`user_id` text,
	`input_hash` text NOT NULL,
	`resolved_at_ms` integer NOT NULL,
	`outcome` text NOT NULL,
	FOREIGN KEY (`riddle_id`) REFERENCES `riddles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rr_riddle_idx` ON `riddle_resolutions` (`riddle_id`);--> statement-breakpoint
CREATE INDEX `rr_user_idx` ON `riddle_resolutions` (`user_id`);--> statement-breakpoint
CREATE TABLE `riddles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`salt` text NOT NULL,
	`answer_hash` text NOT NULL,
	`public_reward_content` text NOT NULL,
	`loggedin_reward_content` text NOT NULL,
	`common_wrong_answers` text DEFAULT '[]' NOT NULL,
	`catch_all_wrong_content` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`retired_at_ms` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `riddles_slug_unique` ON `riddles` (`slug`);--> statement-breakpoint
CREATE INDEX `riddles_slug_idx` ON `riddles` (`slug`);--> statement-breakpoint
CREATE TABLE `cost_anomalies` (
	`id` text PRIMARY KEY NOT NULL,
	`detector` text NOT NULL,
	`job` text NOT NULL,
	`actor_scope` text,
	`tier` text NOT NULL,
	`first_fired_at_ms` integer NOT NULL,
	`last_fired_at_ms` integer NOT NULL,
	`fire_count` integer DEFAULT 1 NOT NULL,
	`observed_value` real NOT NULL,
	`expected_band` text NOT NULL,
	`diagnosis_json` text,
	`diagnosis_cost_aud` real,
	`acknowledged_at_ms` integer,
	`acknowledged_until_ms` integer,
	`kill_switch_triggered_at_ms` integer,
	`resolved_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `cost_anomalies_job_idx` ON `cost_anomalies` (`job`,`first_fired_at_ms`);--> statement-breakpoint
CREATE INDEX `cost_anomalies_tier_idx` ON `cost_anomalies` (`tier`,`first_fired_at_ms`);--> statement-breakpoint
CREATE INDEX `cost_anomalies_unresolved_idx` ON `cost_anomalies` (`resolved_at_ms`,`tier`,`last_fired_at_ms`);--> statement-breakpoint
CREATE TABLE `band_overrides` (
	`job` text PRIMARY KEY NOT NULL,
	`per_call_ceiling_aud` real,
	`daily_ceiling_aud` real,
	`learned_band_multiplier` real,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deploy_events` (
	`id` text PRIMARY KEY NOT NULL,
	`commit_sha` text NOT NULL,
	`deployed_at_ms` integer NOT NULL,
	`status` text NOT NULL,
	`preview_url` text
);
--> statement-breakpoint
CREATE INDEX `deploy_events_deployed_idx` ON `deploy_events` (`deployed_at_ms`);--> statement-breakpoint
CREATE TABLE `cockpit_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slot` text NOT NULL,
	`brief_date` text NOT NULL,
	`generated_at_ms` integer NOT NULL,
	`trigger` text NOT NULL,
	`trigger_event` text,
	`prose` text NOT NULL,
	`signals_snapshot` text NOT NULL,
	`model_version` text NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cockpit_briefs_user_date_idx` ON `cockpit_briefs` (`user_id`,`brief_date`);--> statement-breakpoint
CREATE INDEX `cockpit_briefs_unique_slot_idx` ON `cockpit_briefs` (`user_id`,`slot`,`brief_date`);--> statement-breakpoint
CREATE TABLE `content_studio_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`brief` text NOT NULL,
	`content_type` text NOT NULL,
	`template_id` text NOT NULL,
	`slide_count` integer DEFAULT 1 NOT NULL,
	`generated_copy_json` text,
	`correction_history_json` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`motion_enabled` integer DEFAULT 0 NOT NULL,
	`motion_template_id` text,
	`palette_id` text,
	`animation_params_json` text,
	`primary_aspect_ratio` text,
	`inspiration_refs_json` text,
	`font_pairing_id` text,
	`static_palette_id` text,
	`custom_palette_json` text,
	`motion_duration_frames` integer,
	`promoted_from_post_id` text,
	`source_braindump_id` text,
	`project_name` text,
	`content_format` text DEFAULT 'static',
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `csp_type_idx` ON `content_studio_posts` (`content_type`);--> statement-breakpoint
CREATE INDEX `csp_status_idx` ON `content_studio_posts` (`status`);--> statement-breakpoint
CREATE INDEX `csp_created_idx` ON `content_studio_posts` (`created_at_ms`);--> statement-breakpoint
CREATE INDEX `csp_braindump_idx` ON `content_studio_posts` (`source_braindump_id`);--> statement-breakpoint
CREATE TABLE `content_studio_renders` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`slide_index` integer DEFAULT 0 NOT NULL,
	`aspect_ratio` text NOT NULL,
	`platforms` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`cloudinary_public_id` text,
	`cloudinary_url` text,
	`render_status` text DEFAULT 'rendering' NOT NULL,
	`render_type` text DEFAULT 'static' NOT NULL,
	`format` text DEFAULT 'png' NOT NULL,
	`video_job_id` text,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `content_studio_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `csr_post_idx` ON `content_studio_renders` (`post_id`);--> statement-breakpoint
CREATE TABLE `video_jobs` (
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
	`content_studio_post_id` text,
	`pipeline_stage` text DEFAULT 'brief',
	`overlay_template_id` text,
	`overlay_copy_json` text,
	`overlay_params_json` text,
	`trim_in_frame` integer DEFAULT 0,
	`trim_out_frame` integer,
	`footage_url` text,
	`overlay_url` text,
	`composite_url` text,
	`scene_count` integer DEFAULT 1,
	`scenes_json` text,
	`music_track_id` text,
	`music_url` text
);
--> statement-breakpoint
CREATE INDEX `video_jobs_status_idx` ON `video_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `video_jobs_client_idx` ON `video_jobs` (`client_id`);--> statement-breakpoint
CREATE TABLE `inspiration_library` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text NOT NULL,
	`thumbnail_url` text,
	`title` text,
	`description` text,
	`tags` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instagram_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`instagram_user_id` text NOT NULL,
	`page_id` text,
	`username` text NOT NULL,
	`account_type` text DEFAULT 'own' NOT NULL,
	`company_id` text,
	`access_token` text NOT NULL,
	`token_expires_at_ms` integer,
	`connected_at_ms` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_accounts_status_idx` ON `instagram_accounts` (`status`);--> statement-breakpoint
CREATE INDEX `ig_accounts_type_idx` ON `instagram_accounts` (`account_type`);--> statement-breakpoint
CREATE TABLE `instagram_audience_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`age_gender_json` text,
	`top_cities_json` text,
	`top_countries_json` text,
	`online_hours_json` text,
	`synced_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_audience_account_date_idx` ON `instagram_audience_snapshots` (`account_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `instagram_comment_triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`media_id` text,
	`trigger_type` text NOT NULL,
	`keyword` text,
	`action_type` text DEFAULT 'send_dm' NOT NULL,
	`dm_message_text` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`fires_count` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_triggers_media_idx` ON `instagram_comment_triggers` (`media_id`);--> statement-breakpoint
CREATE INDEX `ig_triggers_account_idx` ON `instagram_comment_triggers` (`account_id`);--> statement-breakpoint
CREATE INDEX `ig_triggers_active_idx` ON `instagram_comment_triggers` (`is_active`);--> statement-breakpoint
CREATE TABLE `instagram_content_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`strategy_report_id` text,
	`week_start_date` text NOT NULL,
	`week_end_date` text NOT NULL,
	`theme_summary` text NOT NULL,
	`slots_json` text NOT NULL,
	`status` text DEFAULT 'awaiting_review' NOT NULL,
	`nudge_sent` integer DEFAULT false NOT NULL,
	`reviewed_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `instagram_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ig_plans_account_week_idx` ON `instagram_content_plans` (`account_id`,`week_start_date`);--> statement-breakpoint
CREATE INDEX `ig_plans_status_idx` ON `instagram_content_plans` (`status`);--> statement-breakpoint
CREATE TABLE `instagram_media` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`ig_media_id` text NOT NULL,
	`media_type` text NOT NULL,
	`source_post_id` text,
	`caption` text,
	`permalink` text,
	`thumbnail_url` text,
	`published_at_ms` integer NOT NULL,
	`engagement_score` real,
	`likes` integer,
	`comments_count` integer,
	`saves` integer,
	`shares` integer,
	`reach` integer,
	`impressions` integer,
	`video_views` integer,
	`video_avg_watch_ms` integer,
	`boost_status` text DEFAULT 'none' NOT NULL,
	`boost_budget_cents` integer,
	`boost_start_ms` integer,
	`boost_end_ms` integer,
	`last_synced_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_media_account_idx` ON `instagram_media` (`account_id`);--> statement-breakpoint
CREATE INDEX `ig_media_published_idx` ON `instagram_media` (`published_at_ms`);--> statement-breakpoint
CREATE INDEX `ig_media_ig_id_idx` ON `instagram_media` (`ig_media_id`);--> statement-breakpoint
CREATE INDEX `ig_media_source_post_idx` ON `instagram_media` (`source_post_id`);--> statement-breakpoint
CREATE TABLE `instagram_metrics_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`followers` integer,
	`follows` integer,
	`reach` integer,
	`impressions` integer,
	`profile_views` integer,
	`website_clicks` integer,
	`synced_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_metrics_account_date_idx` ON `instagram_metrics_snapshots` (`account_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `instagram_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`ig_comment_id` text,
	`ig_conversation_id` text,
	`ig_message_id` text,
	`reply_type` text NOT NULL,
	`inbound_text` text NOT NULL,
	`inbound_author` text,
	`classification` text,
	`draft_text` text NOT NULL,
	`final_text` text,
	`status` text NOT NULL,
	`sent_at_ms` integer,
	`escalated_at_ms` integer,
	`created_deal_id` text,
	`feedback` text,
	`feedback_sentiment` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_replies_account_idx` ON `instagram_replies` (`account_id`);--> statement-breakpoint
CREATE INDEX `ig_replies_status_idx` ON `instagram_replies` (`status`);--> statement-breakpoint
CREATE TABLE `instagram_strategy_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`report_type` text NOT NULL,
	`generated_at_ms` integer NOT NULL,
	`period_start_ms` integer,
	`period_end_ms` integer,
	`summary_text` text NOT NULL,
	`recommendations_json` text,
	`content_ideas_json` text,
	`metrics_snapshot_json` text
);
--> statement-breakpoint
CREATE INDEX `ig_strategy_account_idx` ON `instagram_strategy_reports` (`account_id`);--> statement-breakpoint
CREATE INDEX `ig_strategy_type_idx` ON `instagram_strategy_reports` (`report_type`);--> statement-breakpoint
CREATE TABLE `instagram_trigger_fires` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger_id` text NOT NULL,
	`ig_comment_id` text NOT NULL,
	`commenter_username` text NOT NULL,
	`dm_sent` integer DEFAULT false NOT NULL,
	`error` text,
	`fired_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_trigger_fires_trigger_idx` ON `instagram_trigger_fires` (`trigger_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ig_trigger_fires_comment_idx` ON `instagram_trigger_fires` (`trigger_id`,`ig_comment_id`);--> statement-breakpoint
CREATE TABLE `instagram_voice_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`reply_id` text NOT NULL,
	`reply_type` text NOT NULL,
	`ai_draft` text NOT NULL,
	`andy_version` text NOT NULL,
	`correction_note` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ig_corrections_account_idx` ON `instagram_voice_corrections` (`account_id`);--> statement-breakpoint
CREATE TABLE `brand_voice_examples` (
	`id` text PRIMARY KEY NOT NULL,
	`surface` text NOT NULL,
	`title` text NOT NULL,
	`body_markdown` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brand_voice_examples_surface_order_idx` ON `brand_voice_examples` (`surface`,`sort_order`);--> statement-breakpoint
CREATE TABLE `brief_task_links` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text NOT NULL,
	`task_id` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brief_task_links_unique_idx` ON `brief_task_links` (`brief_id`,`task_id`);--> statement-breakpoint
CREATE INDEX `brief_task_links_brief_idx` ON `brief_task_links` (`brief_id`);--> statement-breakpoint
CREATE INDEX `brief_task_links_task_idx` ON `brief_task_links` (`task_id`);--> statement-breakpoint
CREATE TABLE `briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_number` text NOT NULL,
	`brief_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text NOT NULL,
	`business_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`company_id` text,
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
	`auto_task_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`auto_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `briefs_reference_number_unique` ON `briefs` (`reference_number`);--> statement-breakpoint
CREATE INDEX `briefs_company_idx` ON `briefs` (`company_id`);--> statement-breakpoint
CREATE INDEX `briefs_status_idx` ON `briefs` (`status`);--> statement-breakpoint
CREATE INDEX `briefs_delivery_idx` ON `briefs` (`delivery_date_ms`);--> statement-breakpoint
CREATE INDEX `briefs_reference_idx` ON `briefs` (`reference_number`);--> statement-breakpoint
CREATE TABLE `brief_storyboards` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`scenes_json` text,
	`shotlist_json` text,
	`chat_history_json` text DEFAULT '[]',
	`error_message` text,
	`generated_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brief_storyboards_brief_idx` ON `brief_storyboards` (`brief_id`);--> statement-breakpoint
CREATE TABLE `talking_head_scripts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_pack_id` text NOT NULL,
	`pillar_slug` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'generated' NOT NULL,
	`title` text NOT NULL,
	`hook` text NOT NULL,
	`estimated_duration_sec` integer NOT NULL,
	`script_json` text NOT NULL,
	`edit_brief_json` text,
	`publish_meta_json` text,
	`energy_level` text DEFAULT 'default' NOT NULL,
	`signal_source` text,
	`source_braindump_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `th_scripts_pack_idx` ON `talking_head_scripts` (`session_pack_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `th_scripts_status_idx` ON `talking_head_scripts` (`status`);--> statement-breakpoint
CREATE INDEX `th_scripts_braindump_idx` ON `talking_head_scripts` (`source_braindump_id`);--> statement-breakpoint
CREATE TABLE `talking_head_session_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`energy_level` text DEFAULT 'default' NOT NULL,
	`target_date` text,
	`script_count` integer DEFAULT 4 NOT NULL,
	`source_braindump_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `th_packs_status_idx` ON `talking_head_session_packs` (`status`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `call_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`company_id` text NOT NULL,
	`contact_id` text,
	`stage_at_time` text NOT NULL,
	`template_type` text NOT NULL,
	`status` text DEFAULT 'prep' NOT NULL,
	`temperature` text,
	`agreed_next_step` text,
	`follow_up_date_ms` integer,
	`blockers` text,
	`sections_data` text,
	`llm_briefing` text,
	`llm_custom_questions` text,
	`llm_synthesis` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`completed_at_ms` integer,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `call_logs_deal_idx` ON `call_logs` (`deal_id`);--> statement-breakpoint
CREATE INDEX `call_logs_company_idx` ON `call_logs` (`company_id`);--> statement-breakpoint
CREATE INDEX `call_logs_status_idx` ON `call_logs` (`status`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`proposal_number` text NOT NULL,
	`company_id` text,
	`deal_id` text,
	`primary_contact_id` text,
	`title` text NOT NULL,
	`subtitle` text,
	`client_name` text NOT NULL,
	`sections_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` text,
	`last_edited_by_user_id` text,
	`pdf_cache_key` text,
	`sent_at_ms` integer,
	`viewed_at_ms` integer,
	`accepted_at_ms` integer,
	`withdrawn_at_ms` integer,
	`expires_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`primary_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_edited_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_token_unique` ON `proposals` (`token`);--> statement-breakpoint
CREATE INDEX `proposals_company_idx` ON `proposals` (`company_id`);--> statement-breakpoint
CREATE INDEX `proposals_deal_idx` ON `proposals` (`deal_id`);--> statement-breakpoint
CREATE INDEX `proposals_status_idx` ON `proposals` (`status`);--> statement-breakpoint
CREATE INDEX `proposals_token_idx` ON `proposals` (`token`);--> statement-breakpoint
CREATE TABLE `meta_ad_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`meta_account_id` text NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'AUD' NOT NULL,
	`timezone` text DEFAULT 'Australia/Melbourne' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`access_token_encrypted` text,
	`pixel_id` text,
	`pixel_installed` integer DEFAULT false NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta_ad_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`meta_adset_id` text,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`funnel_stage` text NOT NULL,
	`audience_type` text NOT NULL,
	`audience_config_json` text,
	`meta_audience_id` text,
	`daily_budget_cents` integer NOT NULL,
	`bid_strategy` text DEFAULT 'lowest_cost' NOT NULL,
	`bid_amount_cents` integer,
	`placements_json` text,
	`age_min` integer,
	`age_max` integer,
	`genders_json` text,
	`locations_json` text,
	`interests_json` text,
	`optimization_goal` text,
	`primary_metric` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `meta_campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meta_ad_sets_campaign_idx` ON `meta_ad_sets` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `meta_ad_sets_status_idx` ON `meta_ad_sets` (`status`);--> statement-breakpoint
CREATE TABLE `meta_ads` (
	`id` text PRIMARY KEY NOT NULL,
	`meta_ad_id` text,
	`ad_set_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`creative_type` text NOT NULL,
	`creative_source` text NOT NULL,
	`content_studio_post_id` text,
	`asset_url` text,
	`thumbnail_url` text,
	`headline` text,
	`primary_text` text,
	`description` text,
	`cta_type` text,
	`destination_url` text,
	`is_variation` integer DEFAULT false NOT NULL,
	`variation_group` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`ad_set_id`) REFERENCES `meta_ad_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `meta_campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meta_ads_adset_idx` ON `meta_ads` (`ad_set_id`);--> statement-breakpoint
CREATE INDEX `meta_ads_campaign_idx` ON `meta_ads` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `meta_ads_status_idx` ON `meta_ads` (`status`);--> statement-breakpoint
CREATE TABLE `meta_campaign_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`ad_set_id` text,
	`ad_id` text,
	`date_ms` integer NOT NULL,
	`granularity` text DEFAULT 'daily' NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`reach` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`link_clicks` integer DEFAULT 0 NOT NULL,
	`spend_cents` integer DEFAULT 0 NOT NULL,
	`cpm_cents` integer,
	`cpc_cents` integer,
	`ctr_pct` real,
	`conversions` integer DEFAULT 0 NOT NULL,
	`conversion_value_cents` integer DEFAULT 0 NOT NULL,
	`roas` real,
	`cpa_cents` integer,
	`video_views` integer DEFAULT 0 NOT NULL,
	`video_views_p25` integer DEFAULT 0 NOT NULL,
	`video_views_p50` integer DEFAULT 0 NOT NULL,
	`video_views_p75` integer DEFAULT 0 NOT NULL,
	`video_views_p100` integer DEFAULT 0 NOT NULL,
	`engagement_total` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`leads` integer DEFAULT 0 NOT NULL,
	`lead_cost_cents` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `meta_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ad_set_id`) REFERENCES `meta_ad_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ad_id`) REFERENCES `meta_ads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meta_metrics_campaign_idx` ON `meta_campaign_metrics` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `meta_metrics_date_idx` ON `meta_campaign_metrics` (`date_ms`);--> statement-breakpoint
CREATE INDEX `meta_metrics_ad_idx` ON `meta_campaign_metrics` (`ad_id`);--> statement-breakpoint
CREATE TABLE `meta_campaign_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`report_type` text NOT NULL,
	`period_start_ms` integer NOT NULL,
	`period_end_ms` integer NOT NULL,
	`summary_json` text NOT NULL,
	`highlights` text,
	`actions_taken` text,
	`recommendations` text,
	`total_spend_cents` integer DEFAULT 0 NOT NULL,
	`total_impressions` integer DEFAULT 0 NOT NULL,
	`total_clicks` integer DEFAULT 0 NOT NULL,
	`total_conversions` integer DEFAULT 0 NOT NULL,
	`period_roas` real,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `meta_campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meta_reports_campaign_idx` ON `meta_campaign_reports` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `meta_reports_type_idx` ON `meta_campaign_reports` (`report_type`);--> statement-breakpoint
CREATE TABLE `meta_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`meta_campaign_id` text,
	`ad_account_id` text NOT NULL,
	`company_id` text,
	`name` text NOT NULL,
	`objective` text NOT NULL,
	`funnel_stage` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`daily_budget_cents` integer NOT NULL,
	`lifetime_budget_cents` integer,
	`total_spent_cents` integer DEFAULT 0 NOT NULL,
	`start_date_ms` integer,
	`end_date_ms` integer,
	`scaling_mode` text DEFAULT 'off' NOT NULL,
	`scaling_daily_cap_cents` integer,
	`scaling_velocity_pct` integer DEFAULT 20 NOT NULL,
	`scaling_roas_floor` real,
	`human_checkpoint_enabled` integer DEFAULT true NOT NULL,
	`human_checkpoint_spend_cents` integer,
	`strategy_notes` text,
	`ai_strategy_json` text,
	`content_pool_tag` text,
	`created_by_user_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`ad_account_id`) REFERENCES `meta_ad_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meta_campaigns_account_idx` ON `meta_campaigns` (`ad_account_id`);--> statement-breakpoint
CREATE INDEX `meta_campaigns_status_idx` ON `meta_campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `meta_campaigns_company_idx` ON `meta_campaigns` (`company_id`);--> statement-breakpoint
CREATE TABLE `meta_content_pool_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`tag` text NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`campaign_id` text,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `meta_campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meta_pool_tags_tag_idx` ON `meta_content_pool_tags` (`tag`);--> statement-breakpoint
CREATE INDEX `meta_pool_tags_content_idx` ON `meta_content_pool_tags` (`content_id`);--> statement-breakpoint
CREATE TABLE `meta_optimization_log` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`ad_set_id` text,
	`ad_id` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`details_json` text,
	`old_budget_cents` integer,
	`new_budget_cents` integer,
	`metric_value` real,
	`benchmark_threshold` real,
	`applied` integer DEFAULT true NOT NULL,
	`requires_approval` integer DEFAULT false NOT NULL,
	`approved_at_ms` integer,
	`approved_by_user_id` text,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `meta_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ad_set_id`) REFERENCES `meta_ad_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ad_id`) REFERENCES `meta_ads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meta_opt_log_campaign_idx` ON `meta_optimization_log` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `meta_opt_log_action_idx` ON `meta_optimization_log` (`action`);--> statement-breakpoint
CREATE INDEX `meta_opt_log_created_idx` ON `meta_optimization_log` (`created_at_ms`);--> statement-breakpoint
CREATE TABLE `meta_performance_benchmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`funnel_stage` text NOT NULL,
	`objective` text NOT NULL,
	`vertical` text,
	`primary_metric` text NOT NULL,
	`good_threshold` real NOT NULL,
	`scale_threshold` real NOT NULL,
	`kill_threshold` real NOT NULL,
	`metric_unit` text NOT NULL,
	`metric_direction` text NOT NULL,
	`min_data_days` integer DEFAULT 3 NOT NULL,
	`min_impressions` integer DEFAULT 1000 NOT NULL,
	`min_conversions` integer,
	`notes` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meta_benchmarks_stage_idx` ON `meta_performance_benchmarks` (`funnel_stage`,`objective`);--> statement-breakpoint
CREATE TABLE `search_verticals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`location` text NOT NULL,
	`location_lat` real NOT NULL,
	`location_lng` real NOT NULL,
	`radius_km` integer NOT NULL,
	`country_code` text DEFAULT 'AU' NOT NULL,
	`standing_brief` text,
	`weight` integer DEFAULT 5 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_searched_at` integer,
	`search_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_verticals_active_searched_idx` ON `search_verticals` (`is_active`,`last_searched_at`);--> statement-breakpoint
CREATE TABLE `habit_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`completed_date` text NOT NULL,
	`completed_at_ms` integer NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_completions_habit_date_uniq` ON `habit_completions` (`habit_id`,`completed_date`);--> statement-breakpoint
CREATE INDEX `habit_completions_by_date_idx` ON `habit_completions` (`habit_id`,`completed_date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`link_href` text,
	`cadence` text DEFAULT 'daily' NOT NULL,
	`cadence_days` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `habits_active_sort_idx` ON `habits` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sfx_library` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`file_url` text NOT NULL,
	`color` text DEFAULT '#9B51E0' NOT NULL,
	`cloudinary_public_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sfx_library_slug_unique` ON `sfx_library` (`slug`);--> statement-breakpoint
CREATE TABLE `instagram_competitor_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`watched_account_id` text NOT NULL,
	`ig_permalink` text,
	`media_type` text DEFAULT 'IMAGE' NOT NULL,
	`caption` text,
	`image_url` text NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`post_er` real DEFAULT 0 NOT NULL,
	`performance_score` real DEFAULT 0 NOT NULL,
	`recency_weight` real DEFAULT 1 NOT NULL,
	`final_score` real DEFAULT 0 NOT NULL,
	`why_high` text,
	`published_at_ms` integer NOT NULL,
	`scraped_at_ms` integer NOT NULL,
	FOREIGN KEY (`watched_account_id`) REFERENCES `instagram_watched_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ig_comp_posts_account_idx` ON `instagram_competitor_posts` (`watched_account_id`);--> statement-breakpoint
CREATE INDEX `ig_comp_posts_score_idx` ON `instagram_competitor_posts` (`final_score`);--> statement-breakpoint
CREATE TABLE `instagram_inspiration_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`competitor_post_id` text NOT NULL,
	`reaction` text NOT NULL,
	`reacted_at_ms` integer NOT NULL,
	FOREIGN KEY (`competitor_post_id`) REFERENCES `instagram_competitor_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ig_insp_reaction_unique_idx` ON `instagram_inspiration_reactions` (`competitor_post_id`);--> statement-breakpoint
CREATE TABLE `instagram_taste_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_at_ms` integer NOT NULL,
	`reaction_count` integer DEFAULT 0 NOT NULL,
	`preferred_types_json` text,
	`preferred_styles_json` text,
	`preferred_topics_json` text,
	`anti_patterns_json` text,
	`raw_analysis_text` text
);
--> statement-breakpoint
CREATE TABLE `instagram_watched_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`category` text DEFAULT 'wildcard' NOT NULL,
	`followers` integer,
	`bio` text,
	`profile_pic_url` text,
	`last_scraped_at_ms` integer,
	`posts_scraped` integer DEFAULT 0 NOT NULL,
	`avg_engagement_rate` real,
	`added_at_ms` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instagram_watched_accounts_username_unique` ON `instagram_watched_accounts` (`username`);--> statement-breakpoint
CREATE INDEX `ig_watched_status_idx` ON `instagram_watched_accounts` (`status`);--> statement-breakpoint
CREATE TABLE `stripe_synced_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_payment_intent_id` text NOT NULL,
	`stripe_charge_id` text,
	`stripe_customer_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'aud' NOT NULL,
	`description` text,
	`customer_name` text,
	`customer_email` text,
	`payment_date` text NOT NULL,
	`paid_at_ms` integer NOT NULL,
	`gst_cents` integer DEFAULT 0 NOT NULL,
	`linked_invoice_id` text,
	`linked_deal_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_synced_payments_pi_idx` ON `stripe_synced_payments` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `stripe_synced_payments_date_idx` ON `stripe_synced_payments` (`payment_date`);--> statement-breakpoint
CREATE INDEX `stripe_synced_payments_paid_at_idx` ON `stripe_synced_payments` (`paid_at_ms`);--> statement-breakpoint
CREATE TABLE `business_profile_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`section_key` text NOT NULL,
	`structured_data` text NOT NULL,
	`prose_summary` text,
	`prose_generated_at_ms` integer,
	`prose_manually_edited` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bps_section_current_idx` ON `business_profile_sections` (`section_key`,`is_current`);--> statement-breakpoint
CREATE INDEX `bps_section_version_idx` ON `business_profile_sections` (`section_key`,`version`);--> statement-breakpoint
CREATE TABLE `business_profile_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`section_key` text NOT NULL,
	`field_path` text,
	`suggestion_type` text NOT NULL,
	`source` text NOT NULL,
	`source_entity_id` text,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`surfaced_in_brief` integer DEFAULT false NOT NULL,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `bps_sugg_status_created_idx` ON `business_profile_suggestions` (`status`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `prompt_library` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prompt_text` text NOT NULL,
	`category` text NOT NULL,
	`engine` text,
	`tags_json` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at_ms` integer,
	`source_job_id` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pl_category_idx` ON `prompt_library` (`category`);--> statement-breakpoint
CREATE INDEX `pl_use_count_idx` ON `prompt_library` (`use_count`);--> statement-breakpoint
CREATE TABLE `music_library` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`artist` text,
	`file_url` text NOT NULL,
	`cloudinary_public_id` text,
	`duration_sec` integer,
	`bpm` integer,
	`mood` text,
	`tags_json` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ml_mood_idx` ON `music_library` (`mood`);--> statement-breakpoint
CREATE INDEX `ml_use_idx` ON `music_library` (`use_count`);--> statement-breakpoint
CREATE TABLE `production_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`production_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`production_id`) REFERENCES `productions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pcm_production_idx` ON `production_chat_messages` (`production_id`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `productions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subject_name` text,
	`subject_type` text,
	`initial_thought` text,
	`status` text DEFAULT 'idea' NOT NULL,
	`generated_angles_json` text,
	`narrative_angle` text,
	`key_moments_json` text,
	`voiceover_hook` text,
	`shot_list_json` text,
	`gear_notes` text,
	`release_checklist_json` text,
	`clips_json` text,
	`shoot_date` text,
	`location` text,
	`company_id` text,
	`contact_id` text,
	`published_url` text,
	`thumbnail_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`promoted_at_ms` integer,
	`published_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `prod_status_idx` ON `productions` (`status`);--> statement-breakpoint
CREATE INDEX `prod_created_idx` ON `productions` (`created_at_ms`);--> statement-breakpoint
CREATE INDEX `prod_company_idx` ON `productions` (`company_id`);--> statement-breakpoint
CREATE INDEX `prod_shoot_idx` ON `productions` (`shoot_date`);--> statement-breakpoint
CREATE TABLE `rundown_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`resume_token` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_normalised` text NOT NULL,
	`business_name` text NOT NULL,
	`website` text,
	`instagram_handle` text,
	`city` text,
	`is_melbourne_area` integer,
	`candidate_id` text,
	`profile_id` text,
	`outreach_candidate_id` text,
	`status` text DEFAULT 'entry_submitted' NOT NULL,
	`source_type` text DEFAULT 'public' NOT NULL,
	`tier_preference` text,
	`cta_clicked_at_ms` integer,
	`booking_token` text,
	`pack_downloaded_at_ms` integer,
	`followup_email_sent_at_ms` integer,
	`reveal_access_token` text,
	`reveal_access_expires_at_ms` integer,
	`entry_submitted_at_ms` integer NOT NULL,
	`assessment_started_at_ms` integer,
	`section_1_completed_at_ms` integer,
	`section_2_completed_at_ms` integer,
	`section_3_completed_at_ms` integer,
	`section_4_completed_at_ms` integer,
	`section_5_completed_at_ms` integer,
	`reveal_reached_at_ms` integer,
	`completed_at_ms` integer,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`referrer` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rundown_sessions_session_token_unique` ON `rundown_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `rundown_sessions_email_idx` ON `rundown_sessions` (`email_normalised`);--> statement-breakpoint
CREATE INDEX `rundown_sessions_candidate_idx` ON `rundown_sessions` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `rundown_sessions_token_idx` ON `rundown_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `rundown_sessions_status_idx` ON `rundown_sessions` (`status`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `rundown_sequence_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`email_number` integer NOT NULL,
	`track` text NOT NULL,
	`scheduled_task_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`subject` text,
	`body_html` text,
	`sent_at_ms` integer,
	`opened_at_ms` integer,
	`open_count` integer DEFAULT 0 NOT NULL,
	`clicked_at_ms` integer,
	`clicked_links` text,
	`reply_received_at_ms` integer,
	`reply_classification` text,
	`resend_message_id` text,
	`cancelled_at_ms` integer,
	`cancel_reason` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rundown_seq_session_idx` ON `rundown_sequence_emails` (`session_id`);--> statement-breakpoint
CREATE INDEX `rundown_seq_candidate_idx` ON `rundown_sequence_emails` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `rundown_seq_status_idx` ON `rundown_sequence_emails` (`status`,`email_number`);--> statement-breakpoint
CREATE INDEX `rundown_seq_task_idx` ON `rundown_sequence_emails` (`scheduled_task_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`brain_dump` text NOT NULL,
	`status` text DEFAULT 'idea' NOT NULL,
	`breakdown_json` text,
	`breakdown_generated_at_ms` integer,
	`draft_tasks_json` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_created_idx` ON `projects` (`created_at_ms`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_outreach_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text,
	`deal_id` text,
	`track` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`stopped_reason` text,
	`consecutive_non_engagements` integer DEFAULT 0 NOT NULL,
	`cutoff_threshold` integer DEFAULT 3 NOT NULL,
	`next_touch_due_at` integer,
	`last_touch_at` integer,
	`touches_sent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_outreach_sequences`("id", "candidate_id", "deal_id", "track", "status", "stopped_reason", "consecutive_non_engagements", "cutoff_threshold", "next_touch_due_at", "last_touch_at", "touches_sent", "created_at") SELECT "id", "candidate_id", "deal_id", "track", "status", "stopped_reason", "consecutive_non_engagements", "cutoff_threshold", "next_touch_due_at", "last_touch_at", "touches_sent", "created_at" FROM `outreach_sequences`;--> statement-breakpoint
DROP TABLE `outreach_sequences`;--> statement-breakpoint
ALTER TABLE `__new_outreach_sequences` RENAME TO `outreach_sequences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `outreach_sequences_candidate_idx` ON `outreach_sequences` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `outreach_sequences_deal_idx` ON `outreach_sequences` (`deal_id`);--> statement-breakpoint
CREATE INDEX `outreach_sequences_status_idx` ON `outreach_sequences` (`status`,`next_touch_due_at`);--> statement-breakpoint
CREATE TABLE `__new_outreach_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`candidate_id` text,
	`sequence_id` text NOT NULL,
	`deal_id` text,
	`resend_message_id` text NOT NULL,
	`sent_at` integer NOT NULL,
	`delivered_at` integer,
	`first_opened_at` integer,
	`open_count` integer DEFAULT 0 NOT NULL,
	`first_open_dwell_sec` integer,
	`first_clicked_at` integer,
	`click_count` integer DEFAULT 0 NOT NULL,
	`replied_at` integer,
	`bounced_at` integer,
	`bounce_kind` text,
	`unsubscribed_at` integer,
	`engagement_tier` integer,
	FOREIGN KEY (`draft_id`) REFERENCES `outreach_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_outreach_sends`("id", "draft_id", "candidate_id", "sequence_id", "deal_id", "resend_message_id", "sent_at", "delivered_at", "first_opened_at", "open_count", "first_open_dwell_sec", "first_clicked_at", "click_count", "replied_at", "bounced_at", "bounce_kind", "unsubscribed_at", "engagement_tier") SELECT "id", "draft_id", "candidate_id", "sequence_id", "deal_id", "resend_message_id", "sent_at", "delivered_at", "first_opened_at", "open_count", "first_open_dwell_sec", "first_clicked_at", "click_count", "replied_at", "bounced_at", "bounce_kind", "unsubscribed_at", "engagement_tier" FROM `outreach_sends`;--> statement-breakpoint
DROP TABLE `outreach_sends`;--> statement-breakpoint
ALTER TABLE `__new_outreach_sends` RENAME TO `outreach_sends`;--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_sends_resend_message_id_unique` ON `outreach_sends` (`resend_message_id`);--> statement-breakpoint
CREATE INDEX `outreach_sends_sequence_idx` ON `outreach_sends` (`sequence_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `outreach_sends_candidate_idx` ON `outreach_sends` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `outreach_sends_deal_idx` ON `outreach_sends` (`deal_id`);--> statement-breakpoint
CREATE INDEX `outreach_sends_resend_idx` ON `outreach_sends` (`resend_message_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_hidden_egg_fired_at_ms` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `hidden_egg_tricks_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `fired_egg_ids_recent` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD `candidate_id` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD `business_context` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD `signal_scores_intro` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD `signal_descriptions_json` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD `brand_pack_json` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `instagram_handle` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `youtube_url` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `facebook_url` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `linkedin_url` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `tiktok_url` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `viability_profile_json` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `enrichment_summary` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `enriched_at_ms` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD `preferred_channel` text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `faq_schema` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `contact_phone` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `contact_mobile` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `instagram_handle` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `youtube_url` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `facebook_url` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `linkedin_url` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `tiktok_url` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `ai_summary` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `quoted_session_price_cents` integer;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `quoted_production_price_cents` integer;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `reply_status` text;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `last_reply_at_ms` integer;--> statement-breakpoint
ALTER TABLE `lead_candidates` ADD `reply_draft_id` text;--> statement-breakpoint
ALTER TABLE `lead_runs` ADD `vertical_id` text;--> statement-breakpoint
ALTER TABLE `lead_runs` ADD `vertical_name` text;--> statement-breakpoint
ALTER TABLE `intro_funnel_submissions` ADD `selected_tier` text DEFAULT 'session' NOT NULL;--> statement-breakpoint
ALTER TABLE `intro_funnel_submissions` ADD `submitted_website_url` text;--> statement-breakpoint
ALTER TABLE `intro_funnel_submissions` ADD `submitted_instagram_handle` text;--> statement-breakpoint
ALTER TABLE `intro_funnel_submissions` ADD `submitted_intent` text;--> statement-breakpoint
ALTER TABLE `intro_funnel_submissions` ADD `viability_profile_json` text;