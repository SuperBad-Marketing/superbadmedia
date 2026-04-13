CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`email_verified_ms` integer,
	`image` text,
	`role` text DEFAULT 'prospect' NOT NULL,
	`timezone` text DEFAULT 'Australia/Melbourne' NOT NULL,
	`motion_preference` text DEFAULT 'full' NOT NULL,
	`sounds_enabled` integer DEFAULT true NOT NULL,
	`density_preference` text DEFAULT 'comfortable' NOT NULL,
	`text_size_preference` text DEFAULT 'default' NOT NULL,
	`theme_preset` text DEFAULT 'base-nova' NOT NULL,
	`typeface_preset` text DEFAULT 'default' NOT NULL,
	`first_signed_in_at_ms` integer,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);