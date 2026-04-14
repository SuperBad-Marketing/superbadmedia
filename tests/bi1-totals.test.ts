import { describe, it, expect } from "vitest";
import { deriveInvoiceTotals, sumLineItems } from "@/lib/invoicing/totals";

describe("BI-1 — deriveInvoiceTotals", () => {
  it("derives GST at total level (Math.round total/11)", () => {
    const r = deriveInvoiceTotals(110_00, true);
    expect(r.total_cents_inc_gst).toBe(11000);
    expect(r.gst_cents).toBe(1000);
    expect(r.total_cents_ex_gst).toBe(10000);
  });

  it("handles odd totals without per-line drift (spec §14.3)", () => {
    // 3 × $33.33 = $99.99; GST = 9.09; ex = 90.90
    const r = deriveInvoiceTotals(9999, true);
    expect(r.gst_cents).toBe(Math.round(9999 / 11));
    expect(r.total_cents_ex_gst + r.gst_cents).toBe(r.total_cents_inc_gst);
  });

  it("zeroes GST when company is not GST-applicable", () => {
    const r = deriveInvoiceTotals(50000, false);
    expect(r.gst_cents).toBe(0);
    expect(r.total_cents_ex_gst).toBe(50000);
  });
});

describe("BI-1 — sumLineItems", () => {
  it("sums line_total_cents_inc_gst", () => {
    expect(
      sumLineItems([
        {
          description: "a",
          quantity: 1,
          unit_price_cents_inc_gst: 100,
          line_total_cents_inc_gst: 100,
          is_recurring: false,
        },
        {
          description: "b",
          quantity: 2,
          unit_price_cents_inc_gst: 250,
          line_total_cents_inc_gst: 500,
          is_recurring: true,
        },
      ]),
    ).toBe(600);
  });

  it("returns 0 on empty", () => {
    expect(sumLineItems([])).toBe(0);
  });
});
