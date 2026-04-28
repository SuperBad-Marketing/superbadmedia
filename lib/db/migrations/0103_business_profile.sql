CREATE TABLE IF NOT EXISTS `business_profile_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`section_key` text NOT NULL,
	`structured_data` text DEFAULT '{}' NOT NULL,
	`prose_summary` text,
	`prose_generated_at_ms` integer,
	`prose_manually_edited` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bps_section_current_idx` ON `business_profile_sections` (`section_key`, `is_current`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bps_section_version_idx` ON `business_profile_sections` (`section_key`, `version`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `business_profile_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`section_key` text NOT NULL,
	`field_path` text,
	`suggestion_type` text NOT NULL,
	`source` text NOT NULL,
	`source_entity_id` text,
	`title` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`surfaced_in_brief` integer DEFAULT false NOT NULL,
	`created_at_ms` integer NOT NULL,
	`resolved_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bps_sugg_status_created_idx` ON `business_profile_suggestions` (`status`, `created_at_ms`);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('profile.stale_threshold_days', '90', 'integer', 'Days before a profile section is flagged as stale', strftime('%s','now') * 1000);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('profile.suggestion_expiry_days', '30', 'integer', 'Days before an unresolved profile suggestion auto-expires', strftime('%s','now') * 1000);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('profile.cache_ttl_minutes', '10', 'integer', 'In-memory cache TTL for assembled profile context', strftime('%s','now') * 1000);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('profile.health_check_hour', '4', 'integer', 'Melbourne hour (0-23) when the daily profile health check runs', strftime('%s','now') * 1000);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (key, value, type, description, updated_at_ms) VALUES ('profile.enforcement_enabled', 'true', 'boolean', 'Kill switch — disabling reverts all LLM calls to pre-profile behaviour', strftime('%s','now') * 1000);
