/**
 * Support-ticket-type classifier — Haiku-tier LLM call per spec §4.6
 * (support@ ticket overlay) + §7.3.
 *
 * Fires inline from `lib/graph/sync.ts` when a new inbound lands on a
 * thread whose `sending_address = 'support@'` and whose `ticket_type`
 * is still NULL. Writes `threads.ticket_type`,
 * `threads.ticket_type_assigned_by = 'claude'`, and opens the ticket
 * (`ticket_status = 'open'`) if it wasn't already set.
 *
 * Fallback asymmetry (discipline #63): on LLM/parse failure falls back
 * to `type = 'other'`. "Other" truthfully tells Andy Claude wasn't sure;
 * mis-categorising into a specific bucket routes him to the wrong
 * Customer Context chips.
 *
 * Gated by `inbox_sync_enabled` + `llm_calls_enabled`. When either is
 * off, returns a skip result and leaves `ticket_type = NULL` so Andy
 * can pick manually.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  threads,
  SUPPORT_TICKET_TYPES,
  type SupportTicketType,
} from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import type { NormalizedMessage } from "./normalize";
import { randomUUID } from "node:crypto";

export const SupportTicketTypeOutputSchema = z.object({
  type: z.enum(SUPPORT_TICKET_TYPES),
  reason: z.string(),
});
export type SupportTicketTypeOutput = z.infer<
  typeof SupportTicketTypeOutputSchema
>;

export interface SupportTicketTypeResult {
  type: SupportTicketType;
  reason: string;
  skipped: boolean;
}

interface SenderContext {
  relationship_type: string | null;
  is_live_subscriber: boolean;
}

async function loadSenderContext(contactId: string | null): Promise<SenderContext> {
  if (!contactId) {
    return { relationship_type: null, is_live_subscriber: false };
  }

  const contactRow = await db
    .select({ relationship_type: contacts.relationship_type })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  const dealRow = await db
    .select({ subscription_state: deals.subscription_state })
    .from(deals)
    .where(eq(deals.primary_contact_id, contactId))
    .get();

  const liveStates = new Set(["active", "past_due", "paused"]);
  const isLive = dealRow?.subscription_state
    ? liveStates.has(dealRow.subscription_state)
    : false;

  return {
    relationship_type: contactRow?.relationship_type ?? null,
    is_live_subscriber: isLive,
  };
}

export function buildSupportTicketTypePrompt(
  msg: NormalizedMessage,
  sender: SenderContext,
): string {
  const body = (msg.body_text ?? "").slice(0, 2000);
  return `You are the support-ticket classifier for SuperBad Marketing's support@ inbox. Pick the single best category for this ticket so the ticket overlay can show Andy the right customer context.

INCOMING EMAIL:
From: ${msg.from_address}
Subject: ${msg.subject ?? "(no subject)"}
Body (first 2000 chars):
${body}

SENDER CONTEXT:
- Relationship: ${sender.relationship_type ?? "unknown"}
- Is a live paying SaaS subscriber: ${sender.is_live_subscriber ? "yes" : "no"}

TASK: Classify this support ticket into one of the six types below.

Categories:
- billing: Invoice, card, charge, refund-request-phrased-as-billing-question, subscription-state, payment failure, plan change. (If they explicitly ask for money back, use "refund" instead.)
- bug: Something in the product is broken or misbehaving — error, crash, wrong output, UI glitch, feature not responding.
- question: They're asking how to do something, where to find something, or whether the product supports X. Not broken — just not obvious.
- feedback: Unsolicited opinion or suggestion — praise, complaint, feature request, "you should…", "it would be great if…".
- refund: Explicit refund or cancel-and-refund request. Even if phrased politely, if they want money back it's refund.
- other: Doesn't fit any of the five above, or you're genuinely not sure. Use this rather than mis-categorising.

Guidance:
- Err toward "other" when the message is ambiguous. Andy can override in one click — a confident wrong answer is worse than an honest "I'm not sure".
- A live subscriber reporting "this isn't working" is "bug" unless the body clearly names an account/billing problem.
- "Can I get a refund for…" is always "refund", not "billing".
- Pure praise with no question is "feedback", not "question".

Respond with a JSON object ONLY — no prose, no markdown fences:
{
  "type": "billing" | "bug" | "question" | "feedback" | "refund" | "other",
  "reason": "One-line explanation of why this category was chosen"
}`;
}

export async function classifySupportTicketType(
  msg: NormalizedMessage,
  threadId: string,
): Promise<SupportTicketTypeResult> {
  if (!killSwitches.inbox_sync_enabled || !killSwitches.llm_calls_enabled) {
    return {
      type: "other",
      reason: "skipped (kill switch)",
      skipped: true,
    };
  }

  const threadRow = await db
    .select({
      contact_id: threads.contact_id,
      ticket_type: threads.ticket_type,
      ticket_status: threads.ticket_status,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  if (!threadRow) {
    return { type: "other", reason: "thread not found", skipped: true };
  }

  // Customer reply on an existing ticket — flip status back to `open` if
  // the ticket had moved to `waiting_on_customer` or `resolved`. Spec
  // §4.3 status auto-transitions. Does not re-run classification.
  if (threadRow.ticket_type) {
    if (
      threadRow.ticket_status === "waiting_on_customer" ||
      threadRow.ticket_status === "resolved"
    ) {
      await reopenTicketOnCustomerReply(
        threadId,
        threadRow.contact_id,
        threadRow.ticket_status,
      );
    }
    return {
      type: threadRow.ticket_type,
      reason: "already classified",
      skipped: true,
    };
  }

  const sender = await loadSenderContext(threadRow.contact_id);
  const prompt = buildSupportTicketTypePrompt(msg, sender);

  let parsed: SupportTicketTypeOutput;
  try {
    const text = await invokeLlmText({
      job: "inbox-classify-support-ticket-type",
      prompt,
      maxTokens: 120,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = SupportTicketTypeOutputSchema.parse(JSON.parse(json));
  } catch (err) {
    console.error(
      "[support-ticket-type] Classification failed, falling back to 'other':",
      err,
    );
    parsed = { type: "other", reason: "fallback — LLM/parse error" };
  }

  await persistTicketType(threadId, threadRow.contact_id, parsed);

  return { type: parsed.type, reason: parsed.reason, skipped: false };
}

async function reopenTicketOnCustomerReply(
  threadId: string,
  contactId: string | null,
  previousStatus: "waiting_on_customer" | "resolved",
): Promise<void> {
  const nowMs = Date.now();
  await db
    .update(threads)
    .set({
      ticket_status: "open",
      ticket_resolved_at_ms: null,
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, threadId));

  await db.insert(activity_log).values({
    id: randomUUID(),
    contact_id: contactId,
    company_id: null,
    deal_id: null,
    kind: "inbox_ticket_status_changed",
    body: `Ticket re-opened after customer reply (was ${previousStatus}).`,
    meta: {
      thread_id: threadId,
      previous_status: previousStatus,
      new_status: "open",
      trigger: "customer_reply",
    },
    created_at_ms: nowMs,
    created_by: "claude",
  });
}

async function persistTicketType(
  threadId: string,
  contactId: string | null,
  output: SupportTicketTypeOutput,
): Promise<void> {
  const nowMs = Date.now();

  await db
    .update(threads)
    .set({
      ticket_type: output.type,
      ticket_type_assigned_by: "claude",
      ticket_status: "open",
      updated_at_ms: nowMs,
    })
    .where(eq(threads.id, threadId));

  await db.insert(activity_log).values({
    id: randomUUID(),
    contact_id: contactId,
    company_id: null,
    deal_id: null,
    kind: "inbox_ticket_type_assigned",
    body: `Claude classified support ticket as ${output.type}.`,
    meta: {
      thread_id: threadId,
      type: output.type,
      reason: output.reason,
    },
    created_at_ms: nowMs,
    created_by: "claude",
  });
}
