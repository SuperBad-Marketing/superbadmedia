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
CREATE INDEX `swp_deal_idx` ON `six_week_plans` (`deal_id`);
--> statement-breakpoint
CREATE INDEX `swp_company_idx` ON `six_week_plans` (`company_id`);
--> statement-breakpoint
CREATE INDEX `swp_status_idx` ON `six_week_plans` (`status`);
--> statement-breakpoint
CREATE INDEX `swp_parent_idx` ON `six_week_plans` (`parent_plan_id`);
--> statement-breakpoint
CREATE TABLE `six_week_plan_task_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`task_index` integer NOT NULL,
	`completed_at_ms` integer,
	FOREIGN KEY (`plan_id`) REFERENCES `six_week_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `swptp_plan_idx` ON `six_week_plan_task_progress` (`plan_id`);
--> statement-breakpoint
CREATE INDEX `swptp_plan_week_idx` ON `six_week_plan_task_progress` (`plan_id`, `week_number`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `trial_shoot_notes_deal_id_unique` ON `trial_shoot_notes` (`deal_id`);
--> statement-breakpoint
CREATE INDEX `tsn_deal_idx` ON `trial_shoot_notes` (`deal_id`);
