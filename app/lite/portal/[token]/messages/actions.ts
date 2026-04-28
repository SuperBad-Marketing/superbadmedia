"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { threads, messages, type ThreadInsert } from "@/lib/db/schema/messages";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal/guard";
import { updateThreadTimestamps } from "@/lib/graph/thread";
import { logActivity } from "@/lib/activity-log";

export type PortalMessage = {
  id: string;
  direction: "inbound" | "outbound";
  bodyText: string;
  sentAtMs: number | null;
  receivedAtMs: number | null;
  hasAttachments: boolean;
};

export type PortalThread = {
  id: string;
  subject: string | null;
  channel: string;
  lastMessageAtMs: number;
  ticketStatus: string | null;
  messages: PortalMessage[];
};

export async function fetchPortalThreads(): Promise<PortalThread[]> {
  const session = await getPortalSession();
  if (!session) throw new Error("No portal session");

  const threadRows = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      channel_of_origin: threads.channel_of_origin,
      last_message_at_ms: threads.last_message_at_ms,
      ticket_status: threads.ticket_status,
    })
    .from(threads)
    .where(
      and(
        eq(threads.contact_id, session.contactId),
        eq(threads.priority_class, "signal"),
      ),
    )
    .orderBy(desc(threads.last_message_at_ms))
    .limit(30);

  if (threadRows.length === 0) return [];

  const threadIds = threadRows.map((t) => t.id);

  const messageRows = await db
    .select({
      id: messages.id,
      thread_id: messages.thread_id,
      direction: messages.direction,
      body_text: messages.body_text,
      sent_at_ms: messages.sent_at_ms,
      received_at_ms: messages.received_at_ms,
      has_attachments: messages.has_attachments,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.thread_id, threadIds),
        isNull(messages.deleted_at_ms),
      ),
    )
    .orderBy(messages.created_at_ms);

  const messagesByThread = new Map<string, PortalMessage[]>();
  for (const m of messageRows) {
    const list = messagesByThread.get(m.thread_id) ?? [];
    list.push({
      id: m.id,
      direction: m.direction as "inbound" | "outbound",
      bodyText: m.body_text,
      sentAtMs: m.sent_at_ms,
      receivedAtMs: m.received_at_ms,
      hasAttachments: m.has_attachments,
    });
    messagesByThread.set(m.thread_id, list);
  }

  return threadRows.map((t) => ({
    id: t.id,
    subject: t.subject,
    channel: t.channel_of_origin,
    lastMessageAtMs: t.last_message_at_ms,
    ticketStatus: t.ticket_status,
    messages: messagesByThread.get(t.id) ?? [],
  }));
}

const MAX_BODY_LENGTH = 5000;

export async function sendPortalReply(
  threadId: string,
  body: string,
): Promise<{ ok: true; message: PortalMessage } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "Message is empty." };
  if (trimmed.length > MAX_BODY_LENGTH)
    return { ok: false, error: "Message is too long." };

  const session = await getPortalSession();
  if (!session) return { ok: false, error: "Session expired." };

  const [thread] = await db
    .select({ id: threads.id, contact_id: threads.contact_id })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!thread || thread.contact_id !== session.contactId) {
    return { ok: false, error: "Thread not found." };
  }

  const [contact] = await db
    .select({ email: contacts.email, company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  const now = Date.now();
  const messageId = randomUUID();

  await db.insert(messages).values({
    id: messageId,
    thread_id: threadId,
    direction: "inbound",
    channel: "portal_chat",
    from_address: contact?.email ?? session.contactId,
    to_addresses: ["andy@superbadmedia.com.au"],
    subject: null,
    body_text: trimmed,
    body_html: null,
    headers: {},
    message_id_header: null,
    in_reply_to_header: null,
    references_header: null,
    sent_at_ms: now,
    received_at_ms: now,
    priority_class: "signal",
    noise_subclass: null,
    notification_priority: "push",
    router_classification: "match_existing",
    router_reason: "portal reply",
    is_engaged: true,
    engagement_signals: [{ type: "portal_reply", at: now }],
    import_source: "live",
    has_attachments: false,
    has_calendar_invite: false,
    graph_message_id: null,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await updateThreadTimestamps(threadId, "inbound", now);

  void logActivity({
    contactId: session.contactId,
    companyId: contact?.company_id ?? null,
    kind: "portal_chat_message_sent",
    body: `Portal reply sent (${trimmed.length} chars)`,
    meta: { thread_id: threadId, message_id: messageId },
  });

  return {
    ok: true,
    message: {
      id: messageId,
      direction: "inbound",
      bodyText: trimmed,
      sentAtMs: now,
      receivedAtMs: now,
      hasAttachments: false,
    },
  };
}

export async function startPortalThread(
  subject: string,
  body: string,
): Promise<{ ok: true; thread: PortalThread } | { ok: false; error: string }> {
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) return { ok: false, error: "Message is empty." };
  if (trimmedBody.length > MAX_BODY_LENGTH)
    return { ok: false, error: "Message is too long." };
  if (trimmedSubject.length === 0)
    return { ok: false, error: "Subject is required." };

  const session = await getPortalSession();
  if (!session) return { ok: false, error: "Session expired." };

  const [contact] = await db
    .select({ email: contacts.email, company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  const now = Date.now();
  const threadId = randomUUID();
  const messageId = randomUUID();

  const threadRow: ThreadInsert = {
    id: threadId,
    contact_id: session.contactId,
    company_id: contact?.company_id ?? null,
    channel_of_origin: "portal_chat",
    sending_address: contact?.email ?? session.contactId,
    subject: trimmedSubject,
    priority_class: "signal",
    keep_until_ms: null,
    keep_pinned: false,
    last_message_at_ms: now,
    last_inbound_at_ms: now,
    last_outbound_at_ms: null,
    has_cached_draft: false,
    cached_draft_body: null,
    cached_draft_generated_at_ms: null,
    cached_draft_stale: false,
    snoozed_until_ms: null,
    created_at_ms: now,
    updated_at_ms: now,
  };

  await db.insert(threads).values(threadRow);

  await db.insert(messages).values({
    id: messageId,
    thread_id: threadId,
    direction: "inbound",
    channel: "portal_chat",
    from_address: contact?.email ?? session.contactId,
    to_addresses: ["andy@superbadmedia.com.au"],
    subject: trimmedSubject,
    body_text: trimmedBody,
    body_html: null,
    headers: {},
    message_id_header: null,
    in_reply_to_header: null,
    references_header: null,
    sent_at_ms: now,
    received_at_ms: now,
    priority_class: "signal",
    noise_subclass: null,
    notification_priority: "push",
    router_classification: "new_lead",
    router_reason: "portal new thread",
    is_engaged: true,
    engagement_signals: [{ type: "portal_new_thread", at: now }],
    import_source: "live",
    has_attachments: false,
    has_calendar_invite: false,
    graph_message_id: null,
    created_at_ms: now,
    updated_at_ms: now,
  });

  void logActivity({
    contactId: session.contactId,
    companyId: contact?.company_id ?? null,
    kind: "portal_chat_message_sent",
    body: `Portal thread started: ${trimmedSubject}`,
    meta: { thread_id: threadId, message_id: messageId },
  });

  return {
    ok: true,
    thread: {
      id: threadId,
      subject: trimmedSubject,
      channel: "portal_chat",
      lastMessageAtMs: now,
      ticketStatus: null,
      messages: [
        {
          id: messageId,
          direction: "inbound",
          bodyText: trimmedBody,
          sentAtMs: now,
          receivedAtMs: now,
          hasAttachments: false,
        },
      ],
    },
  };
}
