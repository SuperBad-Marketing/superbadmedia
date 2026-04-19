CREATE TABLE `active_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE cascade,
	`origin` text NOT NULL,
	`source_id` text,
	`status` text DEFAULT 'pending_refresh_review' NOT NULL,
	`payload_json` text,
	`pending_refresh_review` integer DEFAULT true NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`reviewed_at_ms` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_strategies_client_id_unique` ON `active_strategies` (`client_id`);
--> statement-breakpoint
CREATE INDEX `as_client_idx` ON `active_strategies` (`client_id`);
--> statement-breakpoint
CREATE INDEX `as_status_idx` ON `active_strategies` (`status`);
