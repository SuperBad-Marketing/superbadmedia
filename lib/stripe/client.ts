/**
 * Stripe SDK singleton. Consumed only within `lib/stripe/` — the
 * `no-direct-stripe-customer-create` ESLint rule enforces this boundary
 * in feature code.
 *
 * API version pinned to `2024-12-18.acacia` to match the Stripe skill.
 */
import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { _stripe?: Stripe };

export const stripe: Stripe =
  globalForStripe._stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForStripe._stripe = stripe;
}
