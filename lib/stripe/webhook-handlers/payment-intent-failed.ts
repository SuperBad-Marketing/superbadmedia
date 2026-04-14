import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { activity_log } from "@/lib/db/schema/activity-log";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandlePIFailedOpts {
  nowMs?: number;
  dbArg?: Db;
  eventId: string;
}

/**
 * `payment_intent.payment_failed` —
 *   Quote Builder spec §7.1: quote status stays `accepted` on payment
 *   failure; client retries in the Payment Element. Handler only logs
 *   the failure for audit — no state change.
 *
 *   Non-quote PIs (Checkout Session flows) are skipped for idempotency
 *   the same way `payment_intent.succeeded` handles them.
 */
export async function handlePaymentIntentFailed(
  pi: Stripe.PaymentIntent,
  opts: HandlePIFailedOpts,
): Promise<DispatchOutcome> {
  const productType = pi.metadata?.product_type;
  if (productType !== "quote") {
    return { result: "skipped", error: "covered_by_checkout_session" };
  }

  const quoteId = pi.metadata?.quote_id;
  const dealId = pi.metadata?.deal_id;
  if (!quoteId || !dealId) {
    return { result: "error", error: "missing_metadata.quote_or_deal_id" };
  }

  const database = (opts.dbArg ?? defaultDb) as Db;

  const quote = await database
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .get();
  if (!quote) {
    return { result: "error", error: `quote_not_found:${quoteId}` };
  }

  const failureCode = pi.last_payment_error?.code ?? null;
  const failureMessage = pi.last_payment_error?.message ?? null;
  const reason = failureMessage ?? failureCode ?? "unknown";
  const nowMs = opts.nowMs ?? Date.now();

  await database
    .insert(activity_log)
    .values({
      id: randomUUID(),
      company_id: quote.company_id,
      deal_id: quote.deal_id,
      kind: "note",
      body: `Payment failed for ${quote.quote_number}: ${reason}`,
      meta: {
        kind: "quote_payment_failed",
        quote_id: quote.id,
        stripe_payment_intent_id: pi.id,
        failure_code: failureCode,
        failure_message: failureMessage,
        event_id: opts.eventId,
      },
      created_at_ms: nowMs,
      created_by: "stripe_webhook",
    });

  return { result: "ok" };
}
