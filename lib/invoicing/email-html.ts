/**
 * Shared HTML wrapper for Claude-drafted invoice emails. Paragraphs +
 * primary CTA button. Matches QB's visual treatment (SuperBad red, same
 * typography) but reads "View invoice →" — invoices are filing-cabinet
 * documents, not doorways to quotes.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

export function paragraphsToInvoiceHtml(
  paragraphs: string[],
  invoiceUrl: string,
  buttonLabel = "View invoice →",
): string {
  const escaped = paragraphs
    .map(
      (p) =>
        `<p style="margin: 0 0 18px; line-height: 1.65; color: #e8e0d0;">${escapeHtml(p)}</p>`,
    )
    .join("\n");
  return `<div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 560px;">
${escaped}
<p style="margin: 28px 0;"><a href="${escapeAttr(invoiceUrl)}" style="display: inline-block; padding: 14px 28px; background: #B22848; color: #FDF5E6; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">${escapeHtml(buttonLabel)}</a></p>
<p style="margin: 0; line-height: 1.55; color: rgba(253,245,230,0.5); font-size: 13px;">Andy<br/>SuperBad Marketing</p>
</div>`;
}
