CREATE TABLE `gallery_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`cloudinary_public_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`approval_status` text DEFAULT 'new' NOT NULL,
	`status_changed_by` text,
	`status_note` text,
	`status_changed_at_ms` integer,
	`cloudinary_created_at` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gallery_assets_company_idx` ON `gallery_assets` (`company_id`,`approval_status`);--> statement-breakpoint
CREATE INDEX `gallery_assets_public_id_idx` ON `gallery_assets` (`cloudinary_public_id`);--> statement-breakpoint
ALTER TABLE `companies` ADD `cloudinary_gallery_folder` text;