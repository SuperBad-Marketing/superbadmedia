-- B3: cookie_consents audit table + legal_doc_versions seed rows.
-- Owner: B3.

CREATE TABLE `cookie_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`ip_hash` text NOT NULL,
	`user_id` text,
	`accepted` integer NOT NULL,
	`categories` text NOT NULL,
	`banner_version` text NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cookie_consents_ip_idx` ON `cookie_consents` (`ip_hash`,`created_at_ms`);
--> statement-breakpoint
CREATE INDEX `cookie_consents_user_idx` ON `cookie_consents` (`user_id`,`created_at_ms`);
--> statement-breakpoint

-- Seed initial legal_doc_versions rows (B3 publication).
-- Effective from 2026-04-13 00:00:00 UTC = 1776096000000 ms.
INSERT OR IGNORE INTO `legal_doc_versions` (`id`, `doc_type`, `version`, `effective_from_ms`, `notes`, `created_at_ms`) VALUES
  ('ldv_terms_v1', 'terms_of_service', '1.0', 1776096000000, 'Initial publication — B3', 1776096000000),
  ('ldv_privacy_v1', 'privacy_policy', '1.0', 1776096000000, 'Initial publication — B3', 1776096000000),
  ('ldv_aup_v1', 'acceptable_use', '1.0', 1776096000000, 'Initial publication — B3', 1776096000000),
  ('ldv_cookie_v1', 'cookie_policy', '1.0', 1776096000000, 'Initial publication — B3', 1776096000000);
