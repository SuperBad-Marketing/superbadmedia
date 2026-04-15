/**
 * Stripe Subscription mutation primitives (SB-8).
 *
 * Thin wrappers around `stripe.subscriptions.update` that encode the
 * pro-ration + anchoring conventions SaaS tier-change / product-switch
 * needs. Kept in `lib/stripe/` so the feature module doesn't reach into
 * the Stripe SDK directly (matches SB-1..SB-6 boundary).
 *
 * All functions accept an injectable Stripe instance for tests;
 * production callers pass nothing and get the module singleton from
 * `getStripe()`.
 */
import type Stripe from "stripe";
import { getStripe } from "./client";

export interface StripeLike {
  subscriptions: {
    update: Stripe["subscriptions"]["update"];
    retrieve: Stripe["subscriptions"]["retrieve"];
  };
}

export interface SwapPriceOpts {
  subscriptionId: string;
  newPriceId: string;
  /**
   * `immediate` → pro-rated swap that takes effect now.
   * `deferred`  → swap fires at the current period boundary with
   *               `proration_behavior: "none"` + `billing_cycle_anchor: "unchanged"`
   *               so the next invoice reflects the new price. Used by
   *               the downgrade-apply cron.
   */
  mode: "immediate" | "deferred";
  stripeClient?: StripeLike;
}

/**
 * Swap the (single) item on a subscription to a new Price. Throws if the
 * subscription has zero or more than one item — SaaS subscriptions in
 * SB-1 are always single-item; if that changes, extend here.
 */
export async function swapSubscriptionPrice(
  opts: SwapPriceOpts,
): Promise<Stripe.Subscription> {
  const stripe = (opts.stripeClient ?? getStripe()) as Stripe;
  const sub = await stripe.subscriptions.retrieve(opts.subscriptionId);
  const items = sub.items?.data ?? [];
  if (items.length !== 1) {
    throw new Error(
      `swapSubscriptionPrice: expected 1 item on ${opts.subscriptionId}, got ${items.length}`,
    );
  }
  const itemId = items[0].id;

  if (opts.mode === "immediate") {
    return stripe.subscriptions.update(opts.subscriptionId, {
      items: [{ id: itemId, price: opts.newPriceId }],
      proration_behavior: "create_prorations",
    });
  }
  return stripe.subscriptions.update(opts.subscriptionId, {
    items: [{ id: itemId, price: opts.newPriceId }],
    proration_behavior: "none",
    billing_cycle_anchor: "unchanged",
  });
}

export interface SwitchProductOpts {
  subscriptionId: string;
  newPriceId: string;
  stripeClient?: StripeLike;
}

/**
 * Product switch: remove the old item and add the new one in the same
 * update. Stripe treats an item update with a different Price + same
 * item id as a swap, but for a product switch the underlying Stripe
 * Product differs too — a delete + add is the cleanest representation
 * and lets Stripe re-issue the line item cleanly on the next invoice.
 */
export async function switchSubscriptionProduct(
  opts: SwitchProductOpts,
): Promise<Stripe.Subscription> {
  const stripe = (opts.stripeClient ?? getStripe()) as Stripe;
  const sub = await stripe.subscriptions.retrieve(opts.subscriptionId);
  const items = sub.items?.data ?? [];
  if (items.length !== 1) {
    throw new Error(
      `switchSubscriptionProduct: expected 1 item on ${opts.subscriptionId}, got ${items.length}`,
    );
  }
  const itemId = items[0].id;

  return stripe.subscriptions.update(opts.subscriptionId, {
    items: [
      { id: itemId, deleted: true },
      { price: opts.newPriceId },
    ],
    proration_behavior: "create_prorations",
  });
}

/**
 * Current-period end as milliseconds-since-epoch, read straight from
 * Stripe. Used by the tier-change primitive to schedule the
 * `saas_subscription_tier_downgrade_apply` task at the right moment.
 */
export async function readCurrentPeriodEndMs(
  subscriptionId: string,
  stripeClient?: StripeLike,
): Promise<number> {
  const stripe = (stripeClient ?? getStripe()) as Stripe;
  const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as {
    current_period_end: number;
  };
  return sub.current_period_end * 1000;
}
