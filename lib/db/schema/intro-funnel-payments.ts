import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { intro_funnel_submissions } from "./intro-funnel-submissions";
import { deals } from "./deals";

export const INTRO_PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type IntroPaymentStatus = (typeof INTRO_PAYMENT_STATUSES)[number];

export const intro_funnel_payments = sqliteTable(
  "intro_funnel_payments",
  {
    id: text("id").primaryKey(),
    submission_id: text("submission_id")
      .notNull()
      .references(() => intro_funnel_submissions.id, { onDelete: "cascade" }),
    deal_id: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),

    stripe_payment_intent_id: text("stripe_payment_intent_id")
      .notNull()
      .unique(),
    stripe_customer_id: text("stripe_customer_id"),

    amount_cents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("aud"),

    status: text("status", { enum: INTRO_PAYMENT_STATUSES })
      .notNull()
      .default("pending"),

    refund_amount_cents: integer("refund_amount_cents"),
    refund_reason_code: text("refund_reason_code"),
    refunded_at_ms: integer("refunded_at_ms"),

    paid_at_ms: integer("paid_at_ms"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_submission: index("ifp_submission_idx").on(t.submission_id),
    by_deal: index("ifp_deal_idx").on(t.deal_id),
    by_pi: index("ifp_stripe_pi_idx").on(t.stripe_payment_intent_id),
  }),
);

export type IntroFunnelPaymentRow = typeof intro_funnel_payments.$inferSelect;
export type IntroFunnelPaymentInsert =
  typeof intro_funnel_payments.$inferInsert;
