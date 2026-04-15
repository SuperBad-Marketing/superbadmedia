-- SB-6a: seed subscriber magic-link TTL.
-- Source of truth: docs/settings-registry.md (Subscriber auth block).
-- Reversible: DELETE FROM settings WHERE key = 'subscriber.magic_link_ttl_hours';

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('subscriber.magic_link_ttl_hours', '24', 'integer', 'TTL for SaaS subscriber login magic-links issued by invoice.payment_succeeded + /get-started/welcome resend. 24h default. Per-link single-use. Source: docs/specs/saas-subscription-billing.md §3.4.', 0);
