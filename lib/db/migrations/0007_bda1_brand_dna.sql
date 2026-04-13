ALTER TABLE `brand_dna_profiles` ADD COLUMN `subject_display_name` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `contact_id` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `company_id` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `version` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `is_current` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `is_superbad_self` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `track` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `shape` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `needs_regeneration` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `section_scores` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `signal_tags` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `prose_portrait` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `first_impression` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `reflection_text` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `section_insights` text;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `supplement_completed` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `current_section` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `brand_dna_profiles` ADD COLUMN `completed_at_ms` integer;--> statement-breakpoint
CREATE INDEX `brand_dna_profiles_contact_idx` ON `brand_dna_profiles` (`contact_id`,`is_current`);--> statement-breakpoint
CREATE TABLE `brand_dna_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`question_id` text NOT NULL,
	`section` integer NOT NULL,
	`selected_option` text NOT NULL,
	`tags_awarded` text NOT NULL,
	`answered_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brand_dna_answers_profile_idx` ON `brand_dna_answers` (`profile_id`,`section`);--> statement-breakpoint
CREATE INDEX `brand_dna_answers_question_idx` ON `brand_dna_answers` (`profile_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `brand_dna_blends` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`source_profile_ids` text NOT NULL,
	`tags_json` text NOT NULL,
	`prose_portrait` text NOT NULL,
	`divergences_json` text NOT NULL,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brand_dna_blends_company_idx` ON `brand_dna_blends` (`company_id`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `brand_dna_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`used_at_ms` integer,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_dna_invites_token_hash_unique` ON `brand_dna_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `brand_dna_invites_contact_idx` ON `brand_dna_invites` (`contact_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `brand_dna_invites_token_idx` ON `brand_dna_invites` (`token_hash`);
