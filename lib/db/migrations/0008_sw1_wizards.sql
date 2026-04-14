CREATE TABLE `wizard_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`wizard_key` text NOT NULL,
	`user_id` text NOT NULL,
	`audience` text NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`step_state` text,
	`started_at_ms` integer NOT NULL,
	`last_active_at_ms` integer NOT NULL,
	`abandoned_at_ms` integer,
	`expires_at_ms` integer NOT NULL,
	`resumed_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wizard_progress_user_idx` ON `wizard_progress` (`user_id`,`last_active_at_ms`);--> statement-breakpoint
CREATE INDEX `wizard_progress_wizard_idx` ON `wizard_progress` (`wizard_key`,`last_active_at_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `wizard_progress_live_unique_idx` ON `wizard_progress` (`user_id`,`wizard_key`) WHERE abandoned_at_ms IS NULL;--> statement-breakpoint
CREATE TABLE `wizard_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`wizard_key` text NOT NULL,
	`user_id` text NOT NULL,
	`audience` text NOT NULL,
	`completion_payload` text NOT NULL,
	`contract_version` text NOT NULL,
	`completed_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wizard_completions_user_wizard_idx` ON `wizard_completions` (`user_id`,`wizard_key`,`completed_at_ms`);--> statement-breakpoint
CREATE INDEX `wizard_completions_wizard_idx` ON `wizard_completions` (`wizard_key`,`completed_at_ms`);--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_key` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`credentials` text NOT NULL,
	`metadata` text,
	`connection_verified_at_ms` integer NOT NULL,
	`band_registration_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`connected_via_wizard_completion_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integration_connections_owner_vendor_idx` ON `integration_connections` (`owner_type`,`owner_id`,`vendor_key`);--> statement-breakpoint
CREATE INDEX `integration_connections_vendor_status_idx` ON `integration_connections` (`vendor_key`,`status`);
