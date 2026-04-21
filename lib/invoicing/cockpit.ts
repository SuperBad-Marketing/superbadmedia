import { and, eq, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema/invoices";
import { companies } from "@/lib/db/schema/companies";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const MS_PER_DAY = 86_400_000;

export async function getInvoiceWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const draftInvoices = await db
    .select({
      id: invoices.id,
      company_name: companies.name,
      created_at_ms: invoices.created_at_ms,
      auto_send_at_ms: invoices.auto_send_at_ms,
    })
    .from(invoices)
    .innerJoin(companies, eq(invoices.company_id, companies.id))
    .where(eq(invoices.status, "draft"))
    .all();

  for (const inv of draftInvoices) {
    if (inv.auto_send_at_ms && inv.auto_send_at_ms > nowMs) continue;

    items.push({
      id: `invoice_review_${inv.id}`,
      label: `${inv.company_name} invoice — review`,
      href: `/lite/invoices/${inv.id}`,
      urgency: inv.auto_send_at_ms
        ? { kind: "time_sensitive", value: inv.auto_send_at_ms }
        : { kind: "age_of_wait", value: inv.created_at_ms },
      scope: "own",
      source: "branded-invoicing",
    });
  }

  const overdueInvoices = await db
    .select({
      id: invoices.id,
      company_name: companies.name,
      due_at_ms: invoices.due_at_ms,
    })
    .from(invoices)
    .innerJoin(companies, eq(invoices.company_id, companies.id))
    .where(
      and(eq(invoices.status, "overdue"), lte(invoices.due_at_ms, nowMs)),
    )
    .all();

  for (const inv of overdueInvoices) {
    const daysOverdue = Math.floor((nowMs - inv.due_at_ms) / MS_PER_DAY);
    items.push({
      id: `invoice_overdue_${inv.id}`,
      label: `${inv.company_name} invoice — ${daysOverdue}d overdue`,
      href: `/lite/invoices/${inv.id}`,
      urgency: { kind: "time_sensitive", value: inv.due_at_ms },
      scope: "own",
      source: "branded-invoicing",
    });
  }

  return items;
}
