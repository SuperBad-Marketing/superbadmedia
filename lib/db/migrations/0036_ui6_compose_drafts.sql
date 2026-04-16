CREATE TABLE `compose_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `author_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `thread_id` text REFERENCES `threads`(`id`) ON DELETE SET NULL,
  `contact_id` text REFERENCES `contacts`(`id`) ON DELETE SET NULL,
  `company_id` text REFERENCES `companies`(`id`) ON DELETE SET NULL,
  `to_addresses` text,
  `cc_addresses` text,
  `bcc_addresses` text,
  `subject` text,
  `body_text` text NOT NULL DEFAULT '',
  `sending_address` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `compose_drafts_author_idx` ON `compose_drafts` (`author_user_id`, `updated_at_ms`);--> statement-breakpoint
CREATE INDEX `compose_drafts_thread_idx` ON `compose_drafts` (`thread_id`);--> statement-breakpoint
CREATE INDEX `compose_drafts_contact_idx` ON `compose_drafts` (`contact_id`);
