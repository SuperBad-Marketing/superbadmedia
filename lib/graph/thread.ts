import { eq, and, gte, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, threads, type ThreadInsert } from "@/lib/db/schema/messages";
import type { NormalizedMessage } from "./normalize";
import { randomUUID } from "node:crypto";

function normalizeSubject(subject: string | null): string {
  if (!subject) return "";
  let s = subject.trim();
  while (/^(re|fwd|fw)\s*:\s*/i.test(s)) {
    s = s.replace(/^(re|fwd|fw)\s*:\s*/i, "").trim();
  }
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function resolveThread(
  msg: NormalizedMessage,
  sendingAddress: string | null,
): Promise<string> {
  if (msg.inReplyTo) {
    const [match] = await db
      .select({ threadId: messages.thread_id })
      .from(messages)
      .where(eq(messages.message_id_header, msg.inReplyTo))
      .limit(1);
    if (match) return match.threadId;
  }

  if (msg.referencesHeader) {
    const refIds = msg.referencesHeader.split(/\s+/).filter(Boolean);
    for (const refId of refIds.reverse()) {
      const [match] = await db
        .select({ threadId: messages.thread_id })
        .from(messages)
        .where(eq(messages.message_id_header, refId))
        .limit(1);
      if (match) return match.threadId;
    }
  }

  if (msg.subject && msg.from_address) {
    const normalized = normalizeSubject(msg.subject);
    if (normalized.length > 0) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const candidates = await db
        .select({ id: messages.id, threadId: messages.thread_id, subject: messages.subject })
        .from(messages)
        .where(
          and(
            eq(messages.from_address, msg.from_address),
            gte(messages.created_at_ms, thirtyDaysAgo),
          ),
        )
        .limit(50);

      for (const c of candidates) {
        if (normalizeSubject(c.subject) === normalized) {
          return c.threadId;
        }
      }
    }
  }

  const threadId = randomUUID();
  const now = Date.now();
  const newThread: ThreadInsert = {
    id: threadId,
    contact_id: null,
    company_id: null,
    channel_of_origin: "email",
    sending_address: sendingAddress,
    subject: msg.subject,
    priority_class: "signal",
    keep_until_ms: null,
    keep_pinned: false,
    last_message_at_ms: msg.received_at_ms ?? now,
    last_inbound_at_ms: msg.direction === "inbound" ? (msg.received_at_ms ?? now) : null,
    last_outbound_at_ms: msg.direction === "outbound" ? (msg.sent_at_ms ?? now) : null,
    has_cached_draft: false,
    cached_draft_body: null,
    cached_draft_generated_at_ms: null,
    cached_draft_stale: false,
    snoozed_until_ms: null,
    created_at_ms: now,
    updated_at_ms: now,
  };

  await db.insert(threads).values(newThread);
  return threadId;
}

export async function updateThreadTimestamps(
  threadId: string,
  direction: "inbound" | "outbound",
  timestampMs: number,
): Promise<void> {
  const now = Date.now();
  const update: Record<string, unknown> = {
    last_message_at_ms: timestampMs,
    updated_at_ms: now,
  };

  if (direction === "inbound") {
    update.last_inbound_at_ms = timestampMs;
    update.cached_draft_stale = true;
  } else {
    update.last_outbound_at_ms = timestampMs;
  }

  await db
    .update(threads)
    .set(update)
    .where(eq(threads.id, threadId));
}
