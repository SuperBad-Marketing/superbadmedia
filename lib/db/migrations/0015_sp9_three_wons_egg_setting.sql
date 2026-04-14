-- SP-9: seed the "three Wons in a session" S&D egg cooldown key.
-- Source of truth: docs/settings-registry.md (Sales Pipeline block).
-- Stored as unix-ms timestamp of last fire; 0 = never fired.
-- Reversible: DELETE FROM settings WHERE key = 'pipeline.sd_three_wons_last_fired_ms';

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('pipeline.sd_three_wons_last_fired_ms', '0', 'integer', 'Unix-ms timestamp of the last "three Wons in a session" S&D egg fire (sales-pipeline §11A.4 + surprise-and-delight admin egg #3). Enforces the ≤ once/30-day cap server-side.', 0);
