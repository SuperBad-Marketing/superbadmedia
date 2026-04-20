import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { messages } from "@/lib/db/schema/messages";
import { threads } from "@/lib/db/schema/messages";
import { action_items } from "@/lib/db/schema/action-items";
import { context_summaries } from "@/lib/db/schema/context-summaries";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { computeHealthScore, type HealthLabel } from "./health";

export interface SignalSet {
  health_label: HealthLabel;
  days_since_last_contact: number;
  overdue_action_items_you: number;
  overdue_action_items_them: number;
  total_open_action_items: number;
  has_unsent_draft: boolean;
  last_contact_direction: "inbound" | "outbound" | null;
  deal_stage: string | null;
  outstanding_invoice: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getSignalsForContact(
  contactId: string,
): Promise<SignalSet> {
  const now = Date.now();

  const [health, lastMsg, actionItemRows, summaryRow, deal] =
    await Promise.all([
      computeHealthScore(contactId),

      db
        .select({
          direction: messages.direction,
          createdAtMs: messages.created_at_ms,
        })
        .from(messages)
        .innerJoin(threads, eq(messages.thread_id, threads.id))
        .where(eq(threads.contact_id, contactId))
        .orderBy(desc(messages.created_at_ms))
        .limit(1)
        .get(),

      db
        .select({
          owner: action_items.owner,
          status: action_items.status,
          dueDateMs: action_items.due_date_ms,
        })
        .from(action_items)
        .where(
          and(
            eq(action_items.contact_id, contactId),
            eq(action_items.status, "open"),
          ),
        ),

      db
        .select({
          draftContent: context_summaries.draft_content,
        })
        .from(context_summaries)
        .where(eq(context_summaries.contact_id, contactId))
        .get(),

      db
        .select({ stage: deals.stage, id: deals.id })
        .from(deals)
        .where(eq(deals.primary_contact_id, contactId))
        .orderBy(desc(deals.updated_at_ms))
        .get(),
    ]);

  const overdueYou = actionItemRows.filter(
    (i) => i.owner === "you" && i.dueDateMs != null && i.dueDateMs < now,
  ).length;

  const overdueThem = actionItemRows.filter(
    (i) => i.owner === "them" && i.dueDateMs != null && i.dueDateMs < now,
  ).length;

  const hasOutstandingInvoice = deal
    ? (
        await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(
            and(
              eq(invoices.deal_id, deal.id),
              eq(invoices.status, "overdue"),
            ),
          )
          .limit(1)
          .get()
      ) != null
    : false;

  const daysSinceContact = lastMsg
    ? (now - lastMsg.createdAtMs) / MS_PER_DAY
    : Infinity;

  return {
    health_label: health.label,
    days_since_last_contact: Math.round(daysSinceContact * 10) / 10,
    overdue_action_items_you: overdueYou,
    overdue_action_items_them: overdueThem,
    total_open_action_items: actionItemRows.length,
    has_unsent_draft: summaryRow?.draftContent != null,
    last_contact_direction: lastMsg
      ? (lastMsg.direction as "inbound" | "outbound")
      : null,
    deal_stage: deal?.stage ?? null,
    outstanding_invoice: hasOutstandingInvoice,
  };
}

export async function getSignalsForAllContacts(): Promise<
  Map<string, SignalSet>
> {
  const allContacts = await db
    .select({ id: contacts.id })
    .from(contacts);

  const results = new Map<string, SignalSet>();

  for (const contact of allContacts) {
    const signals = await getSignalsForContact(contact.id);
    results.set(contact.id, signals);
  }

  return results;
}
