CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`surface` text NOT NULL,
	`page_url` text NOT NULL,
	`description` text,
	`session_replay_url` text,
	`sentry_issue_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `support_tickets_status_idx` ON `support_tickets` (`status`,`created_at_ms`);
--> statement-breakpoint
CREATE INDEX `support_tickets_user_idx` ON `support_tickets` (`user_id`);
