import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import settingsRegistry from "@/lib/settings";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleInvoiceFailedOpts {
  nowMs?: number;
  dbArg?: Db;
  eventId: string;
}

function subscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = (invoice as unknown as { subscription?: string | { id?: string } | null })
    .subscription;
  if (!sub) return null;
  if (typeof sub === "string") return sub;
  return sub.id ?? null;
}

function isSubscriptionCycle(invoice: Stripe.Invoice): boolean {
  // `billing_reason` identifies what triggered the invoice — we only
  // want to count true subscription-cycle failures, not one-off PIs that
  // happened to be attached to a subscription's customer record.
  const reason = (invoice as unknown as { billing_reason?: string | null })
    .billing_reason;
  if (!reason) return true; // default-safe: treat as cycle
  return (
    reason === "subscription_cycle" ||
    reason === "subscription_create" ||
    reason === "subscription_update" ||
    reason === "subscription"
  );
}

/**
 * `invoice.payment_failed` — SB-9 semantics.
 *
 * On first failure of a billing cycle: stamp
 * `first_payment_failure_at_ms`, set counter to 1, flip to `past_due`,
 * enqueue a 7-day `saas_data_loss_warning` escalation task. On repeat
 * failures within the same cycle: increment the counter only. Cycle
 * resets when `invoice.payment_succeeded` fires.
 *
 * One-off (non-subscription) invoices are skipped entirely.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  opts: HandleInvoiceFailedOpts,
): Promise<DispatchOutcome> {
  const subId = subscriptionId(invoice);
  if (!subId) {
    return { result: "skipped", error: "not_subscription_invoice" };
  }
  if (!isSubscriptionCycle(invoice)) {
    return { result: "skipped", error: "not_subscription_cycle" };
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

  // Only track failures on active / past_due subscriptions. Paused,
  // cancelled, or terminal states shouldn't see payment attempts in
  // practice; if Stripe ever fires spuriously, no-op (safer than
  // misincrementing a counter for a state that can't recover here).
  if (
    deal.subscription_state !== "active" &&
    deal.subscription_state !== "past_due"
  ) {
    return { result: "ok" };
  }
  // Idempotent same-state re-delivery guard: if already past_due and
  // this is the same cycle's retry re-delivered, still increment
  // (counter tracks attempts) — but skip duplicate state-change
  // semantics. The counter is the authoritative "how bad is this cycle"
  // signal.
  const nowMs = opts.nowMs ?? Date.now();
  const attemptCount = invoice.attempt_count ?? null;
  const nextAttempt = invoice.next_payment_attempt ?? null;
  const previousCount = deal.payment_failure_count ?? 0;
  const isFirstFailure = previousCount === 0;
  const previousState = deal.subscription_state;

  await database
    .update(deals)
    .set({
      subscription_state: "past_due",
      payment_failure_count: previousCount + 1,
      first_payment_failure_at_ms: isFirstFailure
        ? nowMs
        : deal.first_payment_failure_at_ms ?? nowMs,
      updated_at_ms: nowMs,
    })
    .where(eq(deals.id, deal.id));

  if (isFirstFailure) {
    await database.insert(activity_log).values({
      id: randomUUID(),
      company_id: deal.company_id,
      deal_id: deal.id,
      kind: "saas_payment_failed_lockout",
      body: `Subscription payment failed — state → past_due, data-loss warning scheduled.`,
      meta: {
        kind: "subscription_payment_failed",
        stripe_subscription_id: subId,
        stripe_invoice_id: invoice.id,
        attempt_count: attemptCount,
        next_payment_attempt_unix: nextAttempt,
        previous_state: previousState,
        new_state: "past_due",
        payment_failure_count: previousCount + 1,
        event_id: opts.eventId,
      },
      created_at_ms: nowMs,
      created_by: "stripe_webhook",
    });


    const warningDays = await settingsRegistry.get("saas.data_loss_warning_days");
    const runAtMs = nowMs + warningDays * 24 * 60 * 60 * 1000;
    await database
      .insert(scheduled_tasks)
      .values({
        id: randomUUID(),
        task_type: "saas_data_loss_warning",
        run_at_ms: runAtMs,
        payload: {
          deal_id: deal.id,
          first_failure_at_ms: nowMs,
        },
        status: "pending",
        attempts: 0,
        idempotency_key: `saas_data_loss:${deal.id}:${nowMs}`,
        created_at_ms: nowMs,
      })
      .onConflictDoNothing({ target: scheduled_tasks.idempotency_key });
  }

  return { result: "ok" };
}
