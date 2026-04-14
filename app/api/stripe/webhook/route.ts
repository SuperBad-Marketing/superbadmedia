/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook receiver. Verifies `stripe-signature` against
 * `STRIPE_WEBHOOK_SECRET`, logs one `external_call_log` row per valid
 * event, and returns 200. Bad signature → 400. Never throws.
 *
 * Consumed by `checkStripeWebhookReceivedAction` in the critical-flight
 * stripe-admin wizard (SW-5), which polls `external_call_log` for
 * `job="stripe.webhook.receive"`.
 *
 * Owner: SW-5b. Spec: docs/specs/setup-wizards.md §5.1.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";

export const runtime = "nodejs";

// Lazy per-request instance. The module-level singleton in `lib/stripe/client.ts`
// throws at import when STRIPE_SECRET_KEY is empty, which breaks build-time
// page-data collection for this route.
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
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
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

  return NextResponse.json({ received: true });
}
