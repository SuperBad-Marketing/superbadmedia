"use server";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema/messages";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { sendEmail } from "@/lib/channels/email/send";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";

export async function generateDraftReply(threadId: string): Promise<{
  ok: boolean;
  draft?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorised" };
  }

  const thread = await db.select().from(threads).where(eq(threads.id, threadId)).get();
  if (!thread) return { ok: false, error: "Thread not found" };

  const threadMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.thread_id, threadId))
    .orderBy(desc(messages.created_at_ms))
    .limit(10);

  if (threadMessages.length === 0) {
    return { ok: false, error: "No messages in thread" };
  }

  const lastInbound = threadMessages.find((m) => m.direction === "inbound");
  if (!lastInbound) {
    return { ok: false, error: "No inbound message to reply to" };
  }

  const history = threadMessages
    .reverse()
    .map((m) => {
      const dir = m.direction === "inbound" ? "THEM" : "US";
      const body = (m.body_text ?? "").slice(0, 1500);
      return `[${dir}] ${body}`;
    })
    .join("\n\n---\n\n");

  const senderName = lastInbound.from_address?.split("@")[0]?.split(/[._+]/).map(
    (w) => w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ") ?? "them";

  const prompt = `You're Andy from SuperBad Marketing, replying to an email thread. Write a reply to the most recent inbound message.

Thread subject: ${thread.subject ?? "(no subject)"}
Most recent message from: ${lastInbound.from_address ?? "unknown"}

Thread history (oldest first):
${history}

Voice rules:
- Dry, warm, direct. Short sentences.
- No "I hope this email finds you well" or similar filler.
- No exclamation marks.
- Sign off with just "Andy" (no title, no logo).
- Australian English spelling.
- Get to the point. Be helpful and human.

Write ONLY the reply body text. No subject line, no "RE:", no preamble. Just the reply that ${senderName} will read.`;

  try {
    const draft = await invokeLlmText({
      job: "inbox-draft-reply",
      prompt,
      maxTokens: 600,
    });

    return { ok: true, draft: draft.trim() };
  } catch (err) {
    console.error("[admin-draft-reply] LLM error:", err);
    return { ok: false, error: "Failed to generate draft" };
  }
}

export async function sendThreadReply(
  threadId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorised" };
  }

  if (!body.trim()) return { ok: false, error: "Reply body is empty" };

  const thread = await db.select().from(threads).where(eq(threads.id, threadId)).get();
  if (!thread) return { ok: false, error: "Thread not found" };

  const lastInbound = await db
    .select()
    .from(messages)
    .where(eq(messages.thread_id, threadId))
    .orderBy(desc(messages.created_at_ms))
    .limit(20)
    .then((rows) => rows.find((m) => m.direction === "inbound"));

  if (!lastInbound?.from_address) {
    return { ok: false, error: "No inbound message to reply to" };
  }

  const subject = thread.subject
    ? (thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`)
    : "Re: your message";

  const htmlBody = body
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");

  const result = await sendEmail({
    to: lastInbound.from_address,
    subject,
    body: htmlBody,
    classification: "admin_reply",
    purpose: "admin_thread_reply",
    headers: lastInbound.message_id_header
      ? { "In-Reply-To": lastInbound.message_id_header }
      : undefined,
  });

  if (!result.sent) {
    return { ok: false, error: result.reason ?? "Send failed" };
  }

  const now = Date.now();
  const messageId = randomUUID();

  await db.insert(messages).values({
    id: messageId,
    thread_id: threadId,
    direction: "outbound",
    channel: "email",
    from_address: process.env.EMAIL_FROM ?? "support@superbadmedia.com.au",
    to_addresses: [lastInbound.from_address],
    cc_addresses: [],
    bcc_addresses: [],
    subject,
    body_text: body,
    body_html: htmlBody,
    headers: {},
    message_id_header: result.messageId ?? null,
    in_reply_to_header: lastInbound.message_id_header ?? null,
    references_header: null,
    sent_at_ms: now,
    received_at_ms: now,
    priority_class: "signal",
    noise_subclass: null,
    notification_priority: null,
    router_classification: null,
    router_reason: null,
    is_engaged: true,
    engagement_signals: [{ type: "sent", at: now }],
    import_source: "live",
    has_attachments: false,
    has_calendar_invite: false,
    graph_message_id: null,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await db
    .update(threads)
    .set({
      last_message_at_ms: now,
      last_outbound_at_ms: now,
      ticket_status: "waiting_on_customer",
      has_cached_draft: false,
      cached_draft_body: null,
      cached_draft_stale: false,
      updated_at_ms: now,
    })
    .where(eq(threads.id, threadId));

  await logActivity({
    companyId: thread.company_id,
    contactId: thread.contact_id,
    kind: "inbox_message_sent",
    body: `Reply sent to ${lastInbound.from_address} in thread "${thread.subject ?? "(no subject)"}"`,
    meta: { thread_id: threadId, message_id: messageId },
  });

  return { ok: true };
}
