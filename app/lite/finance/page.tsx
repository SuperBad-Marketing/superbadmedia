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
      <div className="mx-auto max-w-4xl px-4 py-12">
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
    );
  }

  if (!hasAnyData) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
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
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <a
          href="/lite/finance/export"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Export
        </a>
      </div>

      <FinanceDashboardClient
        expenses={recentExpenses}
        vendorSuggestions={vendorSuggestions}
        pendingReviewCount={pendingReviewCount}
        hasStripeConnection={stripeConnected}
      />
    </div>
  );
}
