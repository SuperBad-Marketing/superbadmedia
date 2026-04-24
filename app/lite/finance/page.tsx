import { redirect } from "next/navigation";
import { eq, and, count } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { EmptyState } from "@/components/lite/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/lib/finance/dashboard-data";
import { FinanceFullDashboard } from "@/components/lite/finance/finance-full-dashboard";

export const metadata: Metadata = {
  title: "SuperBad — Finance",
  robots: { index: false, follow: false },
};

type RangePreset = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_fy" | "last_fy";

const RANGE_LABELS: Record<RangePreset, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  this_quarter: "This Quarter",
  last_quarter: "Last Quarter",
  this_fy: "This FY",
  last_fy: "Last FY",
};

function computeRange(preset: RangePreset): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case "this_month": {
      const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const end = now.toISOString().slice(0, 10);
      return { start, end };
    }
    case "last_month": {
      const prevMonth = m === 0 ? 11 : m - 1;
      const prevYear = m === 0 ? y - 1 : y;
      const start = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(prevYear, prevMonth + 1, 0);
      return { start, end: lastDay.toISOString().slice(0, 10) };
    }
    case "this_quarter": {
      const qStart = Math.floor(m / 3) * 3;
      const start = `${y}-${String(qStart + 1).padStart(2, "0")}-01`;
      return { start, end: now.toISOString().slice(0, 10) };
    }
    case "last_quarter": {
      const qStart = Math.floor(m / 3) * 3;
      const prevQStart = qStart - 3 < 0 ? qStart + 9 : qStart - 3;
      const prevQYear = qStart - 3 < 0 ? y - 1 : y;
      const start = `${prevQYear}-${String(prevQStart + 1).padStart(2, "0")}-01`;
      const endDate = new Date(prevQYear, prevQStart + 3, 0);
      return { start, end: endDate.toISOString().slice(0, 10) };
    }
    case "this_fy": {
      const fyStartYear = m >= 6 ? y : y - 1;
      return { start: `${fyStartYear}-07-01`, end: now.toISOString().slice(0, 10) };
    }
    case "last_fy": {
      const fyStartYear = m >= 6 ? y - 1 : y - 2;
      return { start: `${fyStartYear}-07-01`, end: `${fyStartYear + 1}-06-30` };
    }
  }
}

async function hasStripeAdmin(): Promise<boolean> {
  const rows = await db
    .select({ id: integration_connections.id })
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, "stripe-admin"),
        eq(integration_connections.owner_type, "admin"),
        eq(integration_connections.status, "active"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function getVendorSuggestions(): Promise<string[]> {
  const rows = await db
    .select({ vendor: expenses.vendor })
    .from(expenses)
    .groupBy(expenses.vendor)
    .orderBy(expenses.vendor);
  return rows.map((r) => r.vendor);
}

function FinanceHeader({
  rangePreset,
  pendingReviewCount,
}: {
  rangePreset: RangePreset;
  pendingReviewCount: number;
}) {
  return (
    <header className="px-4 pt-6 pb-5">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Admin · Finance
      </div>
      <h1
        className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.4px" }}
      >
        Finance
      </h1>

      {/* Range picker + Export */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(RANGE_LABELS) as [RangePreset, string][]).map(
            ([key, label]) => (
              <Link
                key={key}
                href={`/lite/finance?range=${key}`}
                className={cn(
                  "rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors duration-150",
                  rangePreset === key
                    ? "bg-[color:var(--color-brand-cream)] text-[color:var(--color-neutral-900)]"
                    : "text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]",
                )}
                style={{ letterSpacing: "1.5px" }}
              >
                {label}
              </Link>
            ),
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/lite/finance/recurring"
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-150 hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Recurring →
          </Link>
          <Link
            href="/lite/finance/expenses"
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-150 hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.5px" }}
          >
            All expenses →
          </Link>
          <Link
            href="/lite/finance/export"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Export
          </Link>
        </div>
      </div>
    </header>
  );
}

export default async function FinancePage(props: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const searchParams = await props.searchParams;
  const rangePreset = (
    Object.keys(RANGE_LABELS).includes(searchParams.range ?? "")
      ? searchParams.range
      : "this_month"
  ) as RangePreset;
  const { start, end } = computeRange(rangePreset);

  const [stripeConnected, vendorSuggestions, pendingRows, hasAnyExpenses] =
    await Promise.all([
      hasStripeAdmin(),
      getVendorSuggestions(),
      db
        .select({ total: count() })
        .from(expenses)
        .where(eq(expenses.status, "pending_review")),
      db
        .select({ total: count() })
        .from(expenses),
    ]);

  const pendingReviewCount = pendingRows[0]?.total ?? 0;
  const expenseCount = hasAnyExpenses[0]?.total ?? 0;

  if (!stripeConnected && expenseCount === 0) {
    return (
      <div>
        <FinanceHeader rangePreset={rangePreset} pendingReviewCount={0} />
        <div className="px-4 pb-10">
          <EmptyState
            hero="FINANCE"
            message="Connect Stripe to start seeing revenue. Or add your first expense below."
          >
            <div className="flex gap-3">
              <a
                href="/lite/setup/critical-flight/stripe-admin"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Connect Stripe
              </a>
            </div>
          </EmptyState>
        </div>
      </div>
    );
  }

  const dashboardData = await getDashboardData(start, end);

  return (
    <div>
      <FinanceHeader
        rangePreset={rangePreset}
        pendingReviewCount={pendingReviewCount}
      />
      <div className="px-4 pb-10">
        <FinanceFullDashboard
          data={dashboardData}
          vendorSuggestions={vendorSuggestions}
          pendingReviewCount={pendingReviewCount}
          rangeLabel={RANGE_LABELS[rangePreset]}
        />
      </div>
    </div>
  );
}
