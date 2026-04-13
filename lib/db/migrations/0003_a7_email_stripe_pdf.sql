CREATE TABLE `legal_doc_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`doc_type` text NOT NULL,
	`version` text NOT NULL,
	`effective_from_ms` integer NOT NULL,
	`sha256` text,
	`notes` text,
	`created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `legal_doc_versions_type_idx` ON `legal_doc_versions` (`doc_type`,`effective_from_ms`);--> statement-breakpoint
CREATE TABLE `email_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`classification` text,
	`reason` text,
	`suppressed_at_ms` integer NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE INDEX `email_suppressions_email_idx` ON `email_suppressions` (`email`,`suppressed_at_ms`);--> statement-breakpoint
CREATE INDEX `email_suppressions_kind_idx` ON `email_suppressions` (`kind`,`suppressed_at_ms`);