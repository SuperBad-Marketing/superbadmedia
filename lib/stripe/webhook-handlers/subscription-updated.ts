import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals, type DealSubscriptionState } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleSubUpdatedOpts {
  nowMs?: number;
  dbArg?: Db;
  eventId: string;
}

/**
 * Stripe subscription.status → our `deals.subscription_state`. Only the
 * subset relevant to a quote-billed retainer is mapped; everything else is
 * skipped (`trialing`, `incomplete*`) or deferred (`canceled` — covered by
 * `customer.subscription.deleted`). Per FOUNDATIONS §12 canonical machine.
 */
function mapStatus(
  status: Stripe.Subscription.Status,
): DealSubscriptionState | null {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "trialing":
    case "incomplete":
    case "incomplete_expired":
      return null;
    default:
      return null;
  }
}

/**
 * `customer.subscription.updated` — mirror Stripe-side status changes into
 * `deals.subscription_state`. Idempotent: no-op when current state already
 * matches the mapped target. Terminal-state writes go through
 * `customer.subscription.deleted` (this handler skips `canceled`).
 */
export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  opts: HandleSubUpdatedOpts,
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

  const target = mapStatus(sub.status);
  if (target === null) {
    return { result: "skipped", error: `unhandled_status:${sub.status}` };
  }

  if (deal.subscription_state === target) {
    return { result: "ok" };
  }

  const previous = deal.subscription_state;
  const nowMs = opts.nowMs ?? Date.now();

  await database
    .update(deals)
    .set({ subscription_state: target, updated_at_ms: nowMs })
    .where(eq(deals.id, deal.id));

  await database.insert(activity_log).values({
    id: randomUUID(),
    company_id: deal.company_id,
    deal_id: deal.id,
    kind: "note",
    body: `Subscription state: ${previous ?? "—"} → ${target} (Stripe).`,
    meta: {
      kind: "subscription_state_changed",
      stripe_subscription_id: sub.id,
      stripe_status: sub.status,
      previous_state: previous,
      new_state: target,
      event_id: opts.eventId,
    },
    created_at_ms: nowMs,
    created_by: "stripe_webhook",
  });

  return { result: "ok" };
}
