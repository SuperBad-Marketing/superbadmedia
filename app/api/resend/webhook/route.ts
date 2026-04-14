/**
 * POST /api/resend/webhook
 *
 * Resend webhook receiver + dispatcher. Verifies the Svix signature
 * headers, inserts an idempotency row into `webhook_events` (PK = Svix
 * message id), dispatches the event to the CRM handlers in
 * `lib/resend/webhook-handlers/`, then updates the row with the outcome.
 *
 * Responds 200 on every signed, well-formed request — even when dispatch
 * returns `error` or `skipped`. Resend's retry behaviour on non-2xx is
 * worse than a recorded failure; triage happens off `webhook_events`.
 * Bad signatures / missing secrets respond 400.
 *
 * Mirrors `app/api/stripe/webhook/route.ts` (SP-7).
 *
 * Owner: SP-8. Spec: docs/specs/sales-pipeline.md §§3.4, 10.2, 12.1.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Webhook, WebhookVerificationError } from "svix";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { webhook_events } from "@/lib/db/schema/webhook-events";
import {
  dispatchResendEvent,
  type ResendWebhookEvent,
} from "@/lib/resend/webhook-handlers";

export const runtime = "nodejs";

function eventIdFromHeaders(req: Request): string | null {
  return req.headers.get("svix-id") ?? req.headers.get("webhook-id");
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const svixId = eventIdFromHeaders(req);
  const svixTimestamp =
    req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp");
  const svixSignature =
    req.headers.get("svix-signature") ?? req.headers.get("webhook-signature");

  if (!secret || !svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing signature headers or secret" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  let event: ResendWebhookEvent;
  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    event = verified as ResendWebhookEvent;
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 },
      );
    }
    console.error("[resend.webhook] signature verification threw:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType = typeof event?.type === "string" ? event.type : "unknown";

  try {
    await db.insert(external_call_log).values({
      id: randomUUID(),
      job: "resend.webhook.receive",
      actor_type: "internal",
      actor_id: null,
      shared_cohort_id: null,
      units: { event_type: eventType, event_id: svixId },
      estimated_cost_aud: 0,
      prompt_version_hash: null,
      converted_from_candidate_id: null,
      created_at_ms: Date.now(),
    });
  } catch (err) {
    console.error("[resend.webhook] external_call_log insert failed:", err);
  }

  const nowMs = Date.now();

  let alreadyProcessed = false;
  try {
    await db
      .insert(webhook_events)
      .values({
        id: svixId,
        provider: "resend",
        event_type: eventType,
        payload: event,
        processed_at_ms: nowMs,
        result: "ok",
        error: null,
      })
      .onConflictDoNothing();

    const existing = await db
      .select({ processed_at_ms: webhook_events.processed_at_ms })
      .from(webhook_events)
      .where(eq(webhook_events.id, svixId))
      .limit(1);
    if (existing[0] && existing[0].processed_at_ms !== nowMs) {
      alreadyProcessed = true;
    }
  } catch (err) {
    console.error("[resend.webhook] webhook_events insert failed:", err);
    return NextResponse.json({ received: true, dispatch: "error" });
  }

  if (alreadyProcessed) {
    return NextResponse.json({ received: true, dispatch: "replay" });
  }

  let outcome;
  try {
    outcome = await dispatchResendEvent(event, { nowMs, eventId: svixId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resend.webhook] dispatch threw:", err);
    outcome = { result: "error" as const, error: `unexpected:${message}` };
  }

  try {
    await db
      .update(webhook_events)
      .set({ result: outcome.result, error: outcome.error ?? null })
      .where(eq(webhook_events.id, svixId));
  } catch (err) {
    console.error("[resend.webhook] webhook_events update failed:", err);
  }

  return NextResponse.json({ received: true, dispatch: outcome.result });
}
