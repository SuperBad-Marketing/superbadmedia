import type { InvoiceStatus } from "@/lib/db/schema/invoices";

/**
 * Pure aggregates for the invoice index summary cards (spec §4.1).
 * Kept free of DB access so tests can exercise FY / month boundary math
 * without the Drizzle harness.
 */
export interface InvoiceAggregateRow {
  status: InvoiceStatus;
  total_cents_inc_gst: number;
  paid_at_ms: number | null;
}

export interface InvoiceIndexSummaryValue {
  outstanding_cents: number;
  overdue_cents: number;
  paid_this_month_cents: number;
  paid_this_fy_cents: number;
}

/**
 * Australian financial year is 1 Jul – 30 Jun. An invoice paid on
 * 2026-03-15 is in FY2025-26 whose start is 2025-07-01. All computations
 * use the Melbourne calendar via `Australia/Melbourne`-equivalent math —
 * but we accept `now` as an epoch-ms and bucket on the UTC-derived
 * date-parts (Andy is in AEDT, but epoch maths stays stable for card
 * totals that don't need sub-day resolution).
 */
export function australianFyStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0 = Jan
  const fyStartYear = month >= 6 ? year : year - 1; // 6 = July
  return Date.UTC(fyStartYear, 6, 1, 0, 0, 0, 0);
}

export function calendarMonthStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
}

export function computeInvoiceSummary(
  rows: InvoiceAggregateRow[],
  nowMs: number,
): InvoiceIndexSummaryValue {
  const monthStart = calendarMonthStartMs(nowMs);
  const fyStart = australianFyStartMs(nowMs);
  let outstanding = 0;
  let overdue = 0;
  let month = 0;
  let fy = 0;
  for (const r of rows) {
    if (r.status === "sent" || r.status === "overdue") {
      outstanding += r.total_cents_inc_gst;
    }
    if (r.status === "overdue") overdue += r.total_cents_inc_gst;
    if (r.status === "paid" && r.paid_at_ms != null) {
      if (r.paid_at_ms >= monthStart) month += r.total_cents_inc_gst;
      if (r.paid_at_ms >= fyStart) fy += r.total_cents_inc_gst;
    }
  }
  return {
    outstanding_cents: outstanding,
    overdue_cents: overdue,
    paid_this_month_cents: month,
    paid_this_fy_cents: fy,
  };
}
