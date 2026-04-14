-- SP-1: Sales Pipeline CRM spine.
-- Hand-authored (not drizzle-kit generated) because the snapshot chain
-- lost continuity at 0005; drizzle-kit diff against 0004_snapshot
-- would try to recreate every table from 0005 onward. Snapshot
-- 0011_snapshot.json captures the true current state so future
-- migrations diff cleanly.
--
-- Owns: companies, contacts, deals, webhook_events.
-- Upgrades activity_log with FK refs to companies / contacts / deals
-- (closes the `a6_activity_log_fk_refs_deferred` intent noted in
-- lib/db/schema/activity-log.ts).

CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalised` text NOT NULL,
	`domain` text,
	`industry` text,
	`size_band` text,
	`billing_mode` text DEFAULT 'stripe' NOT NULL,
	`do_not_contact` integer DEFAULT false NOT NULL,
	`notes` text,
	`trial_shoot_status` text DEFAULT 'none' NOT NULL,
	`trial_shoot_completed_at_ms` integer,
	`trial_shoot_plan` text,
	`trial_shoot_feedback` text,
	`shape` text,
	`first_seen_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `companies_name_norm_idx` ON `companies` (`name_normalised`);--> statement-breakpoint
CREATE INDEX `companies_domain_idx` ON `companies` (`domain`);--> statement-breakpoint
CREATE INDEX `companies_billing_mode_idx` ON `companies` (`billing_mode`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`email` text,
	`email_normalised` text,
	`email_status` text DEFAULT 'unknown' NOT NULL,
	`phone` text,
	`phone_normalised` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`notes` text,
	`stripe_customer_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_stripe_customer_id_unique` ON `contacts` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE INDEX `contacts_email_norm_idx` ON `contacts` (`email_normalised`);--> statement-breakpoint
CREATE INDEX `contacts_phone_norm_idx` ON `contacts` (`phone_normalised`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`primary_contact_id` text,
	`title` text NOT NULL,
	`stage` text DEFAULT 'lead' NOT NULL,
	`value_cents` integer,
	`value_estimated` integer DEFAULT true NOT NULL,
	`won_outcome` text,
	`loss_reason` text,
	`loss_notes` text,
	`next_action_text` text,
	`next_action_overridden_at_ms` integer,
	`snoozed_until_ms` integer,
	`last_stage_change_at_ms` integer NOT NULL,
	`source` text,
	`subscription_state` text,
	`committed_until_date_ms` integer,
	`pause_used_this_commitment` integer DEFAULT false NOT NULL,
	`billing_cadence` text,
	`stripe_subscription_id` text,
	`stripe_customer_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `deals_company_idx` ON `deals` (`company_id`);--> statement-breakpoint
CREATE INDEX `deals_contact_idx` ON `deals` (`primary_contact_id`);--> statement-breakpoint
CREATE INDEX `deals_stage_idx` ON `deals` (`stage`,`last_stage_change_at_ms`);--> statement-breakpoint
CREATE INDEX `deals_stripe_subscription_idx` ON `deals` (`stripe_subscription_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`processed_at_ms` integer NOT NULL,
	`result` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `webhook_events_provider_type_idx` ON `webhook_events` (`provider`,`event_type`,`processed_at_ms`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`contact_id` text,
	`deal_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`meta` text,
	`created_at_ms` integer NOT NULL,
	`created_by` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_activity_log`("id", "company_id", "contact_id", "deal_id", "kind", "body", "meta", "created_at_ms", "created_by") SELECT "id", "company_id", "contact_id", "deal_id", "kind", "body", "meta", "created_at_ms", "created_by" FROM `activity_log`;--> statement-breakpoint
DROP TABLE `activity_log`;--> statement-breakpoint
ALTER TABLE `__new_activity_log` RENAME TO `activity_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `activity_log_company_idx` ON `activity_log` (`company_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `activity_log_contact_idx` ON `activity_log` (`contact_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `activity_log_deal_idx` ON `activity_log` (`deal_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `activity_log_kind_idx` ON `activity_log` (`kind`,`created_at_ms`);
