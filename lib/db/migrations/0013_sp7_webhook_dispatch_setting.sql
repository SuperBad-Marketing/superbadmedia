-- SP-7: seed the Stripe webhook dispatch kill switch.
-- Source of truth: docs/settings-registry.md (Sales Pipeline block).
-- Reversible: DELETE FROM settings WHERE key = 'pipeline.stripe_webhook_dispatch_enabled';

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('pipeline.stripe_webhook_dispatch_enabled', 'true', 'boolean', 'Master kill switch for Stripe webhook business dispatch (signature verification + idempotency still run when false, only deal/company mutations are skipped)', 0);
