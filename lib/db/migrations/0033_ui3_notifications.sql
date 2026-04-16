CREATE TABLE `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text REFERENCES `messages`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `priority` text NOT NULL CHECK(`priority` IN ('urgent', 'push', 'silent')),
  `fired_transport` text CHECK(`fired_transport` IN ('web_push', 'pwa_push', 'none')),
  `fired_at_ms` integer NOT NULL,
  `reason` text NOT NULL,
  `correction_action` text CHECK(`correction_action` IN ('user_opened', 'user_corrected_up', 'user_corrected_down')),
  `correction_at_ms` integer
);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`, `fired_at_ms`);--> statement-breakpoint
CREATE INDEX `notifications_message_idx` ON `notifications` (`message_id`);--> statement-breakpoint
CREATE INDEX `notifications_priority_idx` ON `notifications` (`priority`, `fired_at_ms`);
