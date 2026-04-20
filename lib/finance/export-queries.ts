import { and, gte, lte, eq, inArray, sql, desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices, type InvoiceRow } from "@/lib/db/schema/invoices";
import { expenses, type ExpenseRow, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/db/schema/expenses";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";

export interface ExportPeriod {
  start: string;
  end: string;
  label: string;
}

export interface ExportTransactionRow {
  date: string;
  type: "income" | "expense";
  description: string;
  counterparty: string;
  category: string;
  amount_inc_gst: number;
  gst_amount: number;
  amount_ex_gst: number;
  source_id: string;
}

export interface ExportInvoiceRow {
  invoice_number: string;
  company_name: string;
  status: string;
  issue_date: string;
  due_date: string;
  paid_date: string;
  amount_inc_gst: number;
  gst_amount: number;
  amount_ex_gst: number;
}

export interface ExportExpenseRow {
  date: string;
  vendor: string;
  category: string;
  description: string;
  status: string;
  source: string;
  amount_inc_gst: number;
  gst_amount: number;
  amount_ex_gst: number;
}

export interface ClientRevenueRow {
  company_name: string;
  invoices_paid: number;
  total_inc_gst: number;
  total_gst: number;
  total_ex_gst: number;
}

function msToDateStr(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Date(ms).toISOString().split("T")[0];
}

function centsToAud(cents: number): number {
  return cents / 100;
}

export async function getExportTransactions(
  period: ExportPeriod,
): Promise<ExportTransactionRow[]> {
  const startMs = new Date(period.start).getTime();
  const endMs = new Date(period.end + "T23:59:59.999Z").getTime();

  const paidInvoices = await db
    .select({
      id: invoices.id,
      invoice_number: invoices.invoice_number,
      company_id: invoices.company_id,
      paid_at_ms: invoices.paid_at_ms,
      total_cents_inc_gst: invoices.total_cents_inc_gst,
      gst_cents: invoices.gst_cents,
      total_cents_ex_gst: invoices.total_cents_ex_gst,
      scope_summary: invoices.scope_summary,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.paid_at_ms, startMs),
        lte(invoices.paid_at_ms, endMs),
      ),
    )
    .all();

  const companyIds = [...new Set(paidInvoices.map((i) => i.company_id))];
  const companyMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const rows = await db
      .select({ id: companies.id, display_name: companies.name })
      .from(companies)
      .where(inArray(companies.id, companyIds))
      .all();
    for (const r of rows) {
      companyMap.set(r.id, r.display_name ?? r.id);
    }
  }

  const incomeRows: ExportTransactionRow[] = paidInvoices.map((inv) => ({
    date: msToDateStr(inv.paid_at_ms),
    type: "income" as const,
    description: inv.scope_summary ?? `Invoice ${inv.invoice_number}`,
    counterparty: companyMap.get(inv.company_id) ?? inv.company_id,
    category: "Revenue",
    amount_inc_gst: centsToAud(inv.total_cents_inc_gst),
    gst_amount: centsToAud(inv.gst_cents),
    amount_ex_gst: centsToAud(inv.total_cents_ex_gst),
    source_id: inv.id,
  }));

  const periodExpenses = await db
    .select()
    .from(expenses)
    .where(
      and(
        gte(expenses.expense_date, period.start),
        lte(expenses.expense_date, period.end),
      ),
    )
    .all();

  const expenseRows: ExportTransactionRow[] = periodExpenses.map((exp) => {
    const incGst = exp.amount_inc_gst;
    const gst = exp.gst_amount ?? 0;
    return {
      date: exp.expense_date,
      type: "expense" as const,
      description: exp.description ?? EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] ?? exp.category,
      counterparty: exp.vendor,
      category: EXPENSE_CATEGORY_LABELS[exp.category as ExpenseCategory] ?? exp.category,
      amount_inc_gst: centsToAud(incGst),
      gst_amount: centsToAud(gst),
      amount_ex_gst: centsToAud(incGst - gst),
      source_id: exp.id,
    };
  });

  return [...incomeRows, ...expenseRows].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getExportInvoices(
  period: ExportPeriod,
): Promise<ExportInvoiceRow[]> {
  const startMs = new Date(period.start).getTime();
  const endMs = new Date(period.end + "T23:59:59.999Z").getTime();

  const rows = await db
    .select({
      invoice_number: invoices.invoice_number,
      company_id: invoices.company_id,
      status: invoices.status,
      issue_date_ms: invoices.issue_date_ms,
      due_at_ms: invoices.due_at_ms,
      paid_at_ms: invoices.paid_at_ms,
      total_cents_inc_gst: invoices.total_cents_inc_gst,
      gst_cents: invoices.gst_cents,
      total_cents_ex_gst: invoices.total_cents_ex_gst,
    })
    .from(invoices)
    .where(
      and(
        gte(invoices.issue_date_ms, startMs),
        lte(invoices.issue_date_ms, endMs),
      ),
    )
    .orderBy(invoices.issue_date_ms)
    .all();

  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const companyMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const companyRows = await db
      .select({ id: companies.id, display_name: companies.name })
      .from(companies)
      .where(inArray(companies.id, companyIds))
      .all();
    for (const c of companyRows) {
      companyMap.set(c.id, c.display_name ?? c.id);
    }
  }

  return rows.map((r) => ({
    invoice_number: r.invoice_number,
    company_name: companyMap.get(r.company_id) ?? r.company_id,
    status: r.status,
    issue_date: msToDateStr(r.issue_date_ms),
    due_date: msToDateStr(r.due_at_ms),
    paid_date: msToDateStr(r.paid_at_ms),
    amount_inc_gst: centsToAud(r.total_cents_inc_gst),
    gst_amount: centsToAud(r.gst_cents),
    amount_ex_gst: centsToAud(r.total_cents_ex_gst),
  }));
}

export async function getExportExpenses(
  period: ExportPeriod,
): Promise<ExportExpenseRow[]> {
  const rows = await db
    .select()
    .from(expenses)
    .where(
      and(
        gte(expenses.expense_date, period.start),
        lte(expenses.expense_date, period.end),
      ),
    )
    .orderBy(expenses.expense_date)
    .all();

  return rows.map((r) => {
    const gst = r.gst_amount ?? 0;
    return {
      date: r.expense_date,
      vendor: r.vendor,
      category: EXPENSE_CATEGORY_LABELS[r.category as ExpenseCategory] ?? r.category,
      description: r.description ?? "",
      status: r.status,
      source: r.source,
      amount_inc_gst: centsToAud(r.amount_inc_gst),
      gst_amount: centsToAud(gst),
      amount_ex_gst: centsToAud(r.amount_inc_gst - gst),
    };
  });
}

export async function getClientRevenue(
  period: ExportPeriod,
): Promise<ClientRevenueRow[]> {
  const startMs = new Date(period.start).getTime();
  const endMs = new Date(period.end + "T23:59:59.999Z").getTime();

  const rows = await db
    .select({
      company_id: invoices.company_id,
      count: sql<number>`count(*)`,
      total_inc: sql<number>`sum(${invoices.total_cents_inc_gst})`,
      total_gst: sql<number>`sum(${invoices.gst_cents})`,
      total_ex: sql<number>`sum(${invoices.total_cents_ex_gst})`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.paid_at_ms, startMs),
        lte(invoices.paid_at_ms, endMs),
      ),
    )
    .groupBy(invoices.company_id)
    .all();

  const companyIds = rows.map((r) => r.company_id);
  const companyMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const companyRows = await db
      .select({ id: companies.id, display_name: companies.name })
      .from(companies)
      .where(inArray(companies.id, companyIds))
      .all();
    for (const c of companyRows) {
      companyMap.set(c.id, c.display_name ?? c.id);
    }
  }

  return rows
    .map((r) => ({
      company_name: companyMap.get(r.company_id) ?? r.company_id,
      invoices_paid: r.count,
      total_inc_gst: centsToAud(r.total_inc ?? 0),
      total_gst: centsToAud(r.total_gst ?? 0),
      total_ex_gst: centsToAud(r.total_ex ?? 0),
    }))
    .sort((a, b) => b.total_inc_gst - a.total_inc_gst);
}

export interface BasSummary {
  period: ExportPeriod;
  gst_collected_inc: number;
  gst_collected_ex: number;
  gst_paid_on_expenses: number;
  net_gst_payable: number;
  total_revenue_inc: number;
  total_revenue_ex: number;
  total_expenses_inc: number;
  total_expenses_ex: number;
}

export async function computeBasSummary(
  period: ExportPeriod,
): Promise<BasSummary> {
  const startMs = new Date(period.start).getTime();
  const endMs = new Date(period.end + "T23:59:59.999Z").getTime();

  const invoiceAgg = await db
    .select({
      total_inc: sql<number>`coalesce(sum(${invoices.total_cents_inc_gst}), 0)`,
      total_gst: sql<number>`coalesce(sum(${invoices.gst_cents}), 0)`,
      total_ex: sql<number>`coalesce(sum(${invoices.total_cents_ex_gst}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.paid_at_ms, startMs),
        lte(invoices.paid_at_ms, endMs),
      ),
    )
    .get();

  const expenseAgg = await db
    .select({
      total_inc: sql<number>`coalesce(sum(${expenses.amount_inc_gst}), 0)`,
      total_gst: sql<number>`coalesce(sum(coalesce(${expenses.gst_amount}, 0)), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expense_date, period.start),
        lte(expenses.expense_date, period.end),
      ),
    )
    .get();

  const revInc = invoiceAgg?.total_inc ?? 0;
  const revGst = invoiceAgg?.total_gst ?? 0;
  const revEx = invoiceAgg?.total_ex ?? 0;
  const expInc = expenseAgg?.total_inc ?? 0;
  const expGst = expenseAgg?.total_gst ?? 0;
  const expEx = expInc - expGst;

  return {
    period,
    gst_collected_inc: centsToAud(revGst),
    gst_collected_ex: centsToAud(revGst),
    gst_paid_on_expenses: centsToAud(expGst),
    net_gst_payable: centsToAud(revGst - expGst),
    total_revenue_inc: centsToAud(revInc),
    total_revenue_ex: centsToAud(revEx),
    total_expenses_inc: centsToAud(expInc),
    total_expenses_ex: centsToAud(expEx),
  };
}

export interface PandLSummary {
  period: ExportPeriod;
  revenue_inc_gst: number;
  revenue_ex_gst: number;
  expenses_inc_gst: number;
  expenses_ex_gst: number;
  net_profit_inc_gst: number;
  net_profit_ex_gst: number;
  expense_breakdown: Array<{
    category: string;
    label: string;
    total_inc_gst: number;
    total_ex_gst: number;
  }>;
}

export async function computePandLSummary(
  period: ExportPeriod,
): Promise<PandLSummary> {
  const startMs = new Date(period.start).getTime();
  const endMs = new Date(period.end + "T23:59:59.999Z").getTime();

  const invoiceAgg = await db
    .select({
      total_inc: sql<number>`coalesce(sum(${invoices.total_cents_inc_gst}), 0)`,
      total_ex: sql<number>`coalesce(sum(${invoices.total_cents_ex_gst}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.paid_at_ms, startMs),
        lte(invoices.paid_at_ms, endMs),
      ),
    )
    .get();

  const expenseByCat = await db
    .select({
      category: expenses.category,
      total_inc: sql<number>`coalesce(sum(${expenses.amount_inc_gst}), 0)`,
      total_gst: sql<number>`coalesce(sum(coalesce(${expenses.gst_amount}, 0)), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expense_date, period.start),
        lte(expenses.expense_date, period.end),
      ),
    )
    .groupBy(expenses.category)
    .all();

  const totalExpInc = expenseByCat.reduce((s, r) => s + r.total_inc, 0);
  const totalExpGst = expenseByCat.reduce((s, r) => s + r.total_gst, 0);

  return {
    period,
    revenue_inc_gst: centsToAud(invoiceAgg?.total_inc ?? 0),
    revenue_ex_gst: centsToAud(invoiceAgg?.total_ex ?? 0),
    expenses_inc_gst: centsToAud(totalExpInc),
    expenses_ex_gst: centsToAud(totalExpInc - totalExpGst),
    net_profit_inc_gst: centsToAud((invoiceAgg?.total_inc ?? 0) - totalExpInc),
    net_profit_ex_gst: centsToAud((invoiceAgg?.total_ex ?? 0) - (totalExpInc - totalExpGst)),
    expense_breakdown: expenseByCat
      .map((r) => ({
        category: r.category,
        label: EXPENSE_CATEGORY_LABELS[r.category as ExpenseCategory] ?? r.category,
        total_inc_gst: centsToAud(r.total_inc),
        total_ex_gst: centsToAud(r.total_inc - r.total_gst),
      }))
      .sort((a, b) => b.total_inc_gst - a.total_inc_gst),
  };
}
