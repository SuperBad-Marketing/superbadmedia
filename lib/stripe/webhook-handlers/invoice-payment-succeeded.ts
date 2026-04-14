import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleInvoiceSucceededOpts {
  nowMs?: number;
  dbArg?: Db;
  eventId: string;
}

function subscriptionId(
  invoice: Stripe.Invoice,
): string | null {
  const sub = (invoice as unknown as { subscription?: string | { id?: string } | null })
    .subscription;
  if (!sub) return null;
  if (typeof sub === "string") return sub;
  return sub.id ?? null;
}

/**
 * `invoice.payment_succeeded` — fires every successful cycle. We only act
 * when this confirms a recovery from `past_due`; otherwise (a healthy
 * monthly charge on an `active` subscription) no log, no write. The
 * ongoing-cycle record lives in the `invoices` table (Branded Invoicing),
 * not activity_log, to avoid noise. One-off invoices are skipped.
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  opts: HandleInvoiceSucceededOpts,
): Promise<DispatchOutcome> {
  const subId = subscriptionId(invoice);
  if (!subId) {
    return { result: "skipped", error: "not_subscription_invoice" };
  }

  const database = (opts.dbArg ?? defaultDb) as Db;

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.stripe_subscription_id, subId))
    .get();
  if (!deal) {
    return { result: "error", error: `deal_not_found_for_subscription:${subId}` };
  }

  if (deal.subscription_state !== "past_due") {
    return { result: "ok" };
  }

  const nowMs = opts.nowMs ?? Date.now();

  await database
    .update(deals)
    .set({ subscription_state: "active", updated_at_ms: nowMs })
    .where(eq(deals.id, deal.id));

  await database.insert(activity_log).values({
    id: randomUUID(),
    company_id: deal.company_id,
    deal_id: deal.id,
    kind: "note",
    body: `Subscription payment recovered — past_due → active.`,
    meta: {
      kind: "subscription_payment_recovered",
      stripe_subscription_id: subId,
      stripe_invoice_id: invoice.id,
      previous_state: "past_due",
      new_state: "active",
      event_id: opts.eventId,
    },
    created_at_ms: nowMs,
    created_by: "stripe_webhook",
  });

  return { result: "ok" };
}
