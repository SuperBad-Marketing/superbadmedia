import { describe, it, expect } from "vitest";
import {
  emptyQuoteContent,
  computeTotals,
  inferStructure,
  QUOTE_CONTENT_VERSION,
  type QuoteContent,
  type QuoteLineItem,
} from "@/lib/quote-builder/content-shape";

function lineItem(
  overrides: Partial<QuoteLineItem> = {},
): QuoteLineItem {
  return {
    id: overrides.id ?? "a",
    kind: overrides.kind ?? "one_off",
    snapshot: {
      catalogue_item_id: null,
      name: "x",
      category: "custom",
      unit: "project",
      base_price_cents_inc_gst: 0,
      tier_rank: null,
      ...(overrides.snapshot ?? {}),
    },
    qty: overrides.qty ?? 1,
    unit_price_cents_inc_gst: overrides.unit_price_cents_inc_gst ?? 0,
  };
}

function withItems(items: QuoteLineItem[]): QuoteContent {
  const c = emptyQuoteContent(14);
  c.sections.whatWellDo.line_items = items;
  return c;
}

describe("QB-2a — content shape", () => {
  it("empty content stamps the expected version and defaults", () => {
    const c = emptyQuoteContent(14);
    expect(c.version).toBe(QUOTE_CONTENT_VERSION);
    expect(c.expiry_days).toBe(14);
    expect(c.sections.whatYouToldUs.prose).toBe("");
    expect(c.sections.whatWellDo.line_items).toEqual([]);
    expect(c.term_length_months).toBeNull();
  });

  it("computeTotals zeroes when there are no line items", () => {
    const t = computeTotals(emptyQuoteContent(14));
    expect(t).toEqual({
      total_cents_inc_gst: 0,
      retainer_monthly_cents_inc_gst: null,
      one_off_cents_inc_gst: null,
    });
  });

  it("sums one-offs correctly", () => {
    const c = withItems([
      lineItem({ id: "a", qty: 2, unit_price_cents_inc_gst: 5000 }),
      lineItem({ id: "b", qty: 1, unit_price_cents_inc_gst: 2500 }),
    ]);
    const t = computeTotals(c);
    expect(t.one_off_cents_inc_gst).toBe(12500);
    expect(t.retainer_monthly_cents_inc_gst).toBeNull();
    expect(t.total_cents_inc_gst).toBe(12500);
  });

  it("sums retainer-only into monthly bucket", () => {
    const c = withItems([
      lineItem({ id: "a", kind: "retainer", qty: 1, unit_price_cents_inc_gst: 300000 }),
    ]);
    const t = computeTotals(c);
    expect(t.retainer_monthly_cents_inc_gst).toBe(300000);
    expect(t.one_off_cents_inc_gst).toBeNull();
    expect(t.total_cents_inc_gst).toBe(300000);
  });

  it("mixed sums both buckets; total is retainer_monthly + one_off", () => {
    const c = withItems([
      lineItem({ id: "a", kind: "retainer", qty: 1, unit_price_cents_inc_gst: 300000 }),
      lineItem({ id: "b", kind: "one_off", qty: 1, unit_price_cents_inc_gst: 50000 }),
    ]);
    const t = computeTotals(c);
    expect(t.retainer_monthly_cents_inc_gst).toBe(300000);
    expect(t.one_off_cents_inc_gst).toBe(50000);
    expect(t.total_cents_inc_gst).toBe(350000);
  });

  it("inferStructure returns project for an empty draft", () => {
    expect(inferStructure(emptyQuoteContent(14))).toBe("project");
  });

  it("inferStructure returns retainer when only retainer items exist", () => {
    const c = withItems([lineItem({ kind: "retainer" })]);
    expect(inferStructure(c)).toBe("retainer");
  });

  it("inferStructure returns project when only one-off items exist", () => {
    const c = withItems([lineItem({ kind: "one_off" })]);
    expect(inferStructure(c)).toBe("project");
  });

  it("inferStructure returns mixed when both present", () => {
    const c = withItems([
      lineItem({ id: "a", kind: "retainer" }),
      lineItem({ id: "b", kind: "one_off" }),
    ]);
    expect(inferStructure(c)).toBe("mixed");
  });
});
