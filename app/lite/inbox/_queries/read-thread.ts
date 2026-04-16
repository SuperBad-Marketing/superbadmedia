import "server-only";
import { asc, eq, isNull, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { threads, messages, type ThreadRow, type MessageRow } from "@/lib/db/schema/messages";
import { contacts, type ContactRow } from "@/lib/db/schema/contacts";
import { companies, type CompanyRow } from "@/lib/db/schema/companies";

/**
 * Thread-detail loader for `/lite/inbox/[threadId]`. Returns everything
 * the right-column renderer needs in one round-trip: the thread, its
 * ordered messages (soft-deleted excluded), and enough contact/company
 * context to label the header.
 *
 * Attachments + calendar-invite parsing are deferred to UI-10; for
 * UI-8 we surface only the `has_attachments` / `has_calendar_invite`
 * flags that already live on `messages`.
 */
export type ReadThreadResult = {
  thread: ThreadRow;
  messages: MessageRow[];
  contact: ContactRow | null;
  company: CompanyRow | null;
} | null;

export async function readThread(threadId: string): Promise<ReadThreadResult> {
  const [threadRow] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!threadRow) return null;

  const messageRows = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.thread_id, threadId), isNull(messages.deleted_at_ms)),
    )
    .orderBy(asc(messages.created_at_ms));

  let contactRow: ContactRow | null = null;
  if (threadRow.contact_id) {
    const [c] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, threadRow.contact_id))
      .limit(1);
    contactRow = c ?? null;
  }

  let companyRow: CompanyRow | null = null;
  if (threadRow.company_id) {
    const [c] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, threadRow.company_id))
      .limit(1);
    companyRow = c ?? null;
  }

  return {
    thread: threadRow,
    messages: messageRows,
    contact: contactRow,
    company: companyRow,
  };
}
