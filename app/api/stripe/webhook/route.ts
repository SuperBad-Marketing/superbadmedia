/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook receiver + dispatcher. Verifies `stripe-signature`,
 * inserts an idempotency row into `webhook_events` (PK = Stripe event
 * id), dispatches the event to the CRM handlers in
 * `lib/stripe/webhook-handlers/`, then updates the row with the outcome.
 *
 * Responds 200 on every signed, well-formed request — even when
 * dispatch returns `error` or `skipped`. Stripe retries on non-2xx are
 * worse than a recorded failure; triage happens off the `webhook_events`
 * table. Only bad signatures / missing secrets respond non-2xx (400).
 *
 * Still emits the existing `external_call_log` row (SW-5c E2E contract).
 *
 * Owner: SP-7. Spec: docs/specs/sales-pipeline.md §§10.1, 12.1.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { webhook_events } from "@/lib/db/schema/webhook-events";
import { dispatchStripeEvent } from "@/lib/stripe/webhook-handlers";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json(
      { error: "Missing signature or secret" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("[stripe.webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await db.insert(external_call_log).values({
      id: randomUUID(),
      job: "stripe.webhook.receive",
      actor_type: "internal",
      actor_id: null,
      shared_cohort_id: null,
      units: { event_type: event.type, event_id: event.id },
      estimated_cost_aud: 0,
      prompt_version_hash: null,
      converted_from_candidate_id: null,
      created_at_ms: Date.now(),
    });
  } catch (err) {
    console.error("[stripe.webhook] external_call_log insert failed:", err);
  }

  const nowMs = Date.now();

  // Idempotency: insert-or-skip. The PK (event.id) collides on replay.
  let alreadyProcessed = false;
  try {
    await db
      .insert(webhook_events)
      .values({
        id: event.id,
        provider: "stripe",
        event_type: event.type,
        payload: event,
        processed_at_ms: nowMs,
        result: "ok",
        error: null,
      })
      .onConflictDoNothing();

    const existing = await db
      .select({ processed_at_ms: webhook_events.processed_at_ms })
      .from(webhook_events)
      .where(eq(webhook_events.id, event.id))
      .limit(1);
    if (existing[0] && existing[0].processed_at_ms !== nowMs) {
      alreadyProcessed = true;
    }
  } catch (err) {
    console.error("[stripe.webhook] webhook_events insert failed:", err);
    return NextResponse.json({ received: true, dispatch: "error" });
  }

  if (alreadyProcessed) {
    return NextResponse.json({ received: true, dispatch: "replay" });
  }

  // Dispatch and stamp outcome. Never re-throw.
  let outcome;
  try {
    outcome = await dispatchStripeEvent(event, { nowMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe.webhook] dispatch threw:", err);
    outcome = { result: "error" as const, error: `unexpected:${message}` };
  }

  try {
    await db
      .update(webhook_events)
      .set({ result: outcome.result, error: outcome.error ?? null })
      .where(eq(webhook_events.id, event.id));
  } catch (err) {
    console.error("[stripe.webhook] webhook_events update failed:", err);
  }

  return NextResponse.json({ received: true, dispatch: outcome.result });
}
