CREATE TABLE `classification_corrections` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL REFERENCES `messages`(`id`) ON DELETE CASCADE,
  `classifier` text NOT NULL CHECK(`classifier` IN ('router', 'notifier', 'signal_noise')),
  `original_classification` text NOT NULL,
  `corrected_classification` text NOT NULL,
  `correction_source` text NOT NULL CHECK(`correction_source` IN ('explicit_reroute', 'engagement_implicit', 'keep_pinned')),
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `classification_corrections_message_idx` ON `classification_corrections` (`message_id`);--> statement-breakpoint
CREATE INDEX `classification_corrections_classifier_idx` ON `classification_corrections` (`classifier`, `created_at_ms`);
