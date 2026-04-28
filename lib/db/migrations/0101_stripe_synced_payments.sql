CREATE TABLE IF NOT EXISTS `stripe_synced_payments` (
  `id` TEXT PRIMARY KEY,
  `stripe_payment_intent_id` TEXT NOT NULL,
  `stripe_charge_id` TEXT,
  `stripe_customer_id` TEXT,
  `amount_cents` INTEGER NOT NULL,
  `currency` TEXT NOT NULL DEFAULT 'aud',
  `description` TEXT,
  `customer_name` TEXT,
  `customer_email` TEXT,
  `payment_date` TEXT NOT NULL,
  `paid_at_ms` INTEGER NOT NULL,
  `gst_cents` INTEGER NOT NULL DEFAULT 0,
  `linked_invoice_id` TEXT,
  `linked_deal_id` TEXT,
  `created_at_ms` INTEGER NOT NULL,
  `updated_at_ms` INTEGER NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `stripe_synced_payments_pi_idx` ON `stripe_synced_payments`(`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `stripe_synced_payments_date_idx` ON `stripe_synced_payments`(`payment_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `stripe_synced_payments_paid_at_idx` ON `stripe_synced_payments`(`paid_at_ms`);
