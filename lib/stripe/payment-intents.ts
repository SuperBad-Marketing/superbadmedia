/**
 * Stripe PaymentIntent primitives (SB-11).
 *
 * Off-session charges against a customer's default payment method —
 * used by the SaaS cancel flow to collect pay-remainder and 50%-buyout
 * amounts without the subscriber having to re-enter card details.
 *
 * The subscriber already has a saved card (subscription was created
 * on-session in QB-4c); this helper reads the customer's
 * `invoice_settings.default_payment_method` and charges it inline.
 *
 * Idempotency is mandatory — the caller supplies a key derived from
 * `saas_exit:{deal_id}:{branch}:{today_iso}` so retried actions never
 * double-charge.
 */
import type Stripe from "stripe";
import { getStripe } from "./client";

export interface PaymentIntentStripeLike {
  customers: {
    retrieve: Stripe["customers"]["retrieve"];
  };
  paymentIntents: {
    create: Stripe["paymentIntents"]["create"];
  };
}

export interface CreateOffSessionPaymentIntentOpts {
  stripeCustomerId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
  /** Required. Scope: one charge per (deal, branch, day). */
  idempotencyKey: string;
  stripeClient?: PaymentIntentStripeLike;
}

export class OffSessionPaymentError extends Error {
  code: "no_default_payment_method" | "customer_not_found";
  constructor(code: OffSessionPaymentError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Create + confirm a PaymentIntent off-session against the customer's
 * default payment method. Throws `OffSessionPaymentError` if no default
 * payment method is on file — caller should render the card-not-on-file
 * fallback (spec §6.7) instead of calling this.
 *
 * Returns the PaymentIntent directly. Callers check `status` — on
 * `succeeded` they flip local state; on `requires_action` /
 * `requires_payment_method` they surface the failure to the subscriber
 * and route to the bartender.
 */
export async function createOffSessionPaymentIntent(
  opts: CreateOffSessionPaymentIntentOpts,
): Promise<Stripe.PaymentIntent> {
  const stripe = (opts.stripeClient ?? getStripe()) as Stripe;

  const customer = await stripe.customers.retrieve(opts.stripeCustomerId);
  if (customer.deleted) {
    throw new OffSessionPaymentError(
      "customer_not_found",
      `customer ${opts.stripeCustomerId} is deleted`,
    );
  }
  const defaultPm =
    (customer.invoice_settings?.default_payment_method as string | null) ??
    null;
  if (!defaultPm) {
    throw new OffSessionPaymentError(
      "no_default_payment_method",
      `customer ${opts.stripeCustomerId} has no default payment method`,
    );
  }

  return stripe.paymentIntents.create(
    {
      customer: opts.stripeCustomerId,
      amount: opts.amountCents,
      currency: opts.currency ?? "aud",
      payment_method: defaultPm,
      off_session: true,
      confirm: true,
      description: opts.description,
      metadata: opts.metadata,
    },
    { idempotencyKey: opts.idempotencyKey },
  );
}

/**
 * Helper: read the customer's default payment method without charging.
 * Used by the route shell to decide whether to render paid-exit options
 * or the card-not-on-file fallback.
 */
export async function customerHasDefaultPaymentMethod(
  stripeCustomerId: string,
  stripeClient?: PaymentIntentStripeLike,
): Promise<boolean> {
  const stripe = (stripeClient ?? getStripe()) as Stripe;
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  if (customer.deleted) return false;
  return Boolean(customer.invoice_settings?.default_payment_method);
}
