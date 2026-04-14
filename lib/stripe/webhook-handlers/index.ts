import type Stripe from "stripe";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import settings from "@/lib/settings";
import { handleCheckoutSessionCompleted } from "./checkout-session-completed";
import { handlePaymentIntentSucceeded } from "./payment-intent-succeeded";
import type { DispatchOutcome } from "./types";

export type { DispatchOutcome } from "./types";
export { isProductType, PRODUCT_TYPES } from "./checkout-session-completed";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface DispatchStripeEventOpts {
  nowMs?: number;
  dbArg?: Db;
}

/**
 * Route a verified Stripe event to its CRM-side handler. Kill-switch
 * gated: when `pipeline.stripe_webhook_dispatch_enabled = false`, every
 * event returns `skipped:kill_switch` without touching the CRM.
 *
 * Pure-ish: no HTTP, no signature verification. The caller is
 * `app/api/stripe/webhook/route.ts`, which owns signature verification
 * and the `webhook_events` idempotency writes.
 */
export async function dispatchStripeEvent(
  event: Stripe.Event,
  opts: DispatchStripeEventOpts = {},
): Promise<DispatchOutcome> {
  const enabled = await settings.get("pipeline.stripe_webhook_dispatch_enabled");
  if (!enabled) {
    return { result: "skipped", error: "kill_switch" };
  }

  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
        { nowMs: opts.nowMs, dbArg: opts.dbArg, eventId: event.id },
      );
    case "payment_intent.succeeded":
      return handlePaymentIntentSucceeded(
        event.data.object as Stripe.PaymentIntent,
      );
    default:
      return { result: "skipped", error: `unhandled_event_type:${event.type}` };
  }
}
