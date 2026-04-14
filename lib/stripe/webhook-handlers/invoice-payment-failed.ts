import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleInvoiceFailedOpts {
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
 * `invoice.payment_failed` — Stripe auto-retries per its dunning policy.
 * We mirror the state (`active → past_due`) for visibility; no auto-cancel
 * here (FOUNDATIONS §12: cancellation is Stripe-owned via dunning limits
 * or client-initiated). One-off invoices (no subscription) are skipped.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  opts: HandleInvoiceFailedOpts,
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

  if (deal.subscription_state !== "active") {
    return { result: "ok" };
  }

  const nowMs = opts.nowMs ?? Date.now();
  const attemptCount = invoice.attempt_count ?? null;
  const nextAttempt = invoice.next_payment_attempt ?? null;

  await database
    .update(deals)
    .set({ subscription_state: "past_due", updated_at_ms: nowMs })
    .where(eq(deals.id, deal.id));

  await database.insert(activity_log).values({
    id: randomUUID(),
    company_id: deal.company_id,
    deal_id: deal.id,
    kind: "note",
    body: `Subscription payment failed — attempt ${attemptCount ?? "?"}, state → past_due.`,
    meta: {
      kind: "subscription_payment_failed",
      stripe_subscription_id: subId,
      stripe_invoice_id: invoice.id,
      attempt_count: attemptCount,
      next_payment_attempt_unix: nextAttempt,
      previous_state: "active",
      new_state: "past_due",
      event_id: opts.eventId,
    },
    created_at_ms: nowMs,
    created_by: "stripe_webhook",
  });

  return { result: "ok" };
}
