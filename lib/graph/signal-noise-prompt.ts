/**
 * Builds the Haiku prompt for the `inbox-classify-signal-noise`
 * classifier (spec §7.3, Q12).
 *
 * Input context (spec §7.3):
 *  - Message body + subject + from address + domain
 *  - Router output is not passed in directly (it runs in parallel, per
 *    discipline #52), but the sender-address heuristics the router uses
 *    (noreply@, do-not-reply@) are cheap to re-derive here.
 *  - Recent `classification_corrections` where classifier = 'signal_noise'
 *
 * Output contract: JSON matching `SignalNoiseOutputSchema` in
 * `signal-noise.ts`.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { threads, messages } from "@/lib/db/schema/messages";
import { classification_corrections } from "@/lib/db/schema/classification-corrections";
import type { NormalizedMessage } from "./normalize";

export interface SignalNoiseThreadContext {
  is_client: boolean;
  relationship_type: string | null;
  always_keep_noise: boolean;
  sender_looks_automated: boolean;
}

export interface SignalNoisePromptContext {
  message: NormalizedMessage;
  thread: SignalNoiseThreadContext;
  corrections: Array<{
    from_address: string;
    subject: string | null;
    original: string;
    corrected: string;
  }>;
}

const MAX_CORRECTIONS = 10;

export async function loadSignalNoisePromptContext(
  msg: NormalizedMessage,
  threadId: string,
): Promise<SignalNoisePromptContext> {
  const [thread, corrections] = await Promise.all([
    loadThreadContext(msg, threadId),
    loadRecentCorrections(),
  ]);

  return { message: msg, thread, corrections };
}

async function loadThreadContext(
  msg: NormalizedMessage,
  threadId: string,
): Promise<SignalNoiseThreadContext> {
  const senderLooksAutomated = detectAutomatedSender(msg.from_address);

  const threadRow = await db
    .select({ contact_id: threads.contact_id })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  const defaults: SignalNoiseThreadContext = {
    is_client: false,
    relationship_type: null,
    always_keep_noise: false,
    sender_looks_automated: senderLooksAutomated,
  };

  if (!threadRow?.contact_id) return defaults;

  const contactRow = await db
    .select({
      relationship_type: contacts.relationship_type,
      always_keep_noise: contacts.always_keep_noise,
    })
    .from(contacts)
    .where(eq(contacts.id, threadRow.contact_id))
    .get();

  const relationship = contactRow?.relationship_type ?? null;
  const isClient = relationship === "client" || relationship === "past_client";

  return {
    is_client: isClient,
    relationship_type: relationship,
    always_keep_noise: contactRow?.always_keep_noise ?? false,
    sender_looks_automated: senderLooksAutomated,
  };
}

function detectAutomatedSender(fromAddress: string): boolean {
  const lower = fromAddress.toLowerCase();
  return (
    lower.startsWith("noreply@") ||
    lower.startsWith("no-reply@") ||
    lower.startsWith("do-not-reply@") ||
    lower.startsWith("donotreply@") ||
    lower.startsWith("notifications@") ||
    lower.startsWith("mailer-daemon@")
  );
}

async function loadRecentCorrections(): Promise<
  SignalNoisePromptContext["corrections"]
> {
  const rows = await db
    .select({
      original: classification_corrections.original_classification,
      corrected: classification_corrections.corrected_classification,
      message_id: classification_corrections.message_id,
    })
    .from(classification_corrections)
    .where(eq(classification_corrections.classifier, "signal_noise"))
    .orderBy(desc(classification_corrections.created_at_ms))
    .limit(MAX_CORRECTIONS);

  if (rows.length === 0) return [];

  const enriched: SignalNoisePromptContext["corrections"] = [];
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

export function buildSignalNoisePrompt(ctx: SignalNoisePromptContext): string {
  const threadBlock = [
    `- Relationship: ${ctx.thread.relationship_type ?? "unknown"}`,
    `- Is a client (current or past): ${ctx.thread.is_client ? "yes" : "no"}`,
    `- Andy has flagged this sender "always keep": ${ctx.thread.always_keep_noise ? "yes" : "no"}`,
    `- Sender address looks automated (noreply/no-reply/notifications/daemon): ${ctx.thread.sender_looks_automated ? "yes" : "no"}`,
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
    ? `\nPREVIOUS CORRECTIONS (learn from these — if a similar sender or pattern appears, follow the corrected classification):\n${correctionsBlock}\n`
    : "";

  return `You are the signal/noise classifier for Andy Robinson's inbox. Andy runs SuperBad Marketing solo. Decide whether this email deserves a place in his focused inbox, belongs in the muted noise folder, or is outright spam.

INCOMING EMAIL:
From: ${ctx.message.from_address}
Subject: ${ctx.message.subject ?? "(no subject)"}
Body (first 2000 chars):
${(ctx.message.body_text ?? "").slice(0, 2000)}

SENDER / THREAD CONTEXT:
${threadBlock}
${correctionsSection}
TASK: Classify this email on the signal/noise axis.

Priority classes:
- signal: Human correspondence that Andy cares about — clients, leads, collaborators, partners, suppliers, genuine 1:1 messages. Default for anything from a current client, and anything with a clearly human-to-human tone that would benefit from a reply.
- noise: Real email that isn't worth Andy's focused attention — receipts, marketing newsletters he subscribed to, platform notifications, automated updates, shipping confirmations, "someone viewed your profile". Not fraud, just low-value.
- spam: Unsolicited spam / phishing / scam / malicious. Senders Andy does not know, pitching something unasked, or attempting to deceive.

Noise sub-class (only when priority_class = noise; use null otherwise):
- transactional: Receipts, invoices, order confirmations, shipping notifications, payment receipts. These get a longer retention window because they're occasionally needed for tax/records.
- marketing: Newsletters, promotional broadcasts, campaign emails from companies Andy has (knowingly or not) subscribed to.
- automated: Platform / system notifications — "your subscription renews", "new login from X", "password changed", reminder emails from tools.
- update: Status updates from services Andy uses — GitHub notifications, social network digests, "here's what's new this week".
- other: Real noise that doesn't fit the four above.

Guidance:
- If the sender is a current client → almost always signal, even if the message is short.
- If the sender address looks automated (noreply/no-reply/notifications/daemon) → very rarely signal; classify as noise or spam.
- If Andy has flagged the sender "always keep" → lean toward signal unless the content is blatantly spam (that flag means Andy wants retention, which we honor separately, but the classification should still be honest).
- When the content is a receipt (invoice number, order total, payment confirmation) → noise + transactional.
- When in doubt between signal and noise, choose signal. A missed-signal email rotting in Noise is worse than a noise email cluttering Focus briefly — Andy can correct it.
- When in doubt between noise and spam, choose noise. Mis-classified spam in Noise is recoverable; mis-classified signal in Spam is a broken relationship.
- Spam is rare. Reserve it for unsolicited outreach from strangers, phishing, obvious scams.

Respond with a JSON object ONLY — no prose, no markdown fences:
{
  "priority_class": "signal" | "noise" | "spam",
  "noise_subclass": "transactional" | "marketing" | "automated" | "update" | "other" | null,
  "reason": "One-line explanation of why this classification was chosen"
}`;
}
