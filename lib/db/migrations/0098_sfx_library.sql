CREATE TABLE IF NOT EXISTS `sfx_library` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `file_url` text NOT NULL,
  `color` text NOT NULL DEFAULT '#9B51E0',
  `cloudinary_public_id` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `sfx_library_slug_unique` ON `sfx_library` (`slug`);
