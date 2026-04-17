INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('inbox.digest_hour', '8', 'integer', 'Hour (0-23) in Andy timezone to fire the morning digest email', 0),
  ('inbox.digest_silent_window_hours', '24', 'integer', 'How many hours back to look for silent notifications in the morning digest', 0),
  ('inbox.digest_no_send_on_zero', 'true', 'boolean', 'Suppress digest send when zero silenced messages in the window (do not train dismissal)', 0);
