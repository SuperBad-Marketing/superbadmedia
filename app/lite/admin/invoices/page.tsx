/**
 * /lite/admin/invoices — invoice admin index.
 * Spec: docs/specs/branded-invoicing.md §4.1 + §4.3.
 * Brief: sessions/bi-2a-brief.md.
 * Admin-only; non-admins redirect to sign-in.
 */
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { invoices, type InvoiceStatus } from "@/lib/db/schema/invoices";
import { companies } from "@/lib/db/schema/companies";
import {
  InvoiceIndexClient,
  type InvoiceIndexRow,
  type InvoiceIndexSummary,
  type InvoiceIndexFilter,
} from "@/components/lite/invoices/invoice-index-client";
import { computeInvoiceSummary } from "@/lib/invoicing/index-query";
import { loadInvoiceDetail } from "@/lib/invoicing/detail-query";

export const metadata: Metadata = {
  title: "SuperBad — Invoices",
  robots: { index: false, follow: false },
};

const FILTERS: InvoiceIndexFilter[] = [
  "all",
  "draft",
  "sent",
  "overdue",
  "paid",
  "void",
];

function parseFilter(raw: string | undefined): InvoiceIndexFilter {
  if (!raw) return "all";
  const lower = raw.toLowerCase() as InvoiceIndexFilter;
  return FILTERS.includes(lower) ? lower : "all";
}

export default async function InvoicesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; invoice?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const focusedInvoiceId = sp.invoice ?? null;

  const rows = await db
    .select({
      id: invoices.id,
      invoice_number: invoices.invoice_number,
      status: invoices.status,
      total_cents_inc_gst: invoices.total_cents_inc_gst,
      issue_date_ms: invoices.issue_date_ms,
      due_at_ms: invoices.due_at_ms,
      paid_at_ms: invoices.paid_at_ms,
      company_id: invoices.company_id,
      company_name: companies.name,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.company_id))
    .orderBy(desc(invoices.issue_date_ms));

  const indexRows: InvoiceIndexRow[] = rows.map((r) => ({
    id: r.id,
    invoice_number: r.invoice_number,
    status: r.status as InvoiceStatus,
    total_cents_inc_gst: r.total_cents_inc_gst,
    issue_date_ms: r.issue_date_ms,
    due_at_ms: r.due_at_ms,
    paid_at_ms: r.paid_at_ms,
    company_id: r.company_id,
    company_name: r.company_name,
  }));

  const summary: InvoiceIndexSummary = computeInvoiceSummary(
    indexRows,
    Date.now(),
  );

  const focusedDetail = focusedInvoiceId
    ? await loadInvoiceDetail(focusedInvoiceId)
    : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-heading text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {indexRows.length} invoice{indexRows.length === 1 ? "" : "s"} · current
          and historical.
        </p>
      </div>
      <InvoiceIndexClient
        rows={indexRows}
        summary={summary}
        initialFilter={filter}
        initialFocusedId={focusedInvoiceId}
        initialDetail={focusedDetail}
      />
    </main>
  );
}
