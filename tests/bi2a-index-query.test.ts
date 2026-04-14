import { describe, it, expect } from "vitest";
import {
  australianFyStartMs,
  calendarMonthStartMs,
  computeInvoiceSummary,
} from "@/lib/invoicing/index-query";

describe("bi2a index-query aggregates", () => {
  it("FY start rolls to 1 July", () => {
    const march = Date.UTC(2026, 2, 15);
    expect(australianFyStartMs(march)).toBe(Date.UTC(2025, 6, 1));
    const august = Date.UTC(2026, 7, 2);
    expect(australianFyStartMs(august)).toBe(Date.UTC(2026, 6, 1));
  });

  it("calendar month start normalises to first-of-month UTC", () => {
    expect(calendarMonthStartMs(Date.UTC(2026, 3, 15, 11))).toBe(
      Date.UTC(2026, 3, 1),
    );
  });

  it("buckets outstanding / overdue / paid-this-month / paid-this-fy", () => {
    const now = Date.UTC(2026, 3, 15); // April 15, 2026
    const fyStart = australianFyStartMs(now); // 2025-07-01
    const monthStart = calendarMonthStartMs(now); // 2026-04-01
    const summary = computeInvoiceSummary(
      [
        { status: "sent", total_cents_inc_gst: 10_000, paid_at_ms: null },
        { status: "overdue", total_cents_inc_gst: 25_000, paid_at_ms: null },
        {
          status: "paid",
          total_cents_inc_gst: 5_000,
          paid_at_ms: monthStart + 86_400_000,
        },
        {
          status: "paid",
          total_cents_inc_gst: 7_500,
          paid_at_ms: fyStart + 86_400_000,
        },
        { status: "draft", total_cents_inc_gst: 99_999, paid_at_ms: null },
        { status: "void", total_cents_inc_gst: 99_999, paid_at_ms: null },
      ],
      now,
    );
    expect(summary.outstanding_cents).toBe(35_000); // sent + overdue
    expect(summary.overdue_cents).toBe(25_000);
    expect(summary.paid_this_month_cents).toBe(5_000);
    expect(summary.paid_this_fy_cents).toBe(12_500); // both paid rows sit after fy start
  });
});
