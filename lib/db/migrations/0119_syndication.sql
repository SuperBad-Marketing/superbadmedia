ALTER TABLE `blog_posts` ADD COLUMN `faq_schema` text;

CREATE TABLE IF NOT EXISTS `syndication_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`platform` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`credentials` text,
	`platform_config` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `syndication_targets_company_idx` ON `syndication_targets` (`company_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `syndication_targets_company_platform_idx` ON `syndication_targets` (`company_id`, `platform`);

CREATE TABLE IF NOT EXISTS `syndication_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_post_id` text NOT NULL,
	`syndication_target_id` text NOT NULL,
	`platform` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`platform_url` text,
	`platform_post_id` text,
	`error_message` text,
	`attempted_at_ms` integer,
	`syndicated_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`blog_post_id`) REFERENCES `blog_posts`(`id`) ON DELETE cascade,
	FOREIGN KEY (`syndication_target_id`) REFERENCES `syndication_targets`(`id`) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `syndication_posts_post_idx` ON `syndication_posts` (`blog_post_id`);
CREATE INDEX IF NOT EXISTS `syndication_posts_target_idx` ON `syndication_posts` (`syndication_target_id`);
CREATE INDEX IF NOT EXISTS `syndication_posts_status_idx` ON `syndication_posts` (`status`);
CREATE UNIQUE INDEX IF NOT EXISTS `syndication_posts_post_target_idx` ON `syndication_posts` (`blog_post_id`, `syndication_target_id`);
