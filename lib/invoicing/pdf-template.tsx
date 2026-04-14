import type { InvoiceRow, InvoiceLineItem } from "@/lib/db/schema/invoices";
import type { CompanyRow } from "@/lib/db/schema/companies";
import type { ContactRow } from "@/lib/db/schema/contacts";
import { companySlug } from "@/lib/quote-builder/pdf-template";

/**
 * ATO-compliant tax invoice PDF template (BI-1b). Mirrors the Quote
 * Builder template's visual language — cream background, charcoal text,
 * brand red accent — and adds the ATO-required "Tax Invoice" title,
 * supplier block, itemised GST totals, and payment instructions.
 *
 * Admin compose/edit surfaces, Stripe payment element, and the scroll-
 * snap branded web experience land in BI-2. This template serves both
 * the unpaid and paid PDF variants (paid adds a watermark + payment
 * date; totals block unchanged per spec §4.5).
 */

export interface InvoicePdfTemplateInput {
  invoice: InvoiceRow;
  company: CompanyRow;
  primaryContact: ContactRow | null;
  /** Public invoice URL (token link). */
  invoiceUrl: string;
  /** Original-proposal link to render under totals. Null if no source quote. */
  quoteUrl: string | null;
  /** Terms link URL. */
  termsUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyAud(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function invoicePdfFilename(
  company: CompanyRow,
  invoice: InvoiceRow,
): string {
  return `SuperBad-Invoice-${companySlug(company.name)}-${invoice.invoice_number}.pdf`;
}

/** Supplier block — SuperBad Media Pty Ltd. ABN read from env with fallback. */
export interface SupplierProfile {
  name: string;
  abn: string;
  email: string;
}

export function defaultSupplier(): SupplierProfile {
  return {
    name: "SuperBad Media Pty Ltd",
    abn: process.env.SUPERBAD_ABN ?? "ABN to confirm",
    email: process.env.SUPERBAD_BILLING_EMAIL ?? "hi@superbadmedia.com.au",
  };
}

export function buildInvoicePdfHtml(input: InvoicePdfTemplateInput): string {
  const { invoice, company, primaryContact, invoiceUrl, quoteUrl, termsUrl } = input;
  const supplier = defaultSupplier();

  const lineItems = (invoice.line_items_json ?? []) as InvoiceLineItem[];
  const lineRows = lineItems
    .map(
      (l) => `<tr>
  <td class="li-name">${escapeHtml(l.description || "—")}</td>
  <td class="li-qty">${l.quantity}</td>
  <td class="li-price">${moneyAud(l.unit_price_cents_inc_gst)}</td>
  <td class="li-total">${moneyAud(l.line_total_cents_inc_gst)}</td>
</tr>`,
    )
    .join("\n");

  const gstApplicable = invoice.gst_applicable;
  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";
  const isVoid = invoice.status === "void";

  const abnLine = company.abn ? `ABN ${escapeHtml(company.abn)}` : null;
  const contactLine = primaryContact
    ? [primaryContact.name, primaryContact.email]
        .filter((v): v is string => Boolean(v))
        .map(escapeHtml)
        .join(" · ")
    : null;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(invoice.invoice_number)} — Tax Invoice — SuperBad</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #faf6ef; color: #1a1a1a; font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 22mm 20mm; max-width: 210mm; box-sizing: border-box; position: relative; }
  .masthead { font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 22pt; letter-spacing: 0.04em; line-height: 1; color: #1a1a1a; }
  .masthead-sub { margin-top: 4px; font-size: 8pt; letter-spacing: 0.22em; text-transform: uppercase; color: #6b6b6b; }
  .doc-title { margin-top: 14pt; font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 15pt; letter-spacing: 0.05em; text-transform: uppercase; color: #c1202d; }
  .meta { margin-top: 14pt; display: flex; gap: 22pt; font-size: 9pt; color: #4a4a4a; flex-wrap: wrap; }
  .meta .label { display: block; font-size: 7.5pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 2pt; }
  .parties { margin-top: 20pt; display: flex; gap: 28pt; }
  .party { flex: 1; font-size: 9.5pt; line-height: 1.4; }
  .party .label { font-size: 7.5pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 4pt; }
  .party .name { font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 13pt; line-height: 1.15; margin-bottom: 4pt; }
  .party .meta-line { font-size: 9pt; color: #6b6b6b; }
  table.lineitems { width: 100%; border-collapse: collapse; margin-top: 20pt; font-size: 10pt; }
  table.lineitems th { text-align: left; padding: 6pt 8pt; border-bottom: 1pt solid #1a1a1a; font-size: 8pt; letter-spacing: 0.15em; text-transform: uppercase; color: #6b6b6b; font-weight: 500; }
  table.lineitems td { padding: 8pt; border-bottom: 1pt solid #e6dfd1; vertical-align: top; }
  td.li-qty, th.li-qty-h { text-align: right; width: 14mm; font-variant-numeric: tabular-nums; }
  td.li-price, th.li-price-h, td.li-total, th.li-total-h { text-align: right; width: 28mm; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16pt; margin-left: auto; width: 65mm; font-size: 10pt; }
  .totals .row { display: flex; justify-content: space-between; padding: 4pt 0; color: #4a4a4a; }
  .totals .row.grand { margin-top: 6pt; padding-top: 8pt; border-top: 1pt solid #1a1a1a; color: #1a1a1a; }
  .totals .row.grand .label { font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #6b6b6b; }
  .totals .row.grand .value { font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 18pt; line-height: 1; }
  .totals .row.no-gst { font-size: 8.5pt; color: #8a8a8a; font-style: italic; }
  .banner { margin-top: 18pt; padding: 10pt 12pt; font-size: 9.5pt; border-radius: 3pt; }
  .banner.overdue { background: rgba(193, 32, 45, 0.08); color: #c1202d; border-left: 2pt solid #c1202d; }
  .banner.void { background: #efe9dd; color: #6b6b6b; border-left: 2pt solid #8a8a8a; }
  .pay { margin-top: 22pt; padding: 14pt 16pt; background: #1a1a1a; color: #faf6ef; border-radius: 3pt; }
  .pay .label { font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(250, 246, 239, 0.65); }
  .pay .cta { margin-top: 4pt; font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 12pt; letter-spacing: 0.04em; }
  .pay .url { display: block; margin-top: 6pt; font-size: 8.5pt; color: #faf6ef; opacity: 0.85; word-break: break-all; }
  .pay .arrow { color: #c1202d; }
  .secondary-link { margin-top: 14pt; font-size: 9pt; color: #4a4a4a; }
  .secondary-link a { color: #c1202d; text-decoration: none; }
  .footer { margin-top: 22pt; font-size: 8pt; color: #8a8a8a; line-height: 1.5; }
  .footer a { color: #8a8a8a; }
  .paid-stamp { position: absolute; top: 34mm; right: 20mm; transform: rotate(-14deg); border: 3pt solid #2f8f5a; color: #2f8f5a; padding: 8pt 14pt; font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 20pt; letter-spacing: 0.08em; opacity: 0.88; }
  .paid-stamp .date { display: block; font-size: 8pt; letter-spacing: 0.15em; color: #2f8f5a; margin-top: 2pt; font-family: "DM Sans", system-ui, sans-serif; }
</style>
</head>
<body>
<div class="page">
  ${
    isPaid
      ? `<div class="paid-stamp">PAID<span class="date">${escapeHtml(formatDate(invoice.paid_at_ms))}</span></div>`
      : ""
  }

  <div class="masthead">SUPERBAD</div>
  <div class="masthead-sub">SuperBad Marketing · Melbourne</div>

  <div class="doc-title">Tax Invoice</div>

  <div class="meta">
    <div><span class="label">Invoice</span>${escapeHtml(invoice.invoice_number)}</div>
    <div><span class="label">Issued</span>${escapeHtml(formatDate(invoice.issue_date_ms))}</div>
    <div><span class="label">Due</span>${escapeHtml(formatDate(invoice.due_at_ms))}</div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="label">Billed to</div>
      <div class="name">${escapeHtml(company.name)}</div>
      ${abnLine ? `<div class="meta-line">${abnLine}</div>` : ""}
      ${contactLine ? `<div class="meta-line">${contactLine}</div>` : ""}
    </div>
    <div class="party">
      <div class="label">From</div>
      <div class="name">${escapeHtml(supplier.name)}</div>
      <div class="meta-line">ABN ${escapeHtml(supplier.abn)}</div>
      <div class="meta-line">${escapeHtml(supplier.email)}</div>
    </div>
  </div>

  ${invoice.scope_summary ? `<div class="banner" style="background: rgba(193, 32, 45, 0.05); border-left: 2pt solid #c1202d; color: #4a4a4a;">${escapeHtml(invoice.scope_summary)}</div>` : ""}

  <table class="lineitems">
    <thead>
      <tr>
        <th>Description</th>
        <th class="li-qty-h">Qty</th>
        <th class="li-price-h">Unit inc GST</th>
        <th class="li-total-h">Line total</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows || `<tr><td colspan="4" style="color:#8a8a8a; font-style: italic;">No line items.</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    ${
      gstApplicable
        ? `<div class="row"><span>Subtotal (ex GST)</span><span>${moneyAud(invoice.total_cents_ex_gst)}</span></div>
           <div class="row"><span>GST (10%)</span><span>${moneyAud(invoice.gst_cents)}</span></div>`
        : `<div class="row no-gst"><span>GST not applicable</span><span></span></div>`
    }
    <div class="row grand"><span class="label">Total inc GST</span><span class="value">${moneyAud(invoice.total_cents_inc_gst)}</span></div>
  </div>

  ${
    isOverdue
      ? `<div class="banner overdue">This invoice is overdue.</div>`
      : ""
  }
  ${
    isVoid
      ? `<div class="banner void">This invoice has been voided.</div>`
      : ""
  }

  ${
    !isPaid && !isVoid
      ? `<div class="pay">
           <div class="label">Pay online</div>
           <div class="cta">View &amp; pay <span class="arrow">→</span></div>
           <a class="url" href="${escapeHtml(invoiceUrl)}">${escapeHtml(invoiceUrl)}</a>
         </div>`
      : ""
  }

  ${
    quoteUrl
      ? `<div class="secondary-link">View the original proposal → <a href="${escapeHtml(quoteUrl)}">${escapeHtml(quoteUrl)}</a></div>`
      : ""
  }

  <div class="footer">
    Tax invoice issued by ${escapeHtml(supplier.name)}. Standard terms apply — read them at <a href="${escapeHtml(termsUrl)}">${escapeHtml(termsUrl)}</a>.
  </div>
</div>
</body>
</html>`;
}
