import { and, eq, gte, lte, inArray, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { stripe_synced_payments } from "@/lib/db/schema/stripe-synced-payments";
import { expenses } from "@/lib/db/schema/expenses";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import settings from "@/lib/settings";
import type { FinanceMetrics } from "@/lib/db/schema/finance-snapshots";
import { getStripe } from "@/lib/stripe/client";

export interface SnapshotStaleFlags {
  stripe_balance?: boolean;
}

export async function computeSnapshotMetrics(
  nowMs: number,
): Promise<{ metrics: FinanceMetrics; staleFlags: SnapshotStaleFlags }> {
  const today = new Date(nowMs);
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().slice(0, 10);

  const gstRate = await settings.get("finance.gst_rate");
  const incomeTaxRate = await settings.get("finance.income_tax_rate");

  const [
    revenueMtd,
    expensesMtd,
    mrr,
    outstandingInvoices,
    gstCollected,
    gstPaidExpenses,
    netProfitYtd,
    stripeResult,
  ] = await Promise.all([
    computeRevenueMtd(monthStart, todayStr),
    computeExpensesMtd(monthStart, todayStr),
    computeMrr(),
    computeOutstandingInvoices(),
    computeGstCollectedThisQuarter(nowMs),
    computeGstPaidExpensesThisQuarter(nowMs),
    computeNetProfitYtd(nowMs),
    fetchStripeBalance(),
  ]);

  const gstOwed = Math.max(0, gstCollected - gstPaidExpenses);
  const incomeTaxProvisioned = Math.round(
    Math.max(0, netProfitYtd) * incomeTaxRate,
  );
  const net = revenueMtd - expensesMtd;
  const yoursToSpend =
    stripeResult.balanceCents - gstOwed - incomeTaxProvisioned;

  const metrics: FinanceMetrics = {
    revenue_mtd_cents: revenueMtd,
    expenses_mtd_cents: expensesMtd,
    net_cents: net,
    mrr_cents: mrr,
    outstanding_invoices_cents: outstandingInvoices,
    gst_owed_cents: gstOwed,
    income_tax_provisioned_cents: incomeTaxProvisioned,
    yours_to_spend_cents: yoursToSpend,
    stripe_balance_cents: stripeResult.balanceCents,
  };

  const staleFlags: SnapshotStaleFlags = {};
  if (stripeResult.stale) {
    staleFlags.stripe_balance = true;
  }

  return { metrics, staleFlags };
}

async function computeRevenueMtd(
  monthStart: string,
  todayStr: string,
): Promise<number> {
  const startMs = new Date(monthStart).getTime();
  const endMs = new Date(todayStr + "T23:59:59Z").getTime();

  const [invoiceRows, syncedRows] = await Promise.all([
    db
      .select({ total: sum(invoices.total_cents_inc_gst) })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "paid"),
          gte(invoices.paid_at_ms, startMs),
          lte(invoices.paid_at_ms, endMs),
        ),
      ),
    db
      .select({ total: sum(stripe_synced_payments.amount_cents) })
      .from(stripe_synced_payments)
      .where(
        and(
          gte(stripe_synced_payments.paid_at_ms, startMs),
          lte(stripe_synced_payments.paid_at_ms, endMs),
        ),
      ),
  ]);

  return Number(invoiceRows[0]?.total ?? 0) + Number(syncedRows[0]?.total ?? 0);
}

async function computeExpensesMtd(
  monthStart: string,
  todayStr: string,
): Promise<number> {
  const rows = await db
    .select({ total: sum(expenses.amount_inc_gst) })
    .from(expenses)
    .where(
      and(
        gte(expenses.expense_date, monthStart),
        lte(expenses.expense_date, todayStr),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

async function computeMrr(): Promise<number> {
  const rows = await db
    .select({
      value_cents: deals.value_cents,
      billing_cadence: deals.billing_cadence,
    })
    .from(deals)
    .where(
      and(
        eq(deals.stage, "won"),
        inArray(deals.subscription_state, [
          "active_current",
          "past_due",
        ]),
      ),
    );

  let total = 0;
  for (const row of rows) {
    if (!row.value_cents) continue;
    switch (row.billing_cadence) {
      case "annual_upfront":
      case "annual_monthly":
        total += Math.round(row.value_cents / 12);
        break;
      default:
        total += row.value_cents;
    }
  }
  return total;
}

async function computeOutstandingInvoices(): Promise<number> {
  const rows = await db
    .select({ total: sum(invoices.total_cents_inc_gst) })
    .from(invoices)
    .where(inArray(invoices.status, ["sent", "overdue"]));
  return Number(rows[0]?.total ?? 0);
}

function getBasQuarterRange(nowMs: number): { start: string; end: string } {
  const d = new Date(nowMs);
  const month = d.getMonth();
  const year = d.getFullYear();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const start = `${year}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`;
  const endMonth = quarterStartMonth + 3;
  const endYear = endMonth > 11 ? year + 1 : year;
  const endMonthNorm = endMonth > 11 ? 0 : endMonth;
  const endDate = new Date(endYear, endMonthNorm, 0);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

async function computeGstCollectedThisQuarter(nowMs: number): Promise<number> {
  const { start, end } = getBasQuarterRange(nowMs);
  const startMs = new Date(start).getTime();
  const endMs = new Date(end + "T23:59:59Z").getTime();

  const [invoiceRows, syncedRows] = await Promise.all([
    db
      .select({ total: sum(invoices.gst_cents) })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "paid"),
          gte(invoices.paid_at_ms, startMs),
          lte(invoices.paid_at_ms, endMs),
        ),
      ),
    db
      .select({ total: sum(stripe_synced_payments.gst_cents) })
      .from(stripe_synced_payments)
      .where(
        and(
          gte(stripe_synced_payments.paid_at_ms, startMs),
          lte(stripe_synced_payments.paid_at_ms, endMs),
        ),
      ),
  ]);

  return Number(invoiceRows[0]?.total ?? 0) + Number(syncedRows[0]?.total ?? 0);
}

async function computeGstPaidExpensesThisQuarter(
  nowMs: number,
): Promise<number> {
  const { start, end } = getBasQuarterRange(nowMs);
  const rows = await db
    .select({ total: sum(expenses.gst_amount) })
    .from(expenses)
    .where(
      and(
        gte(expenses.expense_date, start),
        lte(expenses.expense_date, end),
        eq(expenses.status, "confirmed"),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

async function computeNetProfitYtd(nowMs: number): Promise<number> {
  const d = new Date(nowMs);
  const fyStart =
    d.getMonth() >= 6
      ? `${d.getFullYear()}-07-01`
      : `${d.getFullYear() - 1}-07-01`;
  const todayStr = d.toISOString().slice(0, 10);
  const startMs = new Date(fyStart).getTime();
  const endMs = new Date(todayStr + "T23:59:59Z").getTime();

  const [revRows, syncedRevRows, expRows] = await Promise.all([
    db
      .select({ total: sum(invoices.total_cents_inc_gst) })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "paid"),
          gte(invoices.paid_at_ms, startMs),
          lte(invoices.paid_at_ms, endMs),
        ),
      ),
    db
      .select({ total: sum(stripe_synced_payments.amount_cents) })
      .from(stripe_synced_payments)
      .where(
        and(
          gte(stripe_synced_payments.paid_at_ms, startMs),
          lte(stripe_synced_payments.paid_at_ms, endMs),
        ),
      ),
    db
      .select({ total: sum(expenses.amount_inc_gst) })
      .from(expenses)
      .where(
        and(
          gte(expenses.expense_date, fyStart),
          lte(expenses.expense_date, todayStr),
        ),
      ),
  ]);

  const revenue = Number(revRows[0]?.total ?? 0) + Number(syncedRevRows[0]?.total ?? 0);
  const expensesTotal = Number(expRows[0]?.total ?? 0);
  return revenue - expensesTotal;
}

async function fetchStripeBalance(): Promise<{
  balanceCents: number;
  stale: boolean;
}> {
  const stripeConn = await db
    .select()
    .from(integration_connections)
    .where(
      and(
        eq(integration_connections.vendor_key, "stripe-admin"),
        eq(integration_connections.status, "active"),
      ),
    )
    .limit(1);

  if (stripeConn.length === 0) {
    return { balanceCents: 0, stale: true };
  }

  try {
    const stripe = getStripe();
    const balance = await stripe.balance.retrieve();
    const audAvailable =
      balance.available.find((b) => b.currency === "aud")?.amount ?? 0;
    const audPending =
      balance.pending.find((b) => b.currency === "aud")?.amount ?? 0;
    return { balanceCents: audAvailable + audPending, stale: false };
  } catch {
    return { balanceCents: 0, stale: true };
  }
}

export { getBasQuarterRange, fetchStripeBalance };
