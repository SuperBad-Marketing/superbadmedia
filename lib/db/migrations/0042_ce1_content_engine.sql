-- CE-1: Content Engine data model — 8 tables + 5 settings keys

CREATE TABLE IF NOT EXISTS `content_topics` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `keyword` text NOT NULL,
  `rankability_score` integer,
  `content_gaps` text,
  `outline` text,
  `serp_snapshot` text,
  `status` text NOT NULL DEFAULT 'queued',
  `vetoed_at_ms` integer,
  `claimed_by` text,
  `claimed_at_ms` integer,
  `claim_budget_cap_aud` integer,
  `claim_released_at_ms` integer,
  `claim_released_reason` text,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_topics_company_status_idx` ON `content_topics` (`company_id`, `status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_topics_status_idx` ON `content_topics` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `topic_id` text NOT NULL REFERENCES `content_topics`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `slug` text NOT NULL,
  `body` text NOT NULL,
  `meta_description` text,
  `og_image_url` text,
  `structured_data` text,
  `internal_links` text,
  `snippet_target_section` text,
  `status` text NOT NULL DEFAULT 'draft',
  `published_at_ms` integer,
  `published_url` text,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `blog_posts_company_status_idx` ON `blog_posts` (`company_id`, `status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `blog_posts_status_idx` ON `blog_posts` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `blog_posts_topic_idx` ON `blog_posts` (`topic_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `blog_posts_slug_idx` ON `blog_posts` (`company_id`, `slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `blog_post_feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `blog_post_id` text NOT NULL REFERENCES `blog_posts`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `blog_post_feedback_post_idx` ON `blog_post_feedback` (`blog_post_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `social_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `blog_post_id` text NOT NULL REFERENCES `blog_posts`(`id`) ON DELETE CASCADE,
  `platform` text NOT NULL,
  `text` text NOT NULL,
  `format` text NOT NULL,
  `visual_asset_urls` text,
  `image_prompt` text,
  `carousel_slides` text,
  `status` text NOT NULL DEFAULT 'generating',
  `published_at_ms` integer,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `social_drafts_post_idx` ON `social_drafts` (`blog_post_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `social_drafts_status_idx` ON `social_drafts` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `social_drafts_platform_idx` ON `social_drafts` (`blog_post_id`, `platform`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `email` text NOT NULL,
  `name` text,
  `consent_source` text NOT NULL,
  `consented_at_ms` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'pending_confirmation',
  `bounce_count` integer NOT NULL DEFAULT 0,
  `last_opened_at_ms` integer,
  `unsubscribed_at_ms` integer,
  `removed_at_ms` integer,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `newsletter_subs_company_status_idx` ON `newsletter_subscribers` (`company_id`, `status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `newsletter_subs_email_idx` ON `newsletter_subscribers` (`company_id`, `email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `newsletter_sends` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `blog_post_ids` text NOT NULL,
  `subject` text NOT NULL,
  `body` text NOT NULL,
  `format` text NOT NULL,
  `scheduled_for_ms` integer,
  `sent_at_ms` integer,
  `recipient_count` integer,
  `open_count` integer NOT NULL DEFAULT 0,
  `click_count` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `newsletter_sends_company_idx` ON `newsletter_sends` (`company_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `newsletter_sends_scheduled_idx` ON `newsletter_sends` (`scheduled_for_ms`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ranking_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `blog_post_id` text NOT NULL REFERENCES `blog_posts`(`id`) ON DELETE CASCADE,
  `keyword` text NOT NULL,
  `position` integer,
  `impressions` integer,
  `clicks` integer,
  `ctr` text,
  `source` text NOT NULL,
  `snapshot_date_ms` integer NOT NULL,
  `created_at_ms` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ranking_snapshots_post_idx` ON `ranking_snapshots` (`blog_post_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ranking_snapshots_date_idx` ON `ranking_snapshots` (`blog_post_id`, `snapshot_date_ms`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `content_engine_config` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL UNIQUE REFERENCES `companies`(`id`) ON DELETE CASCADE,
  `seed_keywords` text,
  `send_window_day` text NOT NULL DEFAULT 'tuesday',
  `send_window_time` text NOT NULL DEFAULT '10:00',
  `send_window_tz` text NOT NULL DEFAULT 'Australia/Melbourne',
  `gsc_refresh_token` text,
  `gsc_property_url` text,
  `embed_form_token` text UNIQUE,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('content.tier', 'small', 'string', 'Default Content Engine SaaS tier for new subscribers', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('content.send_window_day', 'tuesday', 'string', 'Default newsletter send day of week', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('content.send_window_hour', '10', 'integer', 'Default newsletter send hour (24h, local tz)', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('content.max_posts_per_month', '4', 'integer', 'Default max posts per billing cycle (small tier)', 0);--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES ('content.max_subscribers_per_tier', '{"small":500,"medium":2500,"large":10000}', 'json', 'Newsletter subscriber cap per tier (JSON)', 0);