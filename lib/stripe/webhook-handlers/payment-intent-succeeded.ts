import type Stripe from "stripe";
import type { DispatchOutcome } from "./types";

/**
 * `payment_intent.succeeded` is redundant for our Checkout Session flows
 * — `checkout.session.completed` already drives Won. Registered as a
 * known-skipped event so idempotency + observability stay accurate, and
 * so future subscription-renewal work (SB spec) has a clear hook.
 */
export function handlePaymentIntentSucceeded(
  _pi: Stripe.PaymentIntent,
): DispatchOutcome {
  return { result: "skipped", error: "covered_by_checkout_session" };
}
