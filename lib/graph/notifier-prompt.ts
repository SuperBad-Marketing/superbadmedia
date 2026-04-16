/**
 * Builds the Haiku prompt for the `inbox-classify-notification-priority`
 * classifier (spec §7.2, Q10).
 *
 * Input context (spec §7.2):
 *  - Message body + subject
 *  - Thread context (is it a client? open support ticket? waiting on Andy?)
 *  - Contact.notification_weight (ambient learning — high positive = always
 *    push, high negative = always silent)
 *  - Recent `classification_corrections` where classifier = 'notifier'
 *
 * Output contract: JSON matching `NotifierOutputSchema` in `notifier.ts`.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { threads, messages } from "@/lib/db/schema/messages";
import { classification_corrections } from "@/lib/db/schema/classification-corrections";
import type { NormalizedMessage } from "./normalize";

export interface NotifierThreadContext {
  is_client: boolean;
  relationship_type: string | null;
  ticket_status: string | null;
  waiting_on_andy: boolean;
  notification_weight: number;
}

export interface NotifierPromptContext {
  message: NormalizedMessage;
  thread: NotifierThreadContext;
  corrections: Array<{
    from_address: string;
    subject: string | null;
    original: string;
    corrected: string;
  }>;
}

const MAX_CORRECTIONS = 10;

export async function loadNotifierPromptContext(
  msg: NormalizedMessage,
  threadId: string,
): Promise<NotifierPromptContext> {
  const [thread, corrections] = await Promise.all([
    loadThreadContext(threadId),
    loadRecentCorrections(),
  ]);

  return { message: msg, thread, corrections };
}

async function loadThreadContext(
  threadId: string,
): Promise<NotifierThreadContext> {
  const threadRow = await db
    .select({
      contact_id: threads.contact_id,
      ticket_status: threads.ticket_status,
      last_inbound_at_ms: threads.last_inbound_at_ms,
      last_outbound_at_ms: threads.last_outbound_at_ms,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  const defaults: NotifierThreadContext = {
    is_client: false,
    relationship_type: null,
    ticket_status: null,
    waiting_on_andy: false,
    notification_weight: 0,
  };

  if (!threadRow) return defaults;

  const waitingOnAndy =
    (threadRow.last_inbound_at_ms ?? 0) > (threadRow.last_outbound_at_ms ?? 0);

  if (!threadRow.contact_id) {
    return {
      ...defaults,
      ticket_status: threadRow.ticket_status ?? null,
      waiting_on_andy: waitingOnAndy,
    };
  }

  const contactRow = await db
    .select({
      relationship_type: contacts.relationship_type,
      notification_weight: contacts.notification_weight,
    })
    .from(contacts)
    .where(eq(contacts.id, threadRow.contact_id))
    .get();

  const relationship = contactRow?.relationship_type ?? null;
  const isClient = relationship === "client" || relationship === "past_client";

  return {
    is_client: isClient,
    relationship_type: relationship,
    ticket_status: threadRow.ticket_status ?? null,
    waiting_on_andy: waitingOnAndy,
    notification_weight: contactRow?.notification_weight ?? 0,
  };
}

async function loadRecentCorrections(): Promise<
  NotifierPromptContext["corrections"]
> {
  const rows = await db
    .select({
      original: classification_corrections.original_classification,
      corrected: classification_corrections.corrected_classification,
      message_id: classification_corrections.message_id,
    })
    .from(classification_corrections)
    .where(eq(classification_corrections.classifier, "notifier"))
    .orderBy(desc(classification_corrections.created_at_ms))
    .limit(MAX_CORRECTIONS);

  if (rows.length === 0) return [];

  const enriched: NotifierPromptContext["corrections"] = [];
  for (const row of rows) {
    const [msg] = await db
      .select({ from_address: messages.from_address, subject: messages.subject })
      .from(messages)
      .where(eq(messages.id, row.message_id))
      .limit(1);
    enriched.push({
      from_address: msg?.from_address ?? "unknown",
      subject: msg?.subject ?? null,
      original: row.original,
      corrected: row.corrected,
    });
  }

  return enriched;
}

export function buildNotifierPrompt(ctx: NotifierPromptContext): string {
  const weightHint =
    ctx.thread.notification_weight > 0
      ? `+${ctx.thread.notification_weight} (Andy has previously asked to be notified more from this contact)`
      : ctx.thread.notification_weight < 0
        ? `${ctx.thread.notification_weight} (Andy has previously silenced this contact)`
        : "0 (neutral — no learned preference)";

  const threadBlock = [
    `- Relationship: ${ctx.thread.relationship_type ?? "unknown"}`,
    `- Is a client (current or past): ${ctx.thread.is_client ? "yes" : "no"}`,
    `- Support ticket status: ${ctx.thread.ticket_status ?? "not a ticket"}`,
    `- Waiting on Andy's reply: ${ctx.thread.waiting_on_andy ? "yes" : "no"}`,
    `- Contact notification_weight: ${weightHint}`,
  ].join("\n");

  const correctionsBlock =
    ctx.corrections.length > 0
      ? ctx.corrections
          .map(
            (c) =>
              `- From: ${c.from_address} | Subject: "${c.subject ?? "(none)"}" | Was: ${c.original} → Should be: ${c.corrected}`,
          )
          .join("\n")
      : "";

  const correctionsSection = correctionsBlock
    ? `\nPREVIOUS CORRECTIONS (learn from these — if a similar sender or pattern appears, follow the corrected priority):\n${correctionsBlock}\n`
    : "";

  return `You are the notification triage classifier for Andy Robinson's inbox. Andy runs SuperBad Marketing solo. Decide how loudly this inbound email should interrupt him.

INCOMING EMAIL:
From: ${ctx.message.from_address}
Subject: ${ctx.message.subject ?? "(no subject)"}
Body (first 2000 chars):
${(ctx.message.body_text ?? "").slice(0, 2000)}

THREAD CONTEXT:
${threadBlock}
${correctionsSection}
TASK: Classify this email into exactly one priority tier.

Priority tiers:
- urgent: Andy must see this immediately. Persistent notification, doesn't auto-dismiss. Reserved for paying-client emergencies, open support tickets escalating, money/contract blockers, or time-sensitive shoot-day issues.
- push: Standard push notification. Client messages needing reply, new lead enquiries, anything Andy would normally want to know about within the hour.
- silent: No push. Accumulates into the 8am morning digest. Default for receipts, newsletters, automated updates, low-priority correspondence, and non-client chatter.

Guidance:
- If the sender is not a client and the email is clearly automated or promotional → silent.
- If the sender is a current client and the tone conveys problem / urgency / deadline → urgent.
- If Andy has a high positive notification_weight on the contact → lean push or urgent.
- If Andy has a high negative notification_weight → lean silent.
- When in doubt between push and silent, choose silent. Interrupting Andy erodes trust faster than a delayed response.
- When in doubt between urgent and push, choose push. Urgent is reserved for true emergencies.

Respond with a JSON object ONLY — no prose, no markdown fences:
{
  "priority": "urgent" | "push" | "silent",
  "reason": "One-line explanation of why this priority was chosen"
}`;
}
