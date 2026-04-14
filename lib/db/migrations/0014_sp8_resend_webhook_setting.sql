-- SP-8: seed the Resend webhook dispatch kill switch.
-- Source of truth: docs/settings-registry.md (Sales Pipeline block).
-- Reversible: DELETE FROM settings WHERE key = 'pipeline.resend_webhook_dispatch_enabled';

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('pipeline.resend_webhook_dispatch_enabled', 'true', 'boolean', 'Master kill switch for Resend webhook business dispatch (signature verification + idempotency still run when false, only contact/deal/company mutations are skipped)', 0);
