-- Task Manager settings (3 keys). Source: docs/settings-registry.md.
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('tasks.deliverable_approval_token_ttl_days', '14', 'integer', 'How long an approval magic-link token is valid before expiry (days)', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('tasks.morning_digest_enabled', 'true', 'boolean', 'Whether the 08:00 morning task digest email fires', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('tasks.morning_digest_time', '08:00', 'string', 'Local time (Melbourne) for morning digest', 0);
