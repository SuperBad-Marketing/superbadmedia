-- CM-1: portal_chat_messages table + contacts portal columns + portal chat settings

CREATE TABLE IF NOT EXISTS `portal_chat_messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `contact_id` text NOT NULL REFERENCES `contacts`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `escalated_to_inbox` integer NOT NULL DEFAULT 0,
  `tool_action` text,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `portal_chat_messages_contact_idx` ON `portal_chat_messages` (`contact_id`, `created_at_ms`);--> statement-breakpoint

ALTER TABLE `contacts` ADD COLUMN `portal_chat_last_seen_at_ms` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD COLUMN `portal_last_visited_at_ms` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD COLUMN `retainer_kickoff_bartender_said_at_ms` integer;--> statement-breakpoint

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('portal.chat_calls_per_day_pre_retainer', '5', 'integer', 'Max AI chat messages per day for pre-retainer portal visitors (Opus-gated)', 0),
  ('portal.chat_calls_per_day_retainer', '25', 'integer', 'Max AI chat messages per day for retainer clients', 0),
  ('portal.data_export_zip_ttl_days', '7', 'integer', 'Days before a client data export ZIP expires', 0);
