-- Meta ad accounts
CREATE TABLE IF NOT EXISTS `meta_ad_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `meta_account_id` text NOT NULL,
  `name` text NOT NULL,
  `currency` text NOT NULL DEFAULT 'AUD',
  `timezone` text NOT NULL DEFAULT 'Australia/Melbourne',
  `status` text NOT NULL DEFAULT 'active',
  `access_token_encrypted` text,
  `pixel_id` text,
  `pixel_installed` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);

-- Campaigns
CREATE TABLE IF NOT EXISTS `meta_campaigns` (
  `id` text PRIMARY KEY NOT NULL,
  `meta_campaign_id` text,
  `ad_account_id` text NOT NULL REFERENCES `meta_ad_accounts`(`id`),
  `company_id` text REFERENCES `companies`(`id`) ON DELETE SET NULL,
  `name` text NOT NULL,
  `objective` text NOT NULL,
  `funnel_stage` text NOT NULL,
  `status` text NOT NULL DEFAULT 'draft',
  `daily_budget_cents` integer NOT NULL,
  `lifetime_budget_cents` integer,
  `total_spent_cents` integer NOT NULL DEFAULT 0,
  `start_date_ms` integer,
  `end_date_ms` integer,
  `scaling_mode` text NOT NULL DEFAULT 'off',
  `scaling_daily_cap_cents` integer,
  `scaling_velocity_pct` integer NOT NULL DEFAULT 20,
  `scaling_roas_floor` real,
  `human_checkpoint_enabled` integer NOT NULL DEFAULT 1,
  `human_checkpoint_spend_cents` integer,
  `strategy_notes` text,
  `ai_strategy_json` text,
  `content_pool_tag` text,
  `created_by_user_id` text REFERENCES `user`(`id`),
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_campaigns_account_idx` ON `meta_campaigns` (`ad_account_id`);
CREATE INDEX IF NOT EXISTS `meta_campaigns_status_idx` ON `meta_campaigns` (`status`);
CREATE INDEX IF NOT EXISTS `meta_campaigns_company_idx` ON `meta_campaigns` (`company_id`);

-- Ad sets
CREATE TABLE IF NOT EXISTS `meta_ad_sets` (
  `id` text PRIMARY KEY NOT NULL,
  `meta_adset_id` text,
  `campaign_id` text NOT NULL REFERENCES `meta_campaigns`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `status` text NOT NULL DEFAULT 'draft',
  `funnel_stage` text NOT NULL,
  `audience_type` text NOT NULL,
  `audience_config_json` text,
  `meta_audience_id` text,
  `daily_budget_cents` integer NOT NULL,
  `bid_strategy` text NOT NULL DEFAULT 'lowest_cost',
  `bid_amount_cents` integer,
  `placements_json` text,
  `age_min` integer,
  `age_max` integer,
  `genders_json` text,
  `locations_json` text,
  `interests_json` text,
  `optimization_goal` text,
  `primary_metric` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_ad_sets_campaign_idx` ON `meta_ad_sets` (`campaign_id`);
CREATE INDEX IF NOT EXISTS `meta_ad_sets_status_idx` ON `meta_ad_sets` (`status`);

-- Ads
CREATE TABLE IF NOT EXISTS `meta_ads` (
  `id` text PRIMARY KEY NOT NULL,
  `meta_ad_id` text,
  `ad_set_id` text NOT NULL REFERENCES `meta_ad_sets`(`id`) ON DELETE CASCADE,
  `campaign_id` text NOT NULL REFERENCES `meta_campaigns`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `status` text NOT NULL DEFAULT 'draft',
  `creative_type` text NOT NULL,
  `creative_source` text NOT NULL,
  `content_studio_post_id` text,
  `asset_url` text,
  `thumbnail_url` text,
  `headline` text,
  `primary_text` text,
  `description` text,
  `cta_type` text,
  `destination_url` text,
  `is_variation` integer NOT NULL DEFAULT 0,
  `variation_group` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_ads_adset_idx` ON `meta_ads` (`ad_set_id`);
CREATE INDEX IF NOT EXISTS `meta_ads_campaign_idx` ON `meta_ads` (`campaign_id`);
CREATE INDEX IF NOT EXISTS `meta_ads_status_idx` ON `meta_ads` (`status`);

-- Campaign metrics snapshots
CREATE TABLE IF NOT EXISTS `meta_campaign_metrics` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL REFERENCES `meta_campaigns`(`id`) ON DELETE CASCADE,
  `ad_set_id` text REFERENCES `meta_ad_sets`(`id`) ON DELETE CASCADE,
  `ad_id` text REFERENCES `meta_ads`(`id`) ON DELETE CASCADE,
  `date_ms` integer NOT NULL,
  `granularity` text NOT NULL DEFAULT 'daily',
  `impressions` integer NOT NULL DEFAULT 0,
  `reach` integer NOT NULL DEFAULT 0,
  `clicks` integer NOT NULL DEFAULT 0,
  `link_clicks` integer NOT NULL DEFAULT 0,
  `spend_cents` integer NOT NULL DEFAULT 0,
  `cpm_cents` integer,
  `cpc_cents` integer,
  `ctr_pct` real,
  `conversions` integer NOT NULL DEFAULT 0,
  `conversion_value_cents` integer NOT NULL DEFAULT 0,
  `roas` real,
  `cpa_cents` integer,
  `video_views` integer NOT NULL DEFAULT 0,
  `video_views_p25` integer NOT NULL DEFAULT 0,
  `video_views_p50` integer NOT NULL DEFAULT 0,
  `video_views_p75` integer NOT NULL DEFAULT 0,
  `video_views_p100` integer NOT NULL DEFAULT 0,
  `engagement_total` integer NOT NULL DEFAULT 0,
  `likes` integer NOT NULL DEFAULT 0,
  `comments` integer NOT NULL DEFAULT 0,
  `shares` integer NOT NULL DEFAULT 0,
  `saves` integer NOT NULL DEFAULT 0,
  `leads` integer NOT NULL DEFAULT 0,
  `lead_cost_cents` integer,
  `created_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_metrics_campaign_idx` ON `meta_campaign_metrics` (`campaign_id`);
CREATE INDEX IF NOT EXISTS `meta_metrics_date_idx` ON `meta_campaign_metrics` (`date_ms`);
CREATE INDEX IF NOT EXISTS `meta_metrics_ad_idx` ON `meta_campaign_metrics` (`ad_id`);

-- Performance benchmarks
CREATE TABLE IF NOT EXISTS `meta_performance_benchmarks` (
  `id` text PRIMARY KEY NOT NULL,
  `funnel_stage` text NOT NULL,
  `objective` text NOT NULL,
  `vertical` text,
  `primary_metric` text NOT NULL,
  `good_threshold` real NOT NULL,
  `scale_threshold` real NOT NULL,
  `kill_threshold` real NOT NULL,
  `metric_unit` text NOT NULL,
  `metric_direction` text NOT NULL,
  `min_data_days` integer NOT NULL DEFAULT 3,
  `min_impressions` integer NOT NULL DEFAULT 1000,
  `min_conversions` integer,
  `notes` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_benchmarks_stage_idx` ON `meta_performance_benchmarks` (`funnel_stage`, `objective`);

-- Optimization log
CREATE TABLE IF NOT EXISTS `meta_optimization_log` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL REFERENCES `meta_campaigns`(`id`) ON DELETE CASCADE,
  `ad_set_id` text REFERENCES `meta_ad_sets`(`id`),
  `ad_id` text REFERENCES `meta_ads`(`id`),
  `action` text NOT NULL,
  `reason` text NOT NULL,
  `details_json` text,
  `old_budget_cents` integer,
  `new_budget_cents` integer,
  `metric_value` real,
  `benchmark_threshold` real,
  `applied` integer NOT NULL DEFAULT 1,
  `requires_approval` integer NOT NULL DEFAULT 0,
  `approved_at_ms` integer,
  `approved_by_user_id` text REFERENCES `user`(`id`),
  `created_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_opt_log_campaign_idx` ON `meta_optimization_log` (`campaign_id`);
CREATE INDEX IF NOT EXISTS `meta_opt_log_action_idx` ON `meta_optimization_log` (`action`);
CREATE INDEX IF NOT EXISTS `meta_opt_log_created_idx` ON `meta_optimization_log` (`created_at_ms`);

-- Campaign reports
CREATE TABLE IF NOT EXISTS `meta_campaign_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL REFERENCES `meta_campaigns`(`id`) ON DELETE CASCADE,
  `report_type` text NOT NULL,
  `period_start_ms` integer NOT NULL,
  `period_end_ms` integer NOT NULL,
  `summary_json` text NOT NULL,
  `highlights` text,
  `actions_taken` text,
  `recommendations` text,
  `total_spend_cents` integer NOT NULL DEFAULT 0,
  `total_impressions` integer NOT NULL DEFAULT 0,
  `total_clicks` integer NOT NULL DEFAULT 0,
  `total_conversions` integer NOT NULL DEFAULT 0,
  `period_roas` real,
  `created_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_reports_campaign_idx` ON `meta_campaign_reports` (`campaign_id`);
CREATE INDEX IF NOT EXISTS `meta_reports_type_idx` ON `meta_campaign_reports` (`report_type`);

-- Content pool tags
CREATE TABLE IF NOT EXISTS `meta_content_pool_tags` (
  `id` text PRIMARY KEY NOT NULL,
  `tag` text NOT NULL,
  `content_type` text NOT NULL,
  `content_id` text NOT NULL,
  `campaign_id` text REFERENCES `meta_campaigns`(`id`) ON DELETE SET NULL,
  `created_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `meta_pool_tags_tag_idx` ON `meta_content_pool_tags` (`tag`);
CREATE INDEX IF NOT EXISTS `meta_pool_tags_content_idx` ON `meta_content_pool_tags` (`content_id`);
