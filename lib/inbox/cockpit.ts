import { and, eq, lte, gte, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const MS_24H = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;

export async function getInboxWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const waitingThreads = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      contact_name: contacts.name,
      last_inbound_at_ms: threads.last_inbound_at_ms,
      ticket_status: threads.ticket_status,
      created_at_ms: threads.created_at_ms,
    })
    .from(threads)
    .leftJoin(contacts, eq(threads.contact_id, contacts.id))
    .where(
      and(
        eq(threads.priority_class, "signal"),
        isNotNull(threads.last_inbound_at_ms),
        sql`(${threads.last_outbound_at_ms} IS NULL OR ${threads.last_inbound_at_ms} > ${threads.last_outbound_at_ms})`,
        lte(threads.last_inbound_at_ms, nowMs - MS_24H),
        gte(threads.last_inbound_at_ms, nowMs - MS_7D),
      ),
    )
    .all();

  for (const t of waitingThreads) {
    const name = t.contact_name ?? t.subject ?? "Unknown";
    items.push({
      id: `inbox_reply_waiting_${t.id}`,
      label: `Reply waiting — ${name}`,
      href: `/lite/inbox/${t.id}`,
      urgency: { kind: "age_of_wait", value: t.last_inbound_at_ms! },
      scope: "own",
      source: "unified-inbox",
    });
  }

  const staleTickets = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      contact_name: contacts.name,
      created_at_ms: threads.created_at_ms,
    })
    .from(threads)
    .leftJoin(contacts, eq(threads.contact_id, contacts.id))
    .where(
      and(
        eq(threads.ticket_status, "open"),
        lte(threads.created_at_ms, nowMs - MS_48H),
        gte(threads.created_at_ms, nowMs - MS_7D),
      ),
    )
    .all();

  const replyWaitingIds = new Set(waitingThreads.map((t) => t.id));
  for (const t of staleTickets) {
    if (replyWaitingIds.has(t.id)) continue;
    const name = t.contact_name ?? t.subject ?? "Support ticket";
    items.push({
      id: `inbox_ticket_stale_${t.id}`,
      label: `Open ticket — ${name}`,
      href: `/lite/inbox/${t.id}`,
      urgency: { kind: "age_of_wait", value: t.created_at_ms },
      scope: "own",
      source: "unified-inbox",
    });
  }

  return items;
}
