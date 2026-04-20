import { redirect } from "next/navigation";
import { desc, eq, and, count } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { EmptyState } from "@/components/lite/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FinanceDashboardClient,
} from "@/components/lite/finance/finance-dashboard-client";

export const metadata: Metadata = {
  title: "SuperBad — Finance",
  robots: { index: false, follow: false },
};

async function hasStripeAdmin(): Promise<boolean> {
  const rows = await db
    .select({ id: integration_connections.id })
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, "stripe"),
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
  pendingReviewCount,
  expenseCount,
}: {
  pendingReviewCount: number;
  expenseCount: number;
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
      <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
        Where the money lives.{" "}
        <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
          {expenseCount === 0
            ? "nothing recorded yet."
            : pendingReviewCount > 0
              ? `${pendingReviewCount} pending review.`
              : "all confirmed. nice."}
        </em>
      </p>
      <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        <a
          href="/lite/finance/recurring"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-150 hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Recurring expenses →
        </a>
      </div>
    </header>
  );
}

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const stripeConnected = await hasStripeAdmin();

  const recentExpenses = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.expense_date), desc(expenses.created_at_ms))
    .limit(50);

  const pendingRows = await db
    .select({ total: count() })
    .from(expenses)
    .where(eq(expenses.status, "pending_review"));
  const pendingReviewCount = pendingRows[0]?.total ?? 0;

  const vendorSuggestions = await getVendorSuggestions();

  const hasAnyData = recentExpenses.length > 0;

  if (!stripeConnected && !hasAnyData) {
    return (
      <div>
        <FinanceHeader pendingReviewCount={0} expenseCount={0} />
        <div className="px-4 pb-10">
          <EmptyState
            hero="FINANCE"
            message="Connect Stripe to start seeing revenue. Or add your first expense below."
          >
            <div className="flex gap-3">
              <a
                href="/lite/setup/admin/stripe"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Connect Stripe
              </a>
            </div>
          </EmptyState>
          <FinanceDashboardClient
            expenses={[]}
            vendorSuggestions={vendorSuggestions}
            pendingReviewCount={0}
            hasStripeConnection={false}
          />
        </div>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div>
        <FinanceHeader pendingReviewCount={0} expenseCount={0} />
        <div className="px-4 pb-10">
          <EmptyState
            hero="FINANCE"
            message="No revenue yet. Come back when an invoice is paid."
          />
          <FinanceDashboardClient
            expenses={[]}
            vendorSuggestions={vendorSuggestions}
            pendingReviewCount={0}
            hasStripeConnection={stripeConnected}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <FinanceHeader
        pendingReviewCount={pendingReviewCount}
        expenseCount={recentExpenses.length}
      />
      <div className="px-4 pb-10">
        <FinanceDashboardClient
          expenses={recentExpenses}
          vendorSuggestions={vendorSuggestions}
          pendingReviewCount={pendingReviewCount}
          hasStripeConnection={stripeConnected}
        />
      </div>
    </div>
  );
}
