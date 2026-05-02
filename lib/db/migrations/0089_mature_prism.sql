ALTER TABLE `brand_dna_profiles` ADD `long_tail_summary` text;--> statement-breakpoint
ALTER TABLE `lead_runs` ADD `icp_filtered_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rundown_sessions` ADD `gap_reveal_json` text;