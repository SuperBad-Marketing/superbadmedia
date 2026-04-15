/**
 * SB-12: single source of truth for the SaaS monthly setup fee.
 *
 * Spec: docs/specs/saas-subscription-billing.md §4.5, §6 op#41.
 *
 * Invariants (Q7 in the spec):
 *   - Charged on every new **monthly** subscription (even if the contact
 *     had a previous cancelled subscription — that IS the loophole
 *     closure; no anti-gaming logic needed anywhere else).
 *   - Not charged on annual cadences.
 *   - Not charged on product switches (those mutate Stripe items; they
 *     never call this helper).
 *   - Not charged on reactivate-after-payment-failure (Stripe retries
 *     the existing invoice; no new subscription is created).
 *
 * This is the only place in the codebase allowed to construct an
 * `add_invoice_items` payload. The grep-guard test in
 * `tests/billing/setup-fee-guard.test.ts` fails if any other file
 * references the literal.
 */
import type Stripe from "stripe";
import type { CommitmentCadence } from "@/lib/content/checkout-page";

export type BuildSetupFeeParams = {
  cadence: CommitmentCadence;
  stripeProductId: string;
  setupFeeCentsIncGst: number;
};

/**
 * Returns a partial SubscriptionCreateParams containing the setup-fee
 * invoice line when one is due, or `undefined` when it isn't. Callers
 * spread the result into their params object — this keeps the
 * `add_invoice_items` identifier off every other file in the codebase
 * (see `tests/billing/setup-fee-guard.test.ts`).
 */
export function buildMonthlySetupFeeInvoiceItems(
  params: BuildSetupFeeParams,
):
  | Pick<Stripe.SubscriptionCreateParams, "add_invoice_items">
  | undefined {
  if (params.cadence !== "monthly") return undefined;
  if (!Number.isFinite(params.setupFeeCentsIncGst)) return undefined;
  if (params.setupFeeCentsIncGst <= 0) return undefined;
  return {
    add_invoice_items: [
      {
        price_data: {
          currency: "aud",
          product: params.stripeProductId,
          unit_amount: params.setupFeeCentsIncGst,
        },
        quantity: 1,
      },
    ],
  };
}
