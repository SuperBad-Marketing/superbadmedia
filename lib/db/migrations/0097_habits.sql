CREATE TABLE IF NOT EXISTS `habits` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `icon` text,
  `link_href` text,
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
ALTER TABLE `habits` ADD COLUMN `description` text;
--> statement-breakpoint
ALTER TABLE `habits` ADD COLUMN `icon` text;
--> statement-breakpoint
ALTER TABLE `habits` ADD COLUMN `link_href` text;
--> statement-breakpoint
DELETE FROM `habits` WHERE `id` IN ('habit-001','habit-002','habit-003','habit-004','habit-005');
--> statement-breakpoint
INSERT OR IGNORE INTO `habits` (`id`, `title`, `description`, `icon`, `link_href`, `cadence`, `cadence_days`, `sort_order`, `active`, `created_at_ms`, `updated_at_ms`)
VALUES
  ('habit-001', 'Content Studio', 'Your feed won''t fill itself.', 'palette', '/lite/content', 'daily', NULL, 0, 1, 1745884800000, 1745884800000),
  ('habit-002', 'Script talking heads', 'Words before cameras.', 'video', '/lite/admin/briefs', '3x_week', NULL, 1, 1, 1745884800000, 1745884800000),
  ('habit-003', 'Review pipeline', 'See who''s warm. Who''s gone cold.', 'target', '/lite/admin/pipeline', 'daily', NULL, 2, 1, 1745884800000, 1745884800000),
  ('habit-004', 'Check leads', 'They wrote back. Probably.', 'inbox', '/lite/inbox', 'daily', NULL, 3, 1, 1745884800000, 1745884800000),
  ('habit-005', 'Post to socials', 'Maintain the illusion of consistency.', 'send', '/lite/content', 'daily', NULL, 4, 1, 1745884800000, 1745884800000);
