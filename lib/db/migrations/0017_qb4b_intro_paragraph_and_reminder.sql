-- QB-4b: seed two autonomy keys consumed by the Quote Builder intro-paragraph
-- redraft throttle + the send-time `quote_reminder_3d` scheduler.
-- Source of truth: docs/settings-registry.md (Quote Builder block).
-- Reversible:
--   DELETE FROM settings WHERE key IN ('quote.reminder_days','quote.intro_paragraph_redraft_hourly_cap');

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('quote.reminder_days', '3', 'integer', 'Days after quote-send before the reminder task fires if the client has not viewed. Source: spec §3.1.5 + §8.', 0),
  ('quote.intro_paragraph_redraft_hourly_cap', '5', 'integer', 'Soft cap on Opus redraft calls for the "What you told us" paragraph, per quote per rolling hour. Source: spec §6.2.', 0);
