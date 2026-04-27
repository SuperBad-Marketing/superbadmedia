CREATE TABLE IF NOT EXISTS `habits` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `cadence` text NOT NULL DEFAULT 'daily',
  `cadence_days` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `active` integer NOT NULL DEFAULT 1,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `habits_active_sort_idx` ON `habits` (`active`, `sort_order`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `habit_completions` (
  `id` text PRIMARY KEY NOT NULL,
  `habit_id` text NOT NULL REFERENCES `habits`(`id`) ON DELETE CASCADE,
  `completed_date` text NOT NULL,
  `completed_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `habit_completions_habit_date_uniq` ON `habit_completions` (`habit_id`, `completed_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `habit_completions_by_date_idx` ON `habit_completions` (`habit_id`, `completed_date`);
--> statement-breakpoint
INSERT OR IGNORE INTO `habits` (`id`, `title`, `cadence`, `cadence_days`, `sort_order`, `active`, `created_at_ms`, `updated_at_ms`)
VALUES
  ('habit-001', 'Generate content in Content Studio', 'daily', NULL, 0, 1, 1745884800000, 1745884800000),
  ('habit-002', 'Script next batch of talking head videos', '3x_week', NULL, 1, 1, 1745884800000, 1745884800000),
  ('habit-003', 'Review pipeline', 'daily', NULL, 2, 1, 1745884800000, 1745884800000),
  ('habit-004', 'Check and respond to leads', 'daily', NULL, 3, 1, 1745884800000, 1745884800000),
  ('habit-005', 'Post to socials', 'daily', NULL, 4, 1, 1745884800000, 1745884800000);
