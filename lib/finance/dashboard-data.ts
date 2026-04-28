import { desc, eq, and, gte, lte, sql, count, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { finance_snapshots, type FinanceMetrics, type FinanceProjection } from "@/lib/db/schema/finance-snapshots";
import { expenses, type ExpenseRow, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/db/schema/expenses";
import { invoices } from "@/lib/db/schema/invoices";
import { stripe_synced_payments } from "@/lib/db/schema/stripe-synced-payments";
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
  revenueMtdCents: number;
  revenueMtdPrevCents: number;
  revenueYtdCents: number;
  revenueYtdPrevCents: number;
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

async function sumRevenue(startMs: number, endMs: number): Promise<number> {
  const [stripeCents, manualCents] = await Promise.all([
    sumStripeCharges(startMs, endMs),
    sumManualInvoices(startMs, endMs),
  ]);
  return stripeCents + manualCents;
}

async function sumStripeCharges(startMs: number, endMs: number): Promise<number> {
  try {
    const { getStripe } = await import("@/lib/stripe/client");
    const stripe = getStripe();

    let total = 0;
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Record<string, unknown> = {
        created: {
          gte: Math.floor(startMs / 1000),
          lte: Math.floor(endMs / 1000),
        },
        limit: 100,
      };
      if (startingAfter) params.starting_after = startingAfter;

      const charges = await stripe.charges.list(
        params as Parameters<typeof stripe.charges.list>[0],
      );

      for (const charge of charges.data) {
        if (charge.status === "succeeded") {
          total += charge.amount;
        }
      }

      hasMore = charges.has_more;
      if (charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id;
      }
    }

    return total;
  } catch {
    return 0;
  }
}

async function sumManualInvoices(startMs: number, endMs: number): Promise<number> {
  const result = await db
    .select({ total: sql<number>`coalesce(sum(${invoices.total_cents_inc_gst}), 0)` })
    .from(invoices)
    .where(and(
      eq(invoices.status, "paid"),
      gte(invoices.paid_at_ms, startMs),
      lte(invoices.paid_at_ms, endMs),
      sql`${invoices.stripe_payment_intent_id} is null`,
    ));
  return Number(result[0]?.total ?? 0);
}

function computeRevenuePeriods(now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth();

  const mtdStart = new Date(y, m, 1).getTime();
  const mtdEnd = now.getTime();

  const prevMtdStart = new Date(y, m - 1, 1).getTime();
  const prevMtdDay = Math.min(now.getDate(), new Date(y, m, 0).getDate());
  const prevMtdEnd = new Date(y, m - 1, prevMtdDay, 23, 59, 59, 999).getTime();

  const fyStartYear = m >= 6 ? y : y - 1;
  const ytdStart = new Date(fyStartYear, 6, 1).getTime();
  const ytdEnd = now.getTime();

  const prevFyStartYear = fyStartYear - 1;
  const prevYtdStart = new Date(prevFyStartYear, 6, 1).getTime();
  const daysSinceFyStart = Math.floor((ytdEnd - ytdStart) / 86_400_000);
  const prevYtdEnd = new Date(prevFyStartYear, 6, 1 + daysSinceFyStart, 23, 59, 59, 999).getTime();

  return { mtdStart, mtdEnd, prevMtdStart, prevMtdEnd, ytdStart, ytdEnd, prevYtdStart, prevYtdEnd };
}

export async function getDashboardData(
  rangeStart: string,
  rangeEnd: string,
): Promise<DashboardData> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const periods = computeRevenuePeriods(new Date());

  const [
    snapshotRows,
    prevSnapshotRows,
    recentExpenses,
    recentPaidInvoices,
    recentSyncedPayments,
    outstandingRows,
    overdueRows,
    topCategories,
    mrrDeals,
    revenueMtdCents,
    revenueMtdPrevCents,
    revenueYtdCents,
    revenueYtdPrevCents,
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
    db.select({
      id: stripe_synced_payments.id,
      description: stripe_synced_payments.description,
      customer_name: stripe_synced_payments.customer_name,
      amount_cents: stripe_synced_payments.amount_cents,
      paid_at_ms: stripe_synced_payments.paid_at_ms,
      payment_date: stripe_synced_payments.payment_date,
    }).from(stripe_synced_payments)
      .where(and(
        gte(stripe_synced_payments.paid_at_ms, new Date(rangeStart).getTime()),
        lte(stripe_synced_payments.paid_at_ms, new Date(rangeEnd + "T23:59:59Z").getTime()),
      ))
      .orderBy(desc(stripe_synced_payments.paid_at_ms))
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
    sumRevenue(periods.mtdStart, periods.mtdEnd),
    sumRevenue(periods.prevMtdStart, periods.prevMtdEnd),
    sumRevenue(periods.ytdStart, periods.ytdEnd),
    sumRevenue(periods.prevYtdStart, periods.prevYtdEnd),
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

  for (const sp of recentSyncedPayments) {
    transactions.push({
      id: `sp-${sp.id}`,
      date: sp.payment_date,
      type: "income",
      description: sp.description || "Stripe payment",
      counterparty: sp.customer_name || "Stripe",
      amount_cents: sp.amount_cents,
      link: `/lite/finance/recent`,
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
    revenueMtdCents,
    revenueMtdPrevCents,
    revenueYtdCents,
    revenueYtdPrevCents,
  };
}
