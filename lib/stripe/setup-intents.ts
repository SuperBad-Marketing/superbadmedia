/**
 * Stripe SetupIntent primitives (SB-9).
 *
 * Used by the past_due recovery path — the subscriber updates their
 * card inline via Stripe's Payment Element mounted on a SetupIntent's
 * client secret, then we flip the new payment method to the customer's
 * default so Stripe's dunning retries land on the fresh card.
 *
 * Injectable Stripe instance for tests; production callers pass nothing
 * and get the singleton via `getStripe()`.
 */
import type Stripe from "stripe";
import { getStripe } from "./client";

export interface SetupIntentStripeLike {
  setupIntents: {
    create: Stripe["setupIntents"]["create"];
  };
  customers: {
    update: Stripe["customers"]["update"];
  };
}

export interface CreateSetupIntentOpts {
  stripeCustomerId: string;
  stripeClient?: SetupIntentStripeLike;
}

/**
 * Create a SetupIntent scoped to a subscriber's Stripe Customer with
 * `usage: "off_session"` (Stripe reuses the collected card for the
 * customer's subscription dunning retries).
 */
export async function createSubscriberSetupIntent(
  opts: CreateSetupIntentOpts,
): Promise<Stripe.SetupIntent> {
  const stripe = (opts.stripeClient ?? getStripe()) as Stripe;
  return stripe.setupIntents.create({
    customer: opts.stripeCustomerId,
    usage: "off_session",
    automatic_payment_methods: { enabled: true },
  });
}

export interface AttachDefaultPaymentMethodOpts {
  stripeCustomerId: string;
  paymentMethodId: string;
  stripeClient?: SetupIntentStripeLike;
}

/**
 * Flip a payment method to the customer's default for subscription
 * invoices. Called after a SetupIntent succeeds client-side so Stripe's
 * next dunning retry uses the fresh card.
 */
export async function attachDefaultPaymentMethod(
  opts: AttachDefaultPaymentMethodOpts,
): Promise<Stripe.Customer> {
  const stripe = (opts.stripeClient ?? getStripe()) as Stripe;
  return stripe.customers.update(opts.stripeCustomerId, {
    invoice_settings: { default_payment_method: opts.paymentMethodId },
  });
}
