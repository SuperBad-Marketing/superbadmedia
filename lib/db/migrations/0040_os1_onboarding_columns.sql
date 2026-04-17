ALTER TABLE `companies` ADD COLUMN `revenue_range` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `team_size` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `biggest_constraint` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `twelve_month_goal` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `industry_vertical` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `industry_vertical_other` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `location` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `revenue_segmentation_completed_at_ms` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD COLUMN `onboarding_welcome_seen_at_ms` integer;
