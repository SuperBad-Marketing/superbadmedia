-- SB-10: SaaS admin cockpit headline signals — window + near-cap threshold settings.
-- Reversible:
--   DELETE FROM `settings` WHERE `key` IN (
--     'saas.headline_window_days',
--     'saas.near_cap_threshold'
--   );

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('saas.headline_window_days', '30', 'integer', 'Rolling window (days) over which the SaaS admin headlines compute new signups / churn / MRR delta. Consumed by lib/saas-products/headline-signals.ts (getSaasHeadlineSignals + getSaasHeadlineSignalsForProduct). Per spec §8.1 + §8.3.', 0),
  ('saas.near_cap_threshold', '0.8', 'decimal', 'Fractional threshold (0-1) at which a subscriber dimension is counted as near-cap on the admin headlines strip. Consumed by lib/saas-products/headline-signals.ts near-cap query. Per spec §8.1.', 0);
