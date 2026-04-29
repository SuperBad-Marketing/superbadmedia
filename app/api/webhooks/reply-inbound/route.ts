/**
 * POST /api/webhooks/reply-inbound
 *
 * Resend inbound email webhook. Receives forwarded emails sent to
 * hi@contact.superbadmedia.com.au, matches the sender to a lead
 * candidate, and routes to the reply handler for classification +
 * draft generation.
 *
 * Svix-verified using RESEND_INBOUND_WEBHOOK_SECRET (separate from
 * the outbound event webhook secret).
 *
 * Owner: Reply Handling spec. Consumer: Resend inbound email forwarding.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Webhook, WebhookVerificationError } from "svix";
import { eq, and, desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { webhook_events } from "@/lib/db/schema/webhook-events";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { deals } from "@/lib/db/schema/deals";
import { handleInboundReply } from "@/lib/lead-gen/reply-handler";
import { transitionDealStage } from "@/lib/crm/transition-deal-stage";
import { logActivity } from "@/lib/activity-log";

interface ResendInboundPayload {
  created_at?: string;
  email_id?: string;
  from: string;
  to: string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: Array<{ name: string; value: string }>;
}

function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}

function extractInReplyTo(
  headers?: Array<{ name: string; value: string }>,
): string | null {
  if (!headers) return null;
  const header = headers.find(
    (h) => h.name.toLowerCase() === "in-reply-to",
  );
  if (!header?.value) return null;
  return header.value.replace(/^<|>$/g, "").trim();
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  const svixId =
    req.headers.get("svix-id") ?? req.headers.get("webhook-id");
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

  let payload: ResendInboundPayload;
  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });

    const parsed = verified as { data?: ResendInboundPayload } & ResendInboundPayload;
    payload = parsed.data ?? parsed;
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 },
      );
    }
    console.error("[reply-inbound] signature verification threw:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventId = svixId;
  const nowMs = Date.now();

  try {
    await db.insert(external_call_log).values({
      id: randomUUID(),
      job: "resend.inbound_reply.receive",
      actor_type: "internal",
      actor_id: null,
      shared_cohort_id: null,
      units: { from: payload.from, subject: payload.subject ?? "" },
      estimated_cost_aud: 0,
      prompt_version_hash: null,
      converted_from_candidate_id: null,
      created_at_ms: nowMs,
    });
  } catch (err) {
    console.error("[reply-inbound] external_call_log insert failed:", err);
  }

  let alreadyProcessed = false;
  try {
    await db
      .insert(webhook_events)
      .values({
        id: eventId,
        provider: "resend",
        event_type: "email.received",
        payload: payload as unknown as Record<string, unknown>,
        processed_at_ms: nowMs,
        result: "ok",
        error: null,
      })
      .onConflictDoNothing();

    const existing = await db
      .select({ processed_at_ms: webhook_events.processed_at_ms })
      .from(webhook_events)
      .where(eq(webhook_events.id, eventId))
      .limit(1);
    if (existing[0] && existing[0].processed_at_ms !== nowMs) {
      alreadyProcessed = true;
    }
  } catch (err) {
    console.error("[reply-inbound] webhook_events insert failed:", err);
    return NextResponse.json({ received: true, dispatch: "error" });
  }

  if (alreadyProcessed) {
    return NextResponse.json({ received: true, dispatch: "replay" });
  }

  const senderEmail = extractSenderEmail(payload.from);
  const replyText = payload.text || "";

  if (!senderEmail || !replyText.trim()) {
    await updateWebhookResult(eventId, "skipped", "empty_sender_or_body");
    return NextResponse.json({ received: true, dispatch: "skipped" });
  }

  const candidate = await db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.contact_email, senderEmail))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!candidate) {
    await updateWebhookResult(eventId, "skipped", "no_matching_candidate");
    return NextResponse.json({ received: true, dispatch: "skipped" });
  }

  let inReplyToDraftId: string | null = null;

  const inReplyToMessageId = extractInReplyTo(payload.headers);
  if (inReplyToMessageId) {
    const send = await db
      .select({ draft_id: outreachSends.draft_id })
      .from(outreachSends)
      .where(eq(outreachSends.resend_message_id, inReplyToMessageId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (send) {
      inReplyToDraftId = send.draft_id;
    }
  }

  if (!inReplyToDraftId) {
    const latestSend = await db
      .select({
        draft_id: outreachSends.draft_id,
        id: outreachSends.id,
      })
      .from(outreachSends)
      .innerJoin(outreachDrafts, eq(outreachSends.draft_id, outreachDrafts.id))
      .where(eq(outreachDrafts.candidate_id, candidate.id))
      .orderBy(desc(outreachSends.sent_at))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    inReplyToDraftId = latestSend?.draft_id ?? null;

    if (latestSend) {
      await db
        .update(outreachSends)
        .set({ replied_at: new Date(nowMs) })
        .where(eq(outreachSends.id, latestSend.id));
    }
  } else {
    const send = await db
      .select({ id: outreachSends.id })
      .from(outreachSends)
      .where(eq(outreachSends.resend_message_id, inReplyToMessageId!))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (send) {
      await db
        .update(outreachSends)
        .set({ replied_at: new Date(nowMs) })
        .where(eq(outreachSends.id, send.id));
    }
  }

  if (!inReplyToDraftId) {
    await logActivity({
      kind: "candidate_rescored",
      body: `Inbound reply from ${senderEmail} — no matching outreach draft found`,
      meta: { candidate_id: candidate.id, sender: senderEmail },
    });
    await updateWebhookResult(eventId, "skipped", "no_matching_draft");
    return NextResponse.json({ received: true, dispatch: "skipped" });
  }

  try {
    const result = await handleInboundReply({
      candidateId: candidate.id,
      replyText,
      inReplyToDraftId,
    });

    await logActivity({
      kind: "candidate_rescored",
      body: `Inbound reply processed from ${candidate.company_name}: ${result.classification} → ${result.action}`,
      meta: {
        candidate_id: candidate.id,
        classification: result.classification,
        action: result.action,
        reply_draft_id: result.replyDraftId,
        webhook_event_id: eventId,
      },
    });

    // Stop active outreach sequence with stopped_reply
    if (candidate.promoted_to_deal_id) {
      const activeSeqs = await db
        .select({ id: outreachSequences.id })
        .from(outreachSequences)
        .where(
          and(
            eq(outreachSequences.deal_id, candidate.promoted_to_deal_id),
            eq(outreachSequences.status, "active"),
          ),
        );

      for (const seq of activeSeqs) {
        await db
          .update(outreachSequences)
          .set({
            status: "stopped_reply",
            stopped_reason: `Inbound reply: ${result.classification}`,
          })
          .where(eq(outreachSequences.id, seq.id));
      }

      // Advance deal contacted → conversation on inbound reply
      const [deal] = await db
        .select({ id: deals.id, stage: deals.stage, company_id: deals.company_id })
        .from(deals)
        .where(eq(deals.id, candidate.promoted_to_deal_id))
        .limit(1);

      if (deal) {
        await logActivity({
          kind: "email_received",
          companyId: deal.company_id,
          dealId: deal.id,
          body: `Inbound reply from ${senderEmail} (${result.classification})`,
          createdBy: "system:reply_inbound_webhook",
          meta: {
            candidate_id: candidate.id,
            classification: result.classification,
            sender: senderEmail,
          },
        });

        if (deal.stage === "contacted") {
          try {
            transitionDealStage(
              deal.id,
              "conversation",
              {
                by: "system:reply_inbound_webhook",
                meta: {
                  source: "inbound_reply",
                  classification: result.classification,
                  candidate_id: candidate.id,
                },
              },
            );
          } catch {
            // Non-fatal — deal may have already advanced past contacted
          }
        }
      }
    }

    await updateWebhookResult(eventId, "ok");
    return NextResponse.json({
      received: true,
      dispatch: "ok",
      action: result.action,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reply-inbound] handler threw:", err);
    await updateWebhookResult(eventId, "error", message);
    return NextResponse.json({ received: true, dispatch: "error" });
  }
}

async function updateWebhookResult(
  eventId: string,
  result: "ok" | "error" | "skipped",
  error?: string,
) {
  try {
    await db
      .update(webhook_events)
      .set({ result, error: error ?? null })
      .where(eq(webhook_events.id, eventId));
  } catch (err) {
    console.error("[reply-inbound] webhook result update failed:", err);
  }
}
