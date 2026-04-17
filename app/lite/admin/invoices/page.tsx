/**
 * /lite/admin/invoices — invoice admin index.
 * Spec: docs/specs/branded-invoicing.md §4.1 + §4.3.
 * Visual rebuild: sessions/admin-polish-3-brief.md against mockup-admin-interior.html.
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

function formatCentsCompact(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
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

  // eslint-disable-next-line react-hooks/purity -- server component, runs once
  const now = Date.now();
  const summary: InvoiceIndexSummary = computeInvoiceSummary(indexRows, now);
  const overdueCount = indexRows.filter((r) => r.status === "overdue").length;
  const isEmpty = indexRows.length === 0;

  const focusedDetail = focusedInvoiceId
    ? await loadInvoiceDetail(focusedInvoiceId)
    : null;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Invoices
        </div>
        <div className="mt-3">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Invoices
          </h1>
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Current and historical.
          {isEmpty ? null : (
            <>
              {" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                {summary.outstanding_cents > 0
                  ? "the float's running dry."
                  : "books are breathing."}
              </em>
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {indexRows.length}
          </span>
          <span>invoice{indexRows.length === 1 ? "" : "s"}</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">
            ·
          </span>
          <span>AUD · incl. GST</span>
          {overdueCount > 0 ? (
            <>
              <span
                aria-hidden
                className="text-[color:var(--color-neutral-700)]"
              >
                ·
              </span>
              <span
                className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-brand-orange)]"
                style={{ letterSpacing: "1.5px" }}
              >
                {overdueCount} overdue
              </span>
            </>
          ) : null}
        </div>
      </header>

      {overdueCount > 0 ? (
        <section aria-label="Overdue alert" className="px-4 pb-4">
          <div
            role="status"
            className="flex flex-col gap-1 rounded-[10px] px-4 py-[14px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))",
              border: "1px solid rgba(178, 40, 72, 0.25)",
            }}
          >
            <div
              className="font-[family-name:var(--font-label)] uppercase text-[10px] text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "1.5px" }}
            >
              Overdue · attention
            </div>
            <div className="text-[14px] text-[color:var(--color-neutral-300)]">
              {overdueCount} invoice{overdueCount === 1 ? "" : "s"} past due —{" "}
              <span
                className="font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "0.5px" }}
              >
                {formatCentsCompact(summary.overdue_cents)}
              </span>{" "}
              outstanding.
            </div>
            <div className="text-[12px] italic text-[color:var(--color-brand-pink)]">
              reminders ride on cron — you don&apos;t need to chase manually.
            </div>
          </div>
        </section>
      ) : null}

      <InvoiceIndexClient
        rows={indexRows}
        summary={summary}
        initialFilter={filter}
        initialFocusedId={focusedInvoiceId}
        initialDetail={focusedDetail}
      />
    </div>
  );
}
