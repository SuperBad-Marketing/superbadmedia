CREATE TABLE IF NOT EXISTS `proposals` (
  `id` text PRIMARY KEY NOT NULL,
  `token` text NOT NULL,
  `proposal_number` text NOT NULL,
  `company_id` text REFERENCES `companies`(`id`) ON DELETE SET NULL,
  `deal_id` text REFERENCES `deals`(`id`) ON DELETE SET NULL,
  `primary_contact_id` text REFERENCES `contacts`(`id`) ON DELETE SET NULL,
  `title` text NOT NULL,
  `subtitle` text,
  `client_name` text NOT NULL,
  `sections_json` text NOT NULL,
  `status` text NOT NULL DEFAULT 'draft',
  `created_by_user_id` text REFERENCES `user`(`id`),
  `last_edited_by_user_id` text REFERENCES `user`(`id`),
  `pdf_cache_key` text,
  `sent_at_ms` integer,
  `viewed_at_ms` integer,
  `accepted_at_ms` integer,
  `withdrawn_at_ms` integer,
  `expires_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `proposals_token_unique` ON `proposals` (`token`);
CREATE INDEX IF NOT EXISTS `proposals_company_idx` ON `proposals` (`company_id`);
CREATE INDEX IF NOT EXISTS `proposals_deal_idx` ON `proposals` (`deal_id`);
CREATE INDEX IF NOT EXISTS `proposals_status_idx` ON `proposals` (`status`);
CREATE INDEX IF NOT EXISTS `proposals_token_idx` ON `proposals` (`token`);
