-- SW-2 — settings-key seed: three autonomy knobs for the step-type library.
-- Source of truth: docs/settings-registry.md (Wizards section).
-- Per AUTONOMY_PROTOCOL.md §G4, these literals live in `settings`, not code.

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('wizards.dns_verify_poll_interval_ms', '10000', 'integer', 'dns-verify step — resolver poll interval (ms)', 0),
  ('wizards.async_check_timeout_ms', '600000', 'integer', 'async-check step — long-running job max wait (ms, 10 min)', 0),
  ('wizards.webhook_probe_timeout_ms', '300000', 'integer', 'webhook-probe step — inbound POST max wait (ms, 5 min)', 0);
