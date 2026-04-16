ALTER TABLE `threads` ADD COLUMN `ticket_type_assigned_by` text;--> statement-breakpoint
ALTER TABLE `threads` ADD COLUMN `ticket_resolved_at_ms` integer;--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('inbox.ticket_auto_resolve_idle_days', '7', 'integer', 'Support@ ticket auto-resolves after this many idle days when status != resolved (spec §4.3)', 0);
