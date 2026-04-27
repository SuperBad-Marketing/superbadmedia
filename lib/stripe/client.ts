/**
 * Stripe SDK singleton — lazy instantiation.
 *
 * Previously instantiated `new Stripe()` at module top level, which
 * threw during Next's build-time page-data collection when
 * STRIPE_SECRET_KEY was absent. `getStripe()` defers construction to
 * first call, so module imports are free-of-side-effects and the build
 * passes without a live secret.
 *
 * Consumed only within `lib/stripe/` — the
 * `no-direct-stripe-customer-create` ESLint rule enforces this boundary
 * in feature code.
 */
import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { _stripe?: Stripe };

export function getStripe(): Stripe {
  if (globalForStripe._stripe) return globalForStripe._stripe;
  const instance = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });
  if (process.env.NODE_ENV !== "production") {
    globalForStripe._stripe = instance;
  }
  return instance;
}
