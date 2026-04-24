-- Instagram Channel — §5 data model
-- All seven tables for the Instagram channel feature.

CREATE TABLE IF NOT EXISTS `instagram_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `instagram_user_id` text NOT NULL,
  `username` text NOT NULL,
  `account_type` text NOT NULL DEFAULT 'own',
  `company_id` text,
  `access_token` text NOT NULL,
  `token_expires_at_ms` integer,
  `connected_at_ms` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS `ig_accounts_status_idx` ON `instagram_accounts` (`status`);
CREATE INDEX IF NOT EXISTS `ig_accounts_type_idx` ON `instagram_accounts` (`account_type`);

CREATE TABLE IF NOT EXISTS `instagram_metrics_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `snapshot_date` text NOT NULL,
  `followers` integer,
  `follows` integer,
  `reach` integer,
  `impressions` integer,
  `profile_views` integer,
  `website_clicks` integer,
  `synced_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `ig_metrics_account_date_idx` ON `instagram_metrics_snapshots` (`account_id`, `snapshot_date`);

CREATE TABLE IF NOT EXISTS `instagram_media` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `ig_media_id` text NOT NULL,
  `media_type` text NOT NULL,
  `source_post_id` text,
  `caption` text,
  `permalink` text,
  `thumbnail_url` text,
  `published_at_ms` integer NOT NULL,
  `engagement_score` real,
  `likes` integer,
  `comments_count` integer,
  `saves` integer,
  `shares` integer,
  `reach` integer,
  `impressions` integer,
  `video_views` integer,
  `video_avg_watch_ms` integer,
  `boost_status` text NOT NULL DEFAULT 'none',
  `boost_budget_cents` integer,
  `boost_start_ms` integer,
  `boost_end_ms` integer,
  `last_synced_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `ig_media_account_idx` ON `instagram_media` (`account_id`);
CREATE INDEX IF NOT EXISTS `ig_media_published_idx` ON `instagram_media` (`published_at_ms`);
CREATE INDEX IF NOT EXISTS `ig_media_ig_id_idx` ON `instagram_media` (`ig_media_id`);
CREATE INDEX IF NOT EXISTS `ig_media_source_post_idx` ON `instagram_media` (`source_post_id`);

CREATE TABLE IF NOT EXISTS `instagram_audience_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `snapshot_date` text NOT NULL,
  `age_gender_json` text,
  `top_cities_json` text,
  `top_countries_json` text,
  `online_hours_json` text,
  `synced_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `ig_audience_account_date_idx` ON `instagram_audience_snapshots` (`account_id`, `snapshot_date`);

CREATE TABLE IF NOT EXISTS `instagram_strategy_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `report_type` text NOT NULL,
  `generated_at_ms` integer NOT NULL,
  `period_start_ms` integer,
  `period_end_ms` integer,
  `summary_text` text NOT NULL,
  `recommendations_json` text,
  `content_ideas_json` text,
  `metrics_snapshot_json` text
);
CREATE INDEX IF NOT EXISTS `ig_strategy_account_idx` ON `instagram_strategy_reports` (`account_id`);
CREATE INDEX IF NOT EXISTS `ig_strategy_type_idx` ON `instagram_strategy_reports` (`report_type`);

CREATE TABLE IF NOT EXISTS `instagram_replies` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `ig_comment_id` text,
  `ig_conversation_id` text,
  `ig_message_id` text,
  `reply_type` text NOT NULL,
  `inbound_text` text NOT NULL,
  `inbound_author` text,
  `classification` text,
  `draft_text` text NOT NULL,
  `final_text` text,
  `status` text NOT NULL,
  `sent_at_ms` integer,
  `escalated_at_ms` integer,
  `created_deal_id` text,
  `feedback` text,
  `feedback_sentiment` text,
  `created_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `ig_replies_account_idx` ON `instagram_replies` (`account_id`);
CREATE INDEX IF NOT EXISTS `ig_replies_status_idx` ON `instagram_replies` (`status`);

CREATE TABLE IF NOT EXISTS `instagram_voice_corrections` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `reply_id` text NOT NULL,
  `reply_type` text NOT NULL,
  `ai_draft` text NOT NULL,
  `andy_version` text NOT NULL,
  `correction_note` text,
  `created_at_ms` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `ig_corrections_account_idx` ON `instagram_voice_corrections` (`account_id`);

-- Settings keys — §15
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES
  ('instagram.sync.daily_account_metrics_enabled', 'true', 'boolean', 'Enable daily account-level metrics sync', 0),
  ('instagram.sync.aggressive_polling_hours', '48', 'integer', 'Hours of aggressive per-post polling after publish', 0),
  ('instagram.post.default_aspect_ratio', '4:5', 'string', 'Default aspect ratio for Instagram posts', 0),
  ('instagram.post.caption_llm_enabled', 'true', 'boolean', 'Use LLM to auto-draft Instagram captions', 0),
  ('instagram.post.max_hashtags', '2', 'integer', 'Maximum hashtags in auto-drafted captions', 0),
  ('instagram.strategy.weekly_digest_enabled', 'true', 'boolean', 'Generate weekly AI strategy digest', 0),
  ('instagram.strategy.weekly_digest_day', 'monday', 'string', 'Day of week for strategy digest generation', 0),
  ('instagram.strategy.realtime_alerts_enabled', 'true', 'boolean', 'Enable real-time performance alerts', 0),
  ('instagram.strategy.boost_score_threshold', '0.70', 'number', 'Minimum score to recommend boosting a post', 0),
  ('instagram.strategy.content_ideas_count', '5', 'integer', 'Number of content ideas in weekly digest', 0),
  ('instagram.boost.default_budget_aud', '20', 'integer', 'Default boost budget in AUD', 0),
  ('instagram.boost.default_duration_days', '3', 'integer', 'Default boost duration in days', 0),
  ('instagram.boost.auto_kill_cpe_threshold_aud', '2.00', 'number', 'Kill boost if CPE exceeds this (AUD)', 0),
  ('instagram.reply.comment_mode', 'draft', 'string', 'Comment reply mode: draft or autonomous', 0),
  ('instagram.reply.dm_mode', 'draft', 'string', 'DM reply mode: draft or autonomous', 0),
  ('instagram.reply.graduation_threshold', '0.15', 'number', 'Edit rate below which autonomous mode is suggested', 0),
  ('instagram.reply.graduation_window', '50', 'integer', 'Number of recent replies to evaluate for graduation', 0),
  ('instagram.reply.poll_interval_seconds', '150', 'integer', 'Seconds between reply polling runs', 0),
  ('instagram.token.refresh_at_day', '50', 'integer', 'Day of token lifetime to trigger refresh', 0);
