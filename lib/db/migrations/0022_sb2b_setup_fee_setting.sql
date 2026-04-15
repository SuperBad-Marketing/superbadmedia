-- SB-2b: seed the SaaS monthly-product default setup fee.
-- Source of truth: docs/settings-registry.md (SaaS Subscription Billing block).
-- Reversible: DELETE FROM settings WHERE key = 'billing.saas.monthly_setup_fee_cents';

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('billing.saas.monthly_setup_fee_cents', '0', 'integer', 'Default one-off setup fee (cents, inc-GST) applied to a newly-published SaaS product tier. Per-tier editor overrides. Source: docs/specs/saas-subscription-billing.md §4.5.', 0);
