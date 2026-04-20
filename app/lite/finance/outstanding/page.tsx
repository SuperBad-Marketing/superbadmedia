import { redirect } from "next/navigation";
import { inArray, desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema/invoices";
import { companies } from "@/lib/db/schema/companies";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "SuperBad — Outstanding Invoices",
  robots: { index: false, follow: false },
};

function formatAud(cents: number): string {
  return (cents / 100).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function OutstandingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoice_number,
      companyId: invoices.company_id,
      companyName: companies.name,
      totalCents: invoices.total_cents_inc_gst,
      status: invoices.status,
      dueAtMs: invoices.due_at_ms,
      issueDateMs: invoices.issue_date_ms,
    })
    .from(invoices)
    .leftJoin(companies, eq(companies.id, invoices.company_id))
    .where(inArray(invoices.status, ["sent", "overdue"]))
    .orderBy(desc(invoices.due_at_ms));

  const totalOutstanding = rows.reduce((s, r) => s + r.totalCents, 0);
  const overdueCount = rows.filter((r) => r.status === "overdue").length;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <Link
          href="/lite/finance"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          ← Finance
        </Link>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Outstanding Invoices
        </h1>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
          {formatAud(totalOutstanding)} across {rows.length} invoice
          {rows.length !== 1 ? "s" : ""}
          {overdueCount > 0
            ? ` · ${overdueCount} overdue`
            : ""}
        </p>
      </header>

      <div className="px-4 pb-10">
        {rows.length === 0 ? (
          <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            Nothing outstanding. Clean slate.
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-[12px]"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            {rows.map((row, i) => (
              <Link
                key={row.id}
                href={`/lite/invoices/${row.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors duration-[180ms] hover:bg-[rgba(253,245,230,0.02)]"
                style={{
                  borderBottom:
                    i < rows.length - 1
                      ? "1px solid rgba(253, 245, 230, 0.05)"
                      : undefined,
                }}
              >
                <div>
                  <div className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                    {row.companyName ?? "Unknown"}{" "}
                    <span className="text-[color:var(--color-neutral-500)]">
                      {row.invoiceNumber}
                    </span>
                  </div>
                  <div className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                    Due {formatDate(row.dueAtMs)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {row.status === "overdue" && (
                    <span className="rounded-sm bg-[color:var(--color-brand-red)]/15 px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-brand-red)]">
                      Overdue
                    </span>
                  )}
                  <span className="font-[family-name:var(--font-body)] text-[14px] tabular-nums font-medium text-[color:var(--color-brand-cream)]">
                    {formatAud(row.totalCents)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
