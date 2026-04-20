CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`kind` text NOT NULL,
	`status` text NOT NULL DEFAULT 'todo',
	`priority` text NOT NULL DEFAULT 'normal',
	`due_at_ms` integer,
	`entity_type` text,
	`entity_id` text,
	`checklist` text,
	`checklist_auto_complete` integer NOT NULL DEFAULT 1,
	`recurrence` text,
	`recurrence_day` integer,
	`parent_recurrence_id` text,
	`source_braindump_id` text,
	`approval_requested_at_ms` integer,
	`approval_viewed_at_ms` integer,
	`approved_at_ms` integer,
	`approved_by_contact_id` text REFERENCES `contacts`(`id`) ON DELETE SET NULL,
	`rejected_at_ms` integer,
	`rejection_feedback` text,
	`approval_token` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`completed_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `tasks_status_due_idx` ON `tasks` (`status`, `due_at_ms`);
--> statement-breakpoint
CREATE INDEX `tasks_entity_idx` ON `tasks` (`entity_type`, `entity_id`);
--> statement-breakpoint
CREATE INDEX `tasks_kind_status_idx` ON `tasks` (`kind`, `status`);
--> statement-breakpoint
CREATE INDEX `tasks_approval_token_idx` ON `tasks` (`approval_token`);
--> statement-breakpoint
CREATE INDEX `tasks_parent_recurrence_idx` ON `tasks` (`parent_recurrence_id`);
--> statement-breakpoint
CREATE INDEX `tasks_source_braindump_idx` ON `tasks` (`source_braindump_id`);
--> statement-breakpoint
CREATE TABLE `braindumps` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_text` text NOT NULL,
	`surface_context` text,
	`parsed_at_ms` integer,
	`committed_at_ms` integer,
	`task_count` integer NOT NULL DEFAULT 0,
	`created_by` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`created_at_ms` integer NOT NULL
);
