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
        `<p style="margin: 0 0 16px; line-height: 1.55;">${escapeHtml(p)}</p>`,
    )
    .join("\n");
  return `<div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1a1a1a; max-width: 560px;">
${escaped}
<p style="margin: 24px 0;"><a href="${escapeAttr(invoiceUrl)}" style="display: inline-block; padding: 12px 20px; background: #c8312b; color: #fff5e6; text-decoration: none; border-radius: 4px; font-weight: 600;">${escapeHtml(buttonLabel)}</a></p>
<p style="margin: 0; line-height: 1.55;">Andy</p>
</div>`;
}
