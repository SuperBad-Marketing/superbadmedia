-- QB-1: Quote Builder schema foundation.
-- Source of truth: docs/specs/quote-builder.md §5 + §8 (handler slot only).
-- Additive only. Reversible by dropping the four new tables, dropping the
-- two `companies` columns, and deleting the seeded settings rows:
--
--   DROP TABLE quotes;
--   DROP TABLE quote_templates;
--   DROP TABLE catalogue_items;
--   DROP TABLE sequences;
--   ALTER TABLE companies DROP COLUMN abn;
--   ALTER TABLE companies DROP COLUMN gst_applicable;
--   DELETE FROM settings WHERE key IN (
--     'quote.default_expiry_days',
--     'quote.setup_fee_monthly_saas'
--   );
--
-- No data shape at v1.0 ship — tables land empty.

ALTER TABLE `companies` ADD COLUMN `gst_applicable` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `abn` text;--> statement-breakpoint

CREATE TABLE `sequences` (
  `name` text PRIMARY KEY NOT NULL,
  `current_value` integer NOT NULL DEFAULT 0
);--> statement-breakpoint

CREATE TABLE `catalogue_items` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL,
  `unit` text NOT NULL,
  `base_price_cents_inc_gst` integer NOT NULL,
  `tier_rank` integer,
  `description` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  `deleted_at_ms` integer
);--> statement-breakpoint
CREATE INDEX `catalogue_items_category_idx` ON `catalogue_items` (`category`);--> statement-breakpoint
CREATE INDEX `catalogue_items_tier_rank_idx` ON `catalogue_items` (`tier_rank`);--> statement-breakpoint

CREATE TABLE `quote_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `structure` text NOT NULL,
  `term_length_months` integer,
  `default_sections_json` text,
  `default_line_items_json` text,
  `usage_count` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  `deleted_at_ms` integer
);--> statement-breakpoint
CREATE INDEX `quote_templates_structure_idx` ON `quote_templates` (`structure`);--> statement-breakpoint

CREATE TABLE `quotes` (
  `id` text PRIMARY KEY NOT NULL,
  `deal_id` text NOT NULL REFERENCES `deals`(`id`) ON DELETE CASCADE,
  `company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `token` text NOT NULL UNIQUE,
  `quote_number` text NOT NULL UNIQUE,
  `status` text NOT NULL DEFAULT 'draft',
  `structure` text NOT NULL,
  `content_json` text,
  `catalogue_snapshot_json` text,
  `total_cents_inc_gst` integer NOT NULL,
  `retainer_monthly_cents_inc_gst` integer,
  `one_off_cents_inc_gst` integer,
  `term_length_months` integer,
  `committed_until_date_ms` integer,
  `buyout_percentage` integer NOT NULL DEFAULT 50,
  `tier_rank` integer,
  `created_at_ms` integer NOT NULL,
  `sent_at_ms` integer,
  `viewed_at_ms` integer,
  `accepted_at_ms` integer,
  `expires_at_ms` integer,
  `superseded_at_ms` integer,
  `withdrawn_at_ms` integer,
  `supersedes_quote_id` text REFERENCES `quotes`(`id`) ON DELETE SET NULL,
  `superseded_by_quote_id` text REFERENCES `quotes`(`id`) ON DELETE SET NULL,
  `accepted_content_hash` text,
  `accepted_ip` text,
  `accepted_user_agent` text,
  `stripe_payment_intent_id` text,
  `stripe_subscription_id` text,
  `pdf_cache_key` text,
  `thread_message_id` text,
  `last_edited_by_user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL
);--> statement-breakpoint
CREATE INDEX `quotes_deal_idx` ON `quotes` (`deal_id`);--> statement-breakpoint
CREATE INDEX `quotes_company_idx` ON `quotes` (`company_id`);--> statement-breakpoint
CREATE INDEX `quotes_status_idx` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `quotes_expires_at_idx` ON `quotes` (`expires_at_ms`);--> statement-breakpoint

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('quote.default_expiry_days', '14', 'integer', 'Default expiry window for newly-drafted quotes (spec Q8 / §4.1 — per-quote picker overrides).', 0),
  ('quote.setup_fee_monthly_saas', '0', 'integer', 'One-off setup fee in cents applied to SaaS subscription signups; 0 = no fee. Consumed by QB-5 + SaaS Subscription Billing.', 0);
