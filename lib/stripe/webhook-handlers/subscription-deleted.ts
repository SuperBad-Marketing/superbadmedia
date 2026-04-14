import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleSubDeletedOpts {
  nowMs?: number;
  dbArg?: Db;
  eventId: string;
}

/**
 * `customer.subscription.deleted` — Stripe confirming a subscription has
 * ended. Our cancel flow (Quote Builder §7.2, not yet built) posts the
 * cancel to Stripe first and sets `deals.subscription_state` to the right
 * terminal value; this webhook is the handshake that records Stripe's
 * acknowledgement. No state write here — our cancel flow owns state
 * authoritatively on the retainer path.
 */
export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  opts: HandleSubDeletedOpts,
): Promise<DispatchOutcome> {
  const database = (opts.dbArg ?? defaultDb) as Db;

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.stripe_subscription_id, sub.id))
    .get();
  if (!deal) {
    return { result: "error", error: `deal_not_found_for_subscription:${sub.id}` };
  }

  const nowMs = opts.nowMs ?? Date.now();

  await database.insert(activity_log).values({
    id: randomUUID(),
    company_id: deal.company_id,
    deal_id: deal.id,
    kind: "note",
    body: `Stripe confirmed subscription ended (${sub.id}).`,
    meta: {
      kind: "subscription_cancelled_stripe_initiated",
      stripe_subscription_id: sub.id,
      stripe_status: sub.status,
      current_state: deal.subscription_state,
      event_id: opts.eventId,
    },
    created_at_ms: nowMs,
    created_by: "stripe_webhook",
  });

  return { result: "ok" };
}
