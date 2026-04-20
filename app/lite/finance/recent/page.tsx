import { redirect } from "next/navigation";
import { desc, eq, and, gte, lte, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { expenses, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/db/schema/expenses";
import { invoices } from "@/lib/db/schema/invoices";
import { companies } from "@/lib/db/schema/companies";

export const metadata: Metadata = {
  title: "SuperBad — Recent Transactions",
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
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface TransactionRow {
  id: string;
  date: string;
  type: "income" | "expense";
  description: string;
  counterparty: string;
  amount_cents: number;
  link: string;
}

export default async function RecentTransactionsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [recentExpenses, recentInvoices] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(gte(expenses.expense_date, thirtyDaysAgo))
      .orderBy(desc(expenses.expense_date))
      .limit(50),
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoice_number,
        companyId: invoices.company_id,
        companyName: companies.name,
        totalCents: invoices.total_cents_inc_gst,
        paidAtMs: invoices.paid_at_ms,
      })
      .from(invoices)
      .leftJoin(companies, eq(companies.id, invoices.company_id))
      .where(
        and(
          eq(invoices.status, "paid"),
          gte(
            invoices.paid_at_ms,
            new Date(thirtyDaysAgo).getTime(),
          ),
        ),
      )
      .orderBy(desc(invoices.paid_at_ms))
      .limit(50),
  ]);

  const transactions: TransactionRow[] = [];

  for (const inv of recentInvoices) {
    const date = inv.paidAtMs
      ? new Date(inv.paidAtMs).toISOString().slice(0, 10)
      : todayStr;
    transactions.push({
      id: `inv-${inv.id}`,
      date,
      type: "income",
      description: `Invoice ${inv.invoiceNumber}`,
      counterparty: inv.companyName ?? "Unknown",
      amount_cents: inv.totalCents,
      link: `/lite/invoices/${inv.id}`,
    });
  }

  for (const exp of recentExpenses) {
    transactions.push({
      id: `exp-${exp.id}`,
      date: exp.expense_date,
      type: "expense",
      description:
        exp.description ||
        EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] ||
        exp.category,
      counterparty: exp.vendor,
      amount_cents: exp.amount_inc_gst,
      link: `/lite/finance/expenses`,
    });
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date));

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
          Recent Transactions
        </h1>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
          Last 30 days · {transactions.length} entries
        </p>
      </header>

      <div className="px-4 pb-10">
        {transactions.length === 0 ? (
          <div className="py-12 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            No transactions in the last 30 days.
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-[12px]"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            {transactions.map((tx, i) => (
              <Link
                key={tx.id}
                href={tx.link}
                className="flex items-center justify-between px-5 py-3 transition-colors duration-[180ms] hover:bg-[rgba(253,245,230,0.02)]"
                style={{
                  borderBottom:
                    i < transactions.length - 1
                      ? "1px solid rgba(253, 245, 230, 0.05)"
                      : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      tx.type === "income"
                        ? "bg-[color:var(--color-semantic-success)]"
                        : "bg-[color:var(--color-neutral-500)]"
                    }`}
                  />
                  <div>
                    <div className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)]">
                      {tx.counterparty}
                    </div>
                    <div className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                      {tx.description}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-[family-name:var(--font-body)] text-[13px] tabular-nums ${
                      tx.type === "income"
                        ? "text-[color:var(--color-semantic-success)]"
                        : "text-[color:var(--color-neutral-400)]"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "−"}
                    {formatAud(tx.amount_cents)}
                  </div>
                  <div className="font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]">
                    {formatDate(tx.date)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
