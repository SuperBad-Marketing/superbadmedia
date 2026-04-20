CREATE TABLE IF NOT EXISTS `bench_magic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`ott_hash` text NOT NULL,
	`issued_for` text NOT NULL DEFAULT 'bench_access',
	`expires_at_ms` integer NOT NULL,
	`consumed_at_ms` integer,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `bench_magic_links_ott_hash_unique` ON `bench_magic_links` (`ott_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bench_magic_links_ott_hash_idx` ON `bench_magic_links` (`ott_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bench_magic_links_candidate_idx` ON `bench_magic_links` (`candidate_id`, `created_at_ms`);
