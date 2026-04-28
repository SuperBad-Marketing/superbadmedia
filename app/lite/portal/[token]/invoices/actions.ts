"use server";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { invoices } from "@/lib/db/schema/invoices";
import { eq, and, ne, desc } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal/guard";
import type { InvoiceLineItem } from "@/lib/db/schema/invoices";

export type PortalInvoice = {
  id: string;
  invoiceNumber: string;
  token: string;
  status: "sent" | "overdue" | "paid" | "void";
  issueDateMs: number;
  dueAtMs: number;
  paidAtMs: number | null;
  totalCentsIncGst: number;
  gstCents: number;
  gstApplicable: boolean;
  lineItems: InvoiceLineItem[];
  scopeSummary: string | null;
};

export async function fetchPortalInvoices(): Promise<PortalInvoice[]> {
  const session = await getPortalSession();
  if (!session) throw new Error("No portal session");

  const [contact] = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  if (!contact?.company_id) return [];

  const rows = await db
    .select({
      id: invoices.id,
      invoice_number: invoices.invoice_number,
      token: invoices.token,
      status: invoices.status,
      issue_date_ms: invoices.issue_date_ms,
      due_at_ms: invoices.due_at_ms,
      paid_at_ms: invoices.paid_at_ms,
      total_cents_inc_gst: invoices.total_cents_inc_gst,
      gst_cents: invoices.gst_cents,
      gst_applicable: invoices.gst_applicable,
      line_items_json: invoices.line_items_json,
      scope_summary: invoices.scope_summary,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.company_id, contact.company_id),
        ne(invoices.status, "draft"),
      ),
    )
    .orderBy(desc(invoices.issue_date_ms))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    token: r.token,
    status: r.status as "sent" | "overdue" | "paid" | "void",
    issueDateMs: r.issue_date_ms,
    dueAtMs: r.due_at_ms,
    paidAtMs: r.paid_at_ms,
    totalCentsIncGst: r.total_cents_inc_gst,
    gstCents: r.gst_cents,
    gstApplicable: r.gst_applicable,
    lineItems: (r.line_items_json as InvoiceLineItem[]) ?? [],
    scopeSummary: r.scope_summary,
  }));
}
