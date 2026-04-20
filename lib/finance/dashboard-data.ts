import { desc, eq, and, gte, lte, sql, count, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { finance_snapshots, type FinanceMetrics, type FinanceProjection } from "@/lib/db/schema/finance-snapshots";
import { expenses, type ExpenseRow, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/db/schema/expenses";
import { invoices } from "@/lib/db/schema/invoices";
import { deals } from "@/lib/db/schema/deals";
import type { NarrativeOutput } from "./narrative-prompt";

export interface DashboardData {
  metrics: FinanceMetrics | null;
  projection: FinanceProjection | null;
  narrative: NarrativeOutput | null;
  narrativeStale: boolean;
  staleFlags: Record<string, boolean> | null;
  prevMetrics: FinanceMetrics | null;
  recentTransactions: TransactionRow[];
  outstandingInvoiceCount: number;
  overdueInvoiceCount: number;
  topExpenseCategories: Array<{ category: string; label: string; total_cents: number }>;
  mrrRunway: string | null;
}

export interface TransactionRow {
  id: string;
  date: string;
  type: "income" | "expense";
  description: string;
  counterparty: string;
  amount_cents: number;
  link: string;
}

export async function getDashboardData(
  rangeStart: string,
  rangeEnd: string,
): Promise<DashboardData> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [
    snapshotRows,
    prevSnapshotRows,
    recentExpenses,
    recentPaidInvoices,
    outstandingRows,
    overdueRows,
    topCategories,
    mrrDeals,
  ] = await Promise.all([
    db.select().from(finance_snapshots)
      .where(eq(finance_snapshots.snapshot_date, todayStr))
      .limit(1),
    db.select().from(finance_snapshots)
      .where(eq(finance_snapshots.snapshot_date, thirtyDaysAgo))
      .limit(1),
    db.select().from(expenses)
      .where(and(gte(expenses.expense_date, rangeStart), lte(expenses.expense_date, rangeEnd)))
      .orderBy(desc(expenses.expense_date))
      .limit(20),
    db.select({
      id: invoices.id,
      invoice_number: invoices.invoice_number,
      company_id: invoices.company_id,
      total_cents_inc_gst: invoices.total_cents_inc_gst,
      paid_at_ms: invoices.paid_at_ms,
    }).from(invoices)
      .where(and(
        eq(invoices.status, "paid"),
        gte(invoices.paid_at_ms, new Date(rangeStart).getTime()),
        lte(invoices.paid_at_ms, new Date(rangeEnd + "T23:59:59Z").getTime()),
      ))
      .orderBy(desc(invoices.paid_at_ms))
      .limit(20),
    db.select({ total: count() }).from(invoices)
      .where(inArray(invoices.status, ["sent", "overdue"])),
    db.select({ total: count() }).from(invoices)
      .where(eq(invoices.status, "overdue")),
    db.select({
      category: expenses.category,
      total: sql<number>`sum(${expenses.amount_inc_gst})`,
    }).from(expenses)
      .where(and(gte(expenses.expense_date, rangeStart), lte(expenses.expense_date, rangeEnd)))
      .groupBy(expenses.category)
      .orderBy(sql`sum(${expenses.amount_inc_gst}) desc`)
      .limit(5),
    db.select({
      value_cents: deals.value_cents,
      billing_cadence: deals.billing_cadence,
      committed_until_date_ms: deals.committed_until_date_ms,
    }).from(deals)
      .where(and(
        eq(deals.stage, "won"),
        inArray(deals.subscription_state, ["active_current", "past_due"]),
      )),
  ]);

  const snapshot = snapshotRows[0] ?? null;
  const metrics = snapshot?.metrics_json as unknown as FinanceMetrics | null;
  const projection = snapshot?.projection_json as unknown as FinanceProjection | null;
  const staleFlags = snapshot?.stale_flags as unknown as Record<string, boolean> | null;

  let narrative: NarrativeOutput | null = null;
  if (snapshot?.narrative_text) {
    try {
      narrative = JSON.parse(snapshot.narrative_text as string) as NarrativeOutput;
      if ((narrative as unknown as Record<string, boolean>)._fallback) {
        narrative = null;
      }
    } catch {
      narrative = null;
    }
  }

  const narrativeStale = snapshot
    ? !snapshot.narrative_generated_at_ms || (Date.now() - (snapshot.narrative_generated_at_ms ?? 0)) > 6 * 3_600_000
    : true;

  const prevSnapshot = prevSnapshotRows[0] ?? null;
  const prevMetrics = prevSnapshot?.metrics_json as unknown as FinanceMetrics | null;

  const transactions: TransactionRow[] = [];

  for (const inv of recentPaidInvoices) {
    const paidDate = inv.paid_at_ms ? new Date(inv.paid_at_ms).toISOString().slice(0, 10) : "";
    transactions.push({
      id: `inv-${inv.id}`,
      date: paidDate,
      type: "income",
      description: `Invoice ${inv.invoice_number}`,
      counterparty: inv.company_id,
      amount_cents: inv.total_cents_inc_gst,
      link: `/lite/invoices/${inv.id}`,
    });
  }

  for (const exp of recentExpenses) {
    transactions.push({
      id: `exp-${exp.id}`,
      date: exp.expense_date,
      type: "expense",
      description: exp.description || EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] || exp.category,
      counterparty: exp.vendor,
      amount_cents: exp.amount_inc_gst,
      link: `/lite/finance/expenses`,
    });
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date));
  const recentTransactions = transactions.slice(0, 20);

  const topExpenseCategories = topCategories.map((r) => ({
    category: r.category,
    label: EXPENSE_CATEGORY_LABELS[r.category as ExpenseCategory] ?? r.category,
    total_cents: Number(r.total ?? 0),
  }));

  let mrrRunway: string | null = null;
  if (mrrDeals.length > 0) {
    const latestCommitment = mrrDeals.reduce((latest, d) =>
      (d.committed_until_date_ms ?? 0) > (latest ?? 0) ? d.committed_until_date_ms : latest, 0 as number | null);
    if (latestCommitment && latestCommitment > Date.now()) {
      const d = new Date(latestCommitment);
      mrrRunway = d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
    }
  }

  return {
    metrics,
    projection,
    narrative,
    narrativeStale,
    staleFlags,
    prevMetrics,
    recentTransactions,
    outstandingInvoiceCount: outstandingRows[0]?.total ?? 0,
    overdueInvoiceCount: overdueRows[0]?.total ?? 0,
    topExpenseCategories,
    mrrRunway,
  };
}
