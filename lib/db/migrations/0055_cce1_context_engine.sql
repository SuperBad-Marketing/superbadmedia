ALTER TABLE `contacts` ADD `preferred_channel` text DEFAULT 'email' NOT NULL;
--> statement-breakpoint
CREATE TABLE `context_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL REFERENCES `contacts`(`id`) ON DELETE cascade,
	`conversation_summary` text,
	`summary_generated_at_ms` integer,
	`draft_content` text,
	`draft_channel` text,
	`draft_nudge_history` text,
	`draft_generated_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `context_summaries_contact_id_unique` ON `context_summaries` (`contact_id`);
--> statement-breakpoint
CREATE INDEX `context_summaries_contact_idx` ON `context_summaries` (`contact_id`);
--> statement-breakpoint
CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL REFERENCES `contacts`(`id`) ON DELETE cascade,
	`description` text NOT NULL,
	`owner` text NOT NULL,
	`due_date_ms` integer,
	`source` text NOT NULL,
	`source_message_id` text REFERENCES `messages`(`id`) ON DELETE set null,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`completed_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `action_items_contact_status_idx` ON `action_items` (`contact_id`, `status`);
--> statement-breakpoint
CREATE INDEX `action_items_owner_status_idx` ON `action_items` (`owner`, `status`, `due_date_ms`);
--> statement-breakpoint
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
CREATE INDEX `llm_usage_log_type_idx` ON `llm_usage_log` (`call_type`, `created_at_ms`);
--> statement-breakpoint
CREATE INDEX `llm_usage_log_contact_idx` ON `llm_usage_log` (`contact_id`);
