import type { CatalogueItemUnit } from "@/lib/db/schema/catalogue-items";
import type { QuoteStructure } from "@/lib/db/schema/quotes";
export type { QuoteStructure };

/**
 * Canonical shape stored in `quotes.content_json`. Versioned so future
 * migrations can lift v1 into v2 without archaeology. QB-2a writes v1.
 *
 * Every monetary number is GST-inclusive integer cents (§5.1).
 */
export const QUOTE_CONTENT_VERSION = 1 as const;

export type QuoteLineItemKind = "retainer" | "one_off";

/**
 * Catalogue snapshot embedded in each line item so price changes to the
 * catalogue never drift the in-flight quote (§5.2 "snapshot-on-add").
 */
export type QuoteLineItemSnapshot = {
  catalogue_item_id: string | null;
  name: string;
  category: string;
  unit: CatalogueItemUnit;
  base_price_cents_inc_gst: number;
  tier_rank: number | null;
};

export type QuoteLineItem = {
  id: string;
  kind: QuoteLineItemKind;
  snapshot: QuoteLineItemSnapshot;
  qty: number;
  unit_price_cents_inc_gst: number;
};

export type QuoteContent = {
  version: typeof QUOTE_CONTENT_VERSION;
  sections: {
    whatYouToldUs: {
      prose: string;
      provenance: string | null;
      confidence: "high" | "medium" | "low" | null;
    };
    whatWellDo: {
      line_items: QuoteLineItem[];
      prose: string;
    };
    terms: {
      template_id: string | null;
      overrides_prose: string;
    };
  };
  term_length_months: number | null;
  expiry_days: number;
};

export function emptyQuoteContent(expiryDays: number): QuoteContent {
  return {
    version: QUOTE_CONTENT_VERSION,
    sections: {
      whatYouToldUs: { prose: "", provenance: null, confidence: null },
      whatWellDo: { line_items: [], prose: "" },
      terms: { template_id: null, overrides_prose: "" },
    },
    term_length_months: null,
    expiry_days: expiryDays,
  };
}

export type QuoteTotals = {
  total_cents_inc_gst: number;
  retainer_monthly_cents_inc_gst: number | null;
  one_off_cents_inc_gst: number | null;
};

/**
 * Derive totals from line items. `retainer` items contribute to the
 * monthly retainer figure (so appear once on the total for §3 display);
 * `one_off` items contribute to the one-off bucket. The canonical
 * `total_cents_inc_gst` is `retainer_monthly + one_off` — a single
 * month's retainer plus the one-off stack — matching the "first invoice"
 * framing the client sees on §3 Price.
 */
export function computeTotals(content: QuoteContent): QuoteTotals {
  let retainer = 0;
  let oneOff = 0;
  let hasRetainer = false;
  let hasOneOff = false;
  for (const item of content.sections.whatWellDo.line_items) {
    const line = item.qty * item.unit_price_cents_inc_gst;
    if (item.kind === "retainer") {
      retainer += line;
      hasRetainer = true;
    } else {
      oneOff += line;
      hasOneOff = true;
    }
  }
  return {
    total_cents_inc_gst: retainer + oneOff,
    retainer_monthly_cents_inc_gst: hasRetainer ? retainer : null,
    one_off_cents_inc_gst: hasOneOff ? oneOff : null,
  };
}

/**
 * Structure follows which line-item kinds are present. An empty draft is
 * treated as `project` (the neutral default for a brand-new row); the
 * editor flips it the moment the first line item lands.
 */
export function inferStructure(content: QuoteContent): QuoteStructure {
  let hasRetainer = false;
  let hasOneOff = false;
  for (const item of content.sections.whatWellDo.line_items) {
    if (item.kind === "retainer") hasRetainer = true;
    else hasOneOff = true;
  }
  if (hasRetainer && hasOneOff) return "mixed";
  if (hasRetainer) return "retainer";
  return "project";
}
