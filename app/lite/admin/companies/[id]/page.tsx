/**
 * /lite/admin/companies/[id] — Company admin view.
 * Spec: docs/specs/sales-pipeline.md §9 (Trial Shoot) + branded-invoicing §4.2 (Billing).
 */
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { invoices, type InvoiceStatus } from "@/lib/db/schema/invoices";
import { loadInvoiceDetail } from "@/lib/invoicing/detail-query";
import { cn } from "@/lib/utils";

import { TrialShootPanel } from "@/components/lite/company/trial-shoot-panel";
import { BillingTab } from "@/components/lite/invoices/billing-tab";
import type { InvoiceIndexRow } from "@/components/lite/invoices/invoice-index-client";

export const metadata: Metadata = {
  title: "SuperBad — Company",
  robots: { index: false, follow: false },
};

type Tab = "trial-shoot" | "billing";

function parseTab(raw: string | undefined): Tab {
  return raw === "billing" ? "billing" : "trial-shoot";
}

function bankDetailsFromEnv() {
  return {
    account_name: process.env.SUPERBAD_BANK_ACCOUNT_NAME ?? "To be confirmed",
    bsb: process.env.SUPERBAD_BANK_BSB ?? "To be confirmed",
    account_number:
      process.env.SUPERBAD_BANK_ACCOUNT_NUMBER ?? "To be confirmed",
  };
}

export default async function CompanyAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; invoice?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const sp = await searchParams;
  const activeTab = parseTab(sp.tab);

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .get();
  if (!company) notFound();

  let billingRows: InvoiceIndexRow[] = [];
  let focusedDetail = null;
  if (activeTab === "billing") {
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
      })
      .from(invoices)
      .where(eq(invoices.company_id, id))
      .orderBy(desc(invoices.issue_date_ms));
    billingRows = rows.map((r) => ({
      ...r,
      status: r.status as InvoiceStatus,
      company_name: company.name,
    }));
    if (sp.invoice) {
      focusedDetail = await loadInvoiceDetail(sp.invoice);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "trial-shoot", label: "Trial Shoot" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-6">
      <div className="mb-6 space-y-2">
        <Link
          href="/lite/admin/pipeline"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Pipeline
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[company.shape, company.domain].filter(Boolean).join(" · ") ||
              "No shape or domain recorded."}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Company sections"
        className="mb-6 flex gap-1 border-b border-border"
      >
        {tabs.map((t) => {
          const active = t.id === activeTab;
          const href =
            t.id === "trial-shoot"
              ? `/lite/admin/companies/${id}`
              : `/lite/admin/companies/${id}?tab=billing`;
          return (
            <Link
              key={t.id}
              href={href}
              role="tab"
              aria-selected={active}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {activeTab === "trial-shoot" && (
        <TrialShootPanel
          companyId={company.id}
          initialStatus={company.trial_shoot_status}
          initialPlan={company.trial_shoot_plan}
          completedAtMs={company.trial_shoot_completed_at_ms}
          feedback={company.trial_shoot_feedback}
        />
      )}

      {activeTab === "billing" && (
        <BillingTab
          companyId={company.id}
          companyName={company.name}
          paymentTermsDays={company.payment_terms_days}
          bankDetails={bankDetailsFromEnv()}
          rows={billingRows}
          focusedInvoiceId={sp.invoice ?? null}
          focusedDetail={focusedDetail}
        />
      )}
    </main>
  );
}
