ALTER TABLE `contacts` ADD COLUMN `relationship_type` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD COLUMN `inbox_alt_emails` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `contacts` ADD COLUMN `notification_weight` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contacts` ADD COLUMN `always_keep_noise` integer NOT NULL DEFAULT 0;
