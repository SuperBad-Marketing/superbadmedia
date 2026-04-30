CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`brain_dump` text NOT NULL,
	`status` text DEFAULT 'idea' NOT NULL,
	`breakdown_json` text,
	`breakdown_generated_at_ms` integer,
	`draft_tasks_json` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_by` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `projects_status_idx` ON `projects` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `projects_created_idx` ON `projects` (`created_at_ms`);
