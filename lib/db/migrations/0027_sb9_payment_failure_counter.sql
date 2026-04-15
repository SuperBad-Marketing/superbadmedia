-- SB-9: per-billing-cycle payment-failure counter + data-loss warning settings key.
-- Reversible:
--   ALTER TABLE `deals` DROP COLUMN `payment_failure_count`;
--   ALTER TABLE `deals` DROP COLUMN `first_payment_failure_at_ms`;
--   DELETE FROM `settings` WHERE `key` = 'saas.data_loss_warning_days';

ALTER TABLE `deals` ADD COLUMN `payment_failure_count` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `deals` ADD COLUMN `first_payment_failure_at_ms` integer;--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('saas.data_loss_warning_days', '7', 'integer', 'Days after a subscriber''s first payment-cycle failure before the data-loss warning email fires. Handler re-checks subscription_state at fire time; no-op if recovered. Per spec §4.6 + §9. Consumed by lib/stripe/webhook-handlers/invoice-payment-failed.ts + lib/scheduled-tasks/handlers/saas-data-loss-warning.ts.', 0);
