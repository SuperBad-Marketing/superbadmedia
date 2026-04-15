-- SB-7: seed SaaS usage warn threshold.
-- Source of truth: docs/settings-registry.md (SaaS Subscription Billing block).
-- Reversible: DELETE FROM settings WHERE key = 'saas.usage_warn_threshold_percent';

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('saas.usage_warn_threshold_percent', '80', 'integer', 'Percentage (0-100) of a dimension''s tier limit at which the subscriber sticky bar promotes to the "approaching cap" warning state. Below this the pill reads calm; at/above 100 it renders at-cap. Per spec §5.2. Consumed by lib/saas-products/usage.ts.', 0);
