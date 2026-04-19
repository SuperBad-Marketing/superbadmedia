CREATE TABLE IF NOT EXISTS `private_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `contact_id` text NOT NULL REFERENCES `contacts`(`id`) ON DELETE CASCADE,
  `content` text NOT NULL,
  `created_by` text REFERENCES `user`(`id`) ON DELETE SET NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `private_notes_contact_idx` ON `private_notes` (`contact_id`, `created_at_ms`);
