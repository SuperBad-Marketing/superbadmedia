ALTER TABLE `messages` ADD COLUMN `keep_until_ms` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `deleted_at_ms` integer;--> statement-breakpoint
CREATE INDEX `messages_keep_until_idx` ON `messages` (`keep_until_ms`, `deleted_at_ms`);--> statement-breakpoint
CREATE INDEX `messages_deleted_at_idx` ON `messages` (`deleted_at_ms`);
