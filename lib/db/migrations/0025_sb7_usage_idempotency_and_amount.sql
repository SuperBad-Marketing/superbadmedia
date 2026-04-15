-- SB-7: extend usage_records with amount + idempotency + period end.
-- Source of truth: docs/specs/saas-subscription-billing.md §5 + sessions/sb-7-brief.md.
-- Additive + idempotency-safe. Reversible by:
--
--   DROP INDEX usage_records_idempotency_key_idx;
--   ALTER TABLE usage_records DROP COLUMN billing_period_end_ms;
--   ALTER TABLE usage_records DROP COLUMN idempotency_key;
--   ALTER TABLE usage_records DROP COLUMN amount;

ALTER TABLE `usage_records` ADD COLUMN `amount` integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `usage_records` ADD COLUMN `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `usage_records` ADD COLUMN `billing_period_end_ms` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `usage_records_idempotency_key_idx` ON `usage_records` (`idempotency_key`) WHERE `idempotency_key` IS NOT NULL;
