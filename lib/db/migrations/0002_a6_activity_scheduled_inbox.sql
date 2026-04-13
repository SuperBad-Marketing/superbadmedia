CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`contact_id` text,
	`deal_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`meta` text,
	`created_at_ms` integer NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE INDEX `activity_log_company_idx` ON `activity_log` (`company_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `activity_log_contact_idx` ON `activity_log` (`contact_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `activity_log_deal_idx` ON `activity_log` (`deal_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `activity_log_kind_idx` ON `activity_log` (`kind`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `scheduled_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_type` text NOT NULL,
	`run_at_ms` integer NOT NULL,
	`payload` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_attempted_at_ms` integer,
	`last_error` text,
	`idempotency_key` text,
	`created_at_ms` integer NOT NULL,
	`done_at_ms` integer,
	`reclaimed_at_ms` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_tasks_idempotency_key_unique` ON `scheduled_tasks` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `scheduled_tasks_due_idx` ON `scheduled_tasks` (`status`,`run_at_ms`);--> statement-breakpoint
CREATE INDEX `scheduled_tasks_type_idx` ON `scheduled_tasks` (`task_type`,`status`);--> statement-breakpoint
CREATE TABLE `worker_heartbeats` (
	`worker_name` text PRIMARY KEY NOT NULL,
	`last_tick_at_ms` integer NOT NULL,
	`last_tick_tasks_processed` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `external_call_log` (
	`id` text PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`shared_cohort_id` text,
	`units` text NOT NULL,
	`estimated_cost_aud` real NOT NULL,
	`prompt_version_hash` text,
	`converted_from_candidate_id` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `external_call_log_job_idx` ON `external_call_log` (`job`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `external_call_log_actor_idx` ON `external_call_log` (`actor_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `external_call_log_actor_type_idx` ON `external_call_log` (`actor_type`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`direction` text NOT NULL,
	`channel` text NOT NULL,
	`from_address` text NOT NULL,
	`to_addresses` text NOT NULL,
	`cc_addresses` text,
	`bcc_addresses` text,
	`subject` text,
	`body_text` text NOT NULL,
	`body_html` text,
	`headers` text,
	`message_id_header` text,
	`in_reply_to_header` text,
	`references_header` text,
	`sent_at_ms` integer,
	`received_at_ms` integer,
	`priority_class` text DEFAULT 'signal' NOT NULL,
	`noise_subclass` text,
	`notification_priority` text,
	`router_classification` text,
	`router_reason` text,
	`is_engaged` integer DEFAULT false NOT NULL,
	`engagement_signals` text,
	`import_source` text DEFAULT 'live' NOT NULL,
	`has_attachments` integer DEFAULT false NOT NULL,
	`has_calendar_invite` integer DEFAULT false NOT NULL,
	`graph_message_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `messages_mid_header_idx` ON `messages` (`message_id_header`);--> statement-breakpoint
CREATE INDEX `messages_in_reply_to_idx` ON `messages` (`in_reply_to_header`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`company_id` text,
	`channel_of_origin` text NOT NULL,
	`sending_address` text,
	`subject` text,
	`ticket_status` text,
	`ticket_type` text,
	`priority_class` text DEFAULT 'signal' NOT NULL,
	`keep_until_ms` integer,
	`keep_pinned` integer DEFAULT false NOT NULL,
	`last_message_at_ms` integer NOT NULL,
	`last_inbound_at_ms` integer,
	`last_outbound_at_ms` integer,
	`has_cached_draft` integer DEFAULT false NOT NULL,
	`cached_draft_body` text,
	`cached_draft_generated_at_ms` integer,
	`cached_draft_stale` integer DEFAULT false NOT NULL,
	`snoozed_until_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `threads_contact_idx` ON `threads` (`contact_id`,`last_message_at_ms`);--> statement-breakpoint
CREATE INDEX `threads_company_idx` ON `threads` (`company_id`,`last_message_at_ms`);--> statement-breakpoint
CREATE INDEX `threads_priority_idx` ON `threads` (`priority_class`,`last_message_at_ms`);