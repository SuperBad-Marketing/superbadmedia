-- SB-1: SaaS Subscription Billing schema foundation.
-- Source of truth: docs/specs/saas-subscription-billing.md §11.1 + §4.1.
-- Additive only. Reversible by:
--
--   DROP TABLE usage_records;
--   DROP TABLE saas_tier_limits;
--   DROP TABLE saas_usage_dimensions;
--   DROP TABLE saas_tiers;
--   DROP TABLE saas_products;
--   ALTER TABLE deals DROP COLUMN saas_product_id;
--   ALTER TABLE deals DROP COLUMN saas_tier_id;
--
-- `billing_cadence` already exists on `deals` (added QB-1). `activity_log.kind`
-- additions (11 new values per spec §11.3) + `scheduled_tasks.task_type`
-- additions (3 per §11.4) are schema-level TypeScript unions only — the SQL
-- `text` column accepts any string, so no migration statement is needed.
-- Tables land empty; no seed data.

CREATE TABLE `saas_products` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `slug` text NOT NULL UNIQUE,
  `status` text NOT NULL DEFAULT 'draft',
  `demo_enabled` integer NOT NULL DEFAULT 0,
  `demo_config` text,
  `menu_config` text,
  `product_config_schema` text,
  `stripe_product_id` text,
  `display_order` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `saas_products_status_idx` ON `saas_products` (`status`,`display_order`);--> statement-breakpoint

CREATE TABLE `saas_tiers` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL REFERENCES `saas_products`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `tier_rank` integer NOT NULL,
  `monthly_price_cents_inc_gst` integer NOT NULL,
  `setup_fee_cents_inc_gst` integer NOT NULL DEFAULT 0,
  `feature_flags` text,
  `stripe_monthly_price_id` text,
  `stripe_annual_price_id` text,
  `stripe_upfront_price_id` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `saas_tiers_product_idx` ON `saas_tiers` (`product_id`,`tier_rank`);--> statement-breakpoint

CREATE TABLE `saas_usage_dimensions` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL REFERENCES `saas_products`(`id`) ON DELETE CASCADE,
  `dimension_key` text NOT NULL,
  `display_name` text NOT NULL,
  `display_order` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `saas_usage_dimensions_product_key_idx` ON `saas_usage_dimensions` (`product_id`,`dimension_key`);--> statement-breakpoint

CREATE TABLE `saas_tier_limits` (
  `id` text PRIMARY KEY NOT NULL,
  `tier_id` text NOT NULL REFERENCES `saas_tiers`(`id`) ON DELETE CASCADE,
  `dimension_id` text NOT NULL REFERENCES `saas_usage_dimensions`(`id`) ON DELETE CASCADE,
  `limit_value` integer
);--> statement-breakpoint
CREATE UNIQUE INDEX `saas_tier_limits_tier_dim_idx` ON `saas_tier_limits` (`tier_id`,`dimension_id`);--> statement-breakpoint

CREATE TABLE `usage_records` (
  `id` text PRIMARY KEY NOT NULL,
  `contact_id` text NOT NULL REFERENCES `contacts`(`id`) ON DELETE CASCADE,
  `company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `product_id` text NOT NULL REFERENCES `saas_products`(`id`) ON DELETE CASCADE,
  `dimension_key` text NOT NULL,
  `billing_period_start_ms` integer NOT NULL,
  `recorded_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `usage_records_lookup_idx` ON `usage_records` (`contact_id`,`product_id`,`dimension_key`,`billing_period_start_ms`);--> statement-breakpoint

ALTER TABLE `deals` ADD COLUMN `saas_product_id` text;--> statement-breakpoint
ALTER TABLE `deals` ADD COLUMN `saas_tier_id` text;
