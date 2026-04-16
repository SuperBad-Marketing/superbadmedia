-- UI-1: Unified Inbox — Graph API sync settings (3 keys)
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('inbox.graph_sync_interval_seconds', '300', 'integer', 'Polling interval (seconds) for delta sync fallback when webhook misses', 0),
  ('inbox.graph_subscription_ttl_hours', '48', 'integer', 'Requested TTL (hours) for Graph webhook subscriptions', 0),
  ('inbox.graph_subscription_renew_buffer_hours', '6', 'integer', 'Renew subscriptions this many hours before expiry', 0);
