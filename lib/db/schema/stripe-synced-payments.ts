import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const stripe_synced_payments = sqliteTable(
  "stripe_synced_payments",
  {
    id: text("id").primaryKey(),
    stripe_payment_intent_id: text("stripe_payment_intent_id").notNull(),
    stripe_charge_id: text("stripe_charge_id"),
    stripe_customer_id: text("stripe_customer_id"),
    amount_cents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("aud"),
    description: text("description"),
    customer_name: text("customer_name"),
    customer_email: text("customer_email"),
    payment_date: text("payment_date").notNull(),
    paid_at_ms: integer("paid_at_ms").notNull(),
    gst_cents: integer("gst_cents").notNull().default(0),
    linked_invoice_id: text("linked_invoice_id"),
    linked_deal_id: text("linked_deal_id"),
    created_at_ms: integer("created_at_ms").notNull(),
    updated_at_ms: integer("updated_at_ms").notNull(),
  },
  (t) => ({
    by_pi: uniqueIndex("stripe_synced_payments_pi_idx").on(t.stripe_payment_intent_id),
    by_date: index("stripe_synced_payments_date_idx").on(t.payment_date),
    by_paid_at: index("stripe_synced_payments_paid_at_idx").on(t.paid_at_ms),
  }),
);

export type StripeSyncedPaymentRow = typeof stripe_synced_payments.$inferSelect;
export type StripeSyncedPaymentInsert = typeof stripe_synced_payments.$inferInsert;
