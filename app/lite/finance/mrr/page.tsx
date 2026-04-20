import { redirect } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";

export const metadata: Metadata = {
  title: "SuperBad — MRR Breakdown",
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

function monthlyValue(valueCents: number, cadence: string | null): number {
  switch (cadence) {
    case "annual_upfront":
    case "annual_monthly":
      return Math.round(valueCents / 12);
    default:
      return valueCents;
  }
}

export default async function MrrPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const rows = await db
    .select({
      dealId: deals.id,
      companyId: deals.company_id,
      companyName: companies.name,
      valueCents: deals.value_cents,
      billingCadence: deals.billing_cadence,
      wonOutcome: deals.won_outcome,
      committedUntilMs: deals.committed_until_date_ms,
      subscriptionState: deals.subscription_state,
    })
    .from(deals)
    .leftJoin(companies, eq(companies.id, deals.company_id))
    .where(
      and(
        eq(deals.stage, "won"),
        inArray(deals.subscription_state, ["active_current", "past_due"]),
      ),
    );

  const totalMrr = rows.reduce(
    (sum, r) => sum + monthlyValue(r.valueCents ?? 0, r.billingCadence),
    0,
  );

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
          MRR Breakdown
        </h1>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
          Total: {formatAud(totalMrr)}/mo across {rows.length} active{" "}
          {rows.length === 1 ? "deal" : "deals"}
        </p>
      </header>

      <div className="px-4 pb-10">
        {rows.length === 0 ? (
          <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            No active recurring revenue.
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
                key={row.dealId}
                href={`/lite/admin/pipeline/${row.dealId}`}
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
                    {row.companyName ?? "Unknown"}
                  </div>
                  <div className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                    {row.wonOutcome ?? "retainer"} ·{" "}
                    {row.billingCadence ?? "monthly"} ·{" "}
                    {row.subscriptionState === "past_due"
                      ? "past due"
                      : "active"}
                  </div>
                </div>
                <div className="text-right font-[family-name:var(--font-body)] text-[14px] tabular-nums font-medium text-[color:var(--color-semantic-success)]">
                  {formatAud(monthlyValue(row.valueCents ?? 0, row.billingCadence))}
                  /mo
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
