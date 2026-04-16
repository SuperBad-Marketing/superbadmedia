import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  threads,
  messages,
  type ThreadRow,
  type MessageRow,
} from "@/lib/db/schema/messages";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";

/**
 * Per-contact Conversation view loader (spec §4.2 + §8.2 + §8.3).
 *
 * §8.2 — threads stay separate records (no auto-merge). This helper is
 * the relationship-level read: one contact, all their threads, every
 * non-deleted message laid out chronologically within each thread.
 *
 * §8.3 — authoritative cross-channel SQL; this implementation joins on
 * `threads.contact_id` (indexed via `threads_contact_idx`) and reads
 * `messages` by `thread_id` (indexed via `messages_thread_idx`). The
 * Client Context Engine reuses the same shape.
 *
 * Returns `null` for an unknown contact id; returns `threads: []` when
 * the contact exists but has no non-soft-deleted messages anywhere.
 */
export type ConversationThread = {
  thread: ThreadRow;
  messages: MessageRow[];
};

export type ConversationPayload = {
  contact: ContactRow;
  company: CompanyRow | null;
  threads: ConversationThread[];
};

export async function listConversation(
  contactId: string,
): Promise<ConversationPayload | null> {
  const [contactRow] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contactRow) return null;

  let companyRow: CompanyRow | null = null;
  if (contactRow.company_id) {
    const [c] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, contactRow.company_id))
      .limit(1);
    companyRow = c ?? null;
  }

  const threadRows = await db
    .select()
    .from(threads)
    .where(eq(threads.contact_id, contactId))
    .orderBy(desc(threads.last_message_at_ms));

  if (threadRows.length === 0) {
    return { contact: contactRow, company: companyRow, threads: [] };
  }

  const threadIds = threadRows.map((t) => t.id);

  const messageRows = await db
    .select()
    .from(messages)
    .where(
      and(
        sql`${messages.thread_id} IN (${sql.join(
          threadIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        isNull(messages.deleted_at_ms),
      ),
    )
    .orderBy(asc(messages.created_at_ms));

  const byThread = new Map<string, MessageRow[]>();
  for (const msg of messageRows) {
    const bucket = byThread.get(msg.thread_id);
    if (bucket) {
      bucket.push(msg);
    } else {
      byThread.set(msg.thread_id, [msg]);
    }
  }

  const conversationThreads: ConversationThread[] = threadRows
    .map((t) => ({ thread: t, messages: byThread.get(t.id) ?? [] }))
    .filter((entry) => entry.messages.length > 0);

  return {
    contact: contactRow,
    company: companyRow,
    threads: conversationThreads,
  };
}
