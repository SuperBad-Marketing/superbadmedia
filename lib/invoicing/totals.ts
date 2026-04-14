import type { InvoiceLineItem } from "@/lib/db/schema/invoices";

/**
 * GST derivation — done at total level (not per line item) to avoid the
 * rounded-line-sum ≠ rounded-total pitfall called out in spec §14.3.
 *
 *   gst_applicable: total ÷ 11 → gst; total − gst → ex_gst
 *   !gst_applicable: ex = total, gst = 0
 */
export function deriveInvoiceTotals(
  total_cents_inc_gst: number,
  gst_applicable: boolean,
): { total_cents_inc_gst: number; total_cents_ex_gst: number; gst_cents: number } {
  if (!gst_applicable) {
    return {
      total_cents_inc_gst,
      total_cents_ex_gst: total_cents_inc_gst,
      gst_cents: 0,
    };
  }
  const gst_cents = Math.round(total_cents_inc_gst / 11);
  const total_cents_ex_gst = total_cents_inc_gst - gst_cents;
  return { total_cents_inc_gst, total_cents_ex_gst, gst_cents };
}

export function sumLineItems(line_items: InvoiceLineItem[]): number {
  return line_items.reduce(
    (acc, li) => acc + (li.line_total_cents_inc_gst | 0),
    0,
  );
}
