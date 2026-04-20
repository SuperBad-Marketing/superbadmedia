import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  expenses,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/db/schema/expenses";

export const metadata: Metadata = {
  title: "SuperBad — Expense Category",
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

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CategoryPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const params = await props.params;
  const slug = decodeURIComponent(params.slug);

  const categoryKey = EXPENSE_CATEGORIES.find(
    (c) =>
      c === slug ||
      c.replace(/_/g, "-") === slug.toLowerCase() ||
      c.replace(/[\s/]+/g, "-").toLowerCase() === slug.toLowerCase(),
  );

  if (!categoryKey) {
    return (
      <div className="px-4 pt-6 pb-10">
        <Link
          href="/lite/finance"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          ← Finance
        </Link>
        <p className="mt-6 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          Category not found.
        </p>
      </div>
    );
  }

  const rows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.category, categoryKey))
    .orderBy(desc(expenses.expense_date))
    .limit(100);

  const total = rows.reduce((s, r) => s + r.amount_inc_gst, 0);
  const label =
    EXPENSE_CATEGORY_LABELS[categoryKey as ExpenseCategory] ?? categoryKey;

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
          {label}
        </h1>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
          {formatAud(total)} across {rows.length} expense
          {rows.length !== 1 ? "s" : ""}
        </p>
      </header>

      <div className="px-4 pb-10">
        {rows.length === 0 ? (
          <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            No expenses in this category.
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
              <div
                key={row.id}
                className="flex items-center justify-between px-5 py-3 transition-colors duration-[180ms] hover:bg-[rgba(253,245,230,0.02)]"
                style={{
                  borderBottom:
                    i < rows.length - 1
                      ? "1px solid rgba(253, 245, 230, 0.05)"
                      : undefined,
                }}
              >
                <div>
                  <div className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                    {row.vendor}
                  </div>
                  <div className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                    {formatDate(row.expense_date)}
                    {row.description ? ` · ${row.description}` : ""}
                  </div>
                </div>
                <span className="font-[family-name:var(--font-body)] text-[13px] tabular-nums font-medium text-[color:var(--color-neutral-400)]">
                  {formatAud(row.amount_inc_gst)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
