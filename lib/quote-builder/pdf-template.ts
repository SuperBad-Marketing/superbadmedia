import type { QuoteRow } from "@/lib/db/schema/quotes";
import type { CompanyRow } from "@/lib/db/schema/companies";
import type { ContactRow } from "@/lib/db/schema/contacts";
import type { QuoteContent } from "./content-shape";

/**
 * Pure HTML builder for the §4.4 client-facing PDF. Self-contained inline
 * `<style>`, no external assets, A4 portrait. Brand cream background,
 * charcoal text, brand red accent on the CTA. Typography degrades to
 * system serifs/sans where the named families aren't installed in the
 * print Chrome — the layout still reads.
 *
 * Renderer in `lib/pdf/render.ts` consumes the string. Filename helper
 * is exported separately so route handlers + email attachments format
 * the same `SuperBad-Quote-{slug}-{number}.pdf` shape.
 */

export interface QuotePdfTemplateInput {
  quote: QuoteRow;
  company: CompanyRow;
  primaryContact: ContactRow | null;
  content: QuoteContent;
  /** Public quote URL (token link) — printed + linked. */
  quoteUrl: string;
  /** Optional Claude-drafted Playfair italic cover line. */
  coverLine?: string | null;
  /** Optional ≤140-char Claude-drafted scope summary. */
  scopeSummary?: string | null;
  /** Terms link URL (printed for paper). */
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

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** kebab-case the company name for filename slugs. */
export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "client";
}

/** `SuperBad-Quote-{slug}-{quote-number}.pdf` per spec §4.4. */
export function quotePdfFilename(company: CompanyRow, quote: QuoteRow): string {
  return `SuperBad-Quote-${companySlug(company.name)}-${quote.quote_number}.pdf`;
}

export function buildQuotePdfHtml(input: QuotePdfTemplateInput): string {
  const { quote, company, primaryContact, content, quoteUrl, coverLine, scopeSummary, termsUrl } = input;

  const retainer = quote.retainer_monthly_cents_inc_gst ?? 0;
  const oneOff = quote.one_off_cents_inc_gst ?? 0;
  const lineItems = content.sections.whatWellDo.line_items;

  const lineRows = lineItems
    .map((l) => {
      const lineTotal = l.qty * l.unit_price_cents_inc_gst;
      const unitLabel = l.kind === "retainer" ? `${l.snapshot.unit} / mo` : l.snapshot.unit;
      return `<tr>
  <td class="li-name">${escapeHtml(l.snapshot.name || "—")}</td>
  <td class="li-qty">${l.qty}</td>
  <td class="li-unit">${escapeHtml(unitLabel)}</td>
  <td class="li-price">${moneyAud(l.qty * l.unit_price_cents_inc_gst)}</td>
</tr>`;
    })
    .join("\n");

  const totalDisplay = (() => {
    if (quote.structure === "retainer") return `${moneyAud(retainer)} / month inc GST`;
    if (quote.structure === "project") return `${moneyAud(oneOff)} inc GST`;
    return `${moneyAud(retainer)} / month <span class="plus">+</span> ${moneyAud(oneOff)} one-off, inc GST`;
  })();

  const termLine = (() => {
    if (quote.structure === "project") return null;
    return quote.term_length_months
      ? `${quote.term_length_months}-month honour-based commitment — cancel any time from your account.`
      : `Honour-based commitment — cancel any time from your account.`;
  })();

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
<title>${escapeHtml(quote.quote_number)} — SuperBad</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #faf6ef; color: #1a1a1a; font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 22mm 20mm; max-width: 210mm; box-sizing: border-box; }
  .masthead { font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 22pt; letter-spacing: 0.04em; line-height: 1; color: #1a1a1a; }
  .masthead-sub { margin-top: 4px; font-size: 8pt; letter-spacing: 0.22em; text-transform: uppercase; color: #6b6b6b; }
  .meta { margin-top: 18pt; display: flex; justify-content: space-between; gap: 24pt; font-size: 9pt; color: #4a4a4a; }
  .meta .label { display: block; font-size: 7.5pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 2pt; }
  .client { margin-top: 22pt; }
  .client-name { font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 16pt; line-height: 1.1; }
  .client-meta { margin-top: 4pt; font-size: 9pt; color: #6b6b6b; }
  .scope { margin-top: 18pt; padding: 12pt 14pt; background: rgba(193, 32, 45, 0.05); border-left: 2pt solid #c1202d; font-size: 10.5pt; line-height: 1.45; }
  table.lineitems { width: 100%; border-collapse: collapse; margin-top: 18pt; font-size: 10pt; }
  table.lineitems th { text-align: left; padding: 6pt 8pt; border-bottom: 1pt solid #1a1a1a; font-size: 8pt; letter-spacing: 0.15em; text-transform: uppercase; color: #6b6b6b; font-weight: 500; }
  table.lineitems td { padding: 8pt; border-bottom: 1pt solid #e6dfd1; vertical-align: top; }
  td.li-qty, th.li-qty-h { text-align: right; width: 12mm; font-variant-numeric: tabular-nums; }
  td.li-unit, th.li-unit-h { width: 30mm; color: #6b6b6b; }
  td.li-price, th.li-price-h { text-align: right; width: 30mm; font-variant-numeric: tabular-nums; }
  .total { margin-top: 16pt; text-align: right; }
  .total .label { font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #6b6b6b; }
  .total .value { display: block; margin-top: 4pt; font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 22pt; line-height: 1; color: #1a1a1a; }
  .total .value .plus { color: #6b6b6b; font-weight: 400; padding: 0 4pt; }
  .term-line { margin-top: 14pt; font-size: 9.5pt; color: #4a4a4a; }
  .cover-line { margin-top: 22pt; font-family: "Playfair Display", Georgia, serif; font-style: italic; font-size: 12pt; color: #4a4a4a; line-height: 1.4; }
  .accept { margin-top: 24pt; padding: 14pt 16pt; background: #1a1a1a; color: #faf6ef; border-radius: 3pt; }
  .accept .cta { font-family: "Black Han Sans", "Impact", system-ui, sans-serif; font-size: 13pt; letter-spacing: 0.04em; }
  .accept .url { display: block; margin-top: 6pt; font-size: 8.5pt; color: #faf6ef; opacity: 0.85; word-break: break-all; }
  .accept .cta .arrow { color: #c1202d; }
  .footer { margin-top: 18pt; font-size: 8pt; color: #8a8a8a; }
  .footer a { color: #8a8a8a; }
</style>
</head>
<body>
<div class="page">
  <div class="masthead">SUPERBAD</div>
  <div class="masthead-sub">SuperBad Marketing · Melbourne</div>

  <div class="meta">
    <div><span class="label">Quote</span>${escapeHtml(quote.quote_number)}</div>
    <div><span class="label">Issued</span>${escapeHtml(formatDate(quote.created_at_ms))}</div>
    <div><span class="label">Expires</span>${escapeHtml(formatDate(quote.expires_at_ms))}</div>
  </div>

  <div class="client">
    <div class="client-name">${escapeHtml(company.name)}</div>
    ${abnLine ? `<div class="client-meta">${abnLine}</div>` : ""}
    ${contactLine ? `<div class="client-meta">${contactLine}</div>` : ""}
  </div>

  ${scopeSummary ? `<div class="scope">${escapeHtml(scopeSummary)}</div>` : ""}

  <table class="lineitems">
    <thead>
      <tr>
        <th>Item</th>
        <th class="li-qty-h">Qty</th>
        <th class="li-unit-h">Unit</th>
        <th class="li-price-h">Inc GST</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows || `<tr><td colspan="4" style="color:#8a8a8a; font-style: italic;">No line items.</td></tr>`}
    </tbody>
  </table>

  <div class="total">
    <span class="label">Total</span>
    <span class="value">${totalDisplay}</span>
  </div>

  ${termLine ? `<div class="term-line">${escapeHtml(termLine)}</div>` : ""}

  ${coverLine ? `<div class="cover-line">${escapeHtml(coverLine)}</div>` : ""}

  <div class="accept">
    <div class="cta">Accept online <span class="arrow">→</span></div>
    <a class="url" href="${escapeHtml(quoteUrl)}">${escapeHtml(quoteUrl)}</a>
  </div>

  <div class="footer">
    Standard terms apply. Read them at <a href="${escapeHtml(termsUrl)}">${escapeHtml(termsUrl)}</a>.
  </div>
</div>
</body>
</html>`;
}
