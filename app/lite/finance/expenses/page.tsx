import { redirect } from "next/navigation";
import { desc, eq, and, gte, lte, count } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  expenses,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  EXPENSE_SOURCES,
  type ExpenseSource,
} from "@/lib/db/schema/expenses";
import { FinanceDashboardClient } from "@/components/lite/finance/finance-dashboard-client";

export const metadata: Metadata = {
  title: "SuperBad — Expenses",
  robots: { index: false, follow: false },
};

async function getVendorSuggestions(): Promise<string[]> {
  const rows = await db
    .select({ vendor: expenses.vendor })
    .from(expenses)
    .groupBy(expenses.vendor)
    .orderBy(expenses.vendor);
  return rows.map((r) => r.vendor);
}

export default async function ExpensesPage(props: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    source?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const searchParams = await props.searchParams;

  const conditions = [];
  if (searchParams.status === "pending_review") {
    conditions.push(eq(expenses.status, "pending_review"));
  }
  if (searchParams.category && EXPENSE_CATEGORIES.includes(searchParams.category as ExpenseCategory)) {
    conditions.push(eq(expenses.category, searchParams.category as ExpenseCategory));
  }
  if (searchParams.source && EXPENSE_SOURCES.includes(searchParams.source as ExpenseSource)) {
    conditions.push(eq(expenses.source, searchParams.source as ExpenseSource));
  }

  const allExpenses = await db
    .select()
    .from(expenses)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(expenses.expense_date), desc(expenses.created_at_ms))
    .limit(200);

  const pendingRows = await db
    .select({ total: count() })
    .from(expenses)
    .where(eq(expenses.status, "pending_review"));
  const pendingReviewCount = pendingRows[0]?.total ?? 0;

  const vendorSuggestions = await getVendorSuggestions();
  const hasStripe = true;

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
          Expenses
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "All", href: "/lite/finance/expenses" },
            {
              label: "Pending review",
              href: "/lite/finance/expenses?status=pending_review",
            },
          ].map((f) => (
            <Link
              key={f.label}
              href={f.href}
              className="rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="px-4 pb-10">
        <FinanceDashboardClient
          expenses={allExpenses}
          vendorSuggestions={vendorSuggestions}
          pendingReviewCount={pendingReviewCount}
          hasStripeConnection={hasStripe}
        />
      </div>
    </div>
  );
}
