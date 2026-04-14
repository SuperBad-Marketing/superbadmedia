import { describe, it, expect } from "vitest";
import type { InvoiceRow, InvoiceLineItem } from "@/lib/db/schema/invoices";
import type { CompanyRow } from "@/lib/db/schema/companies";
import type { ContactRow } from "@/lib/db/schema/contacts";
import {
  buildInvoicePdfHtml,
  invoicePdfFilename,
  defaultSupplier,
} from "@/lib/invoicing/pdf-template";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

function makeCompany(overrides: Partial<CompanyRow> = {}): CompanyRow {
  return {
    id: "co-1",
    name: "Acme Widgets Pty Ltd",
    name_normalised: "acme-widgets",
    abn: "11 222 333 444",
    billing_mode: "manual",
    gst_applicable: true,
    payment_terms_days: 14,
    first_seen_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
    ...overrides,
  } as CompanyRow;
}

function makeInvoice(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  const lineItems: InvoiceLineItem[] = [
    {
      description: "Retainer — March 2026",
      quantity: 1,
      unit_price_cents_inc_gst: 550_000,
      line_total_cents_inc_gst: 550_000,
      is_recurring: true,
    },
  ];
  return {
    id: "inv-1",
    invoice_number: "SB-INV-2026-0001",
    deal_id: "deal-1",
    company_id: "co-1",
    quote_id: null,
    token: "tok-inv-1",
    status: "sent",
    cycle_index: 0,
    cycle_start_ms: NOW,
    cycle_end_ms: NOW + 30 * DAY,
    issue_date_ms: NOW,
    due_at_ms: NOW + 14 * DAY,
    paid_at_ms: null,
    paid_via: null,
    stripe_payment_intent_id: null,
    total_cents_inc_gst: 550_000,
    total_cents_ex_gst: 500_000,
    gst_cents: 50_000,
    gst_applicable: true,
    line_items_json: lineItems,
    scope_summary: "Ongoing content + paid social for March.",
    supersedes_invoice_id: null,
    thread_message_id: null,
    reminder_count: 0,
    last_reminder_at_ms: null,
    auto_send_at_ms: null,
    created_at_ms: NOW,
    updated_at_ms: NOW,
    ...overrides,
  } as InvoiceRow;
}

const CONTACT: ContactRow = {
  id: "c-1",
  company_id: "co-1",
  name: "Sam Smith",
  email: "sam@acme.test",
  created_at_ms: NOW,
  updated_at_ms: NOW,
} as ContactRow;

describe("invoicePdfFilename", () => {
  it("builds brand-forward filename from company slug + invoice number", () => {
    expect(invoicePdfFilename(makeCompany(), makeInvoice())).toBe(
      "SuperBad-Invoice-acme-widgets-pty-ltd-SB-INV-2026-0001.pdf",
    );
  });
});

describe("buildInvoicePdfHtml", () => {
  const baseInput = {
    company: makeCompany(),
    primaryContact: CONTACT,
    invoiceUrl: "https://superbadmedia.com.au/lite/invoices/tok-inv-1",
    quoteUrl: "https://superbadmedia.com.au/lite/quotes/tok-q-1",
    termsUrl: "https://superbadmedia.com.au/lite/legal/terms",
  };

  it("renders ATO-required tax-invoice title, itemised GST, and total", () => {
    const html = buildInvoicePdfHtml({
      ...baseInput,
      invoice: makeInvoice(),
    });
    expect(html).toContain("Tax Invoice");
    expect(html).toContain("SB-INV-2026-0001");
    expect(html).toContain("GST (10%)");
    expect(html).toContain("$5,500.00");
    expect(html).toContain("$5,000.00");
    expect(html).toContain("$500.00");
    expect(html).toContain(
      "https://superbadmedia.com.au/lite/quotes/tok-q-1",
    );
  });

  it("notes GST-not-applicable and omits the GST breakdown", () => {
    const html = buildInvoicePdfHtml({
      ...baseInput,
      company: makeCompany({ gst_applicable: false }),
      invoice: makeInvoice({
        gst_applicable: false,
        total_cents_ex_gst: 550_000,
        gst_cents: 0,
      }),
    });
    expect(html).toContain("GST not applicable");
    expect(html).not.toContain("GST (10%)");
  });

  it("adds the PAID stamp + hides the pay CTA on paid invoices", () => {
    const html = buildInvoicePdfHtml({
      ...baseInput,
      invoice: makeInvoice({ status: "paid", paid_at_ms: NOW + 3 * DAY }),
    });
    expect(html).toContain("paid-stamp");
    expect(html).toContain("PAID");
    expect(html).not.toContain('class="pay"');
  });

  it("renders the overdue banner when status=overdue", () => {
    const html = buildInvoicePdfHtml({
      ...baseInput,
      invoice: makeInvoice({ status: "overdue" }),
    });
    expect(html).toContain("This invoice is overdue");
  });

  it("renders the void banner + hides pay CTA when status=void", () => {
    const html = buildInvoicePdfHtml({
      ...baseInput,
      invoice: makeInvoice({ status: "void" }),
    });
    expect(html).toContain("This invoice has been voided");
    expect(html).not.toContain('class="pay"');
  });

  it("handles missing primary contact + missing source quote gracefully", () => {
    const html = buildInvoicePdfHtml({
      ...baseInput,
      primaryContact: null,
      quoteUrl: null,
      invoice: makeInvoice(),
    });
    expect(html).not.toContain("View the original proposal");
    expect(html).toContain("Acme Widgets Pty Ltd");
  });
});

describe("defaultSupplier", () => {
  it("falls back to safe defaults when env is unset", () => {
    const prevAbn = process.env.SUPERBAD_ABN;
    const prevEmail = process.env.SUPERBAD_BILLING_EMAIL;
    delete process.env.SUPERBAD_ABN;
    delete process.env.SUPERBAD_BILLING_EMAIL;
    try {
      const s = defaultSupplier();
      expect(s.name).toBe("SuperBad Media Pty Ltd");
      expect(s.abn).toBe("ABN to confirm");
      expect(s.email).toBe("hi@superbadmedia.com.au");
    } finally {
      if (prevAbn !== undefined) process.env.SUPERBAD_ABN = prevAbn;
      if (prevEmail !== undefined) process.env.SUPERBAD_BILLING_EMAIL = prevEmail;
    }
  });
});
