CREATE TABLE `portal_magic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text,
	`client_id` text,
	`contact_id` text NOT NULL,
	`ott_hash` text NOT NULL,
	`issued_for` text NOT NULL,
	`issued_at_ms` integer NOT NULL,
	`ttl_hours` integer NOT NULL,
	`consumed_at_ms` integer,
	`consumed_from_ip` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_magic_links_ott_hash_unique` ON `portal_magic_links` (`ott_hash`);
--> statement-breakpoint
CREATE INDEX `portal_magic_links_contact_idx` ON `portal_magic_links` (`contact_id`,`issued_at_ms`);
--> statement-breakpoint
CREATE TABLE `brand_dna_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brand_dna_profiles_subject_idx` ON `brand_dna_profiles` (`subject_type`,`status`);
