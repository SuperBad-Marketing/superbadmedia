/**
 * Expiry notice — static copy per spec §8.3.
 *
 * Not LLM-drafted. Expiry is a deterministic lifecycle event; the email
 * is a link-only dry note, not a sales touch. Keeps the channel honest
 * and saves an LLM call per expiry.
 *
 * Voice: dry, warm, not demanding. No "act now" urgency. Per memory
 * `superbad-brand-voice` and `feedback_earned_ctas_at_transition_moments`
 * — expiry is a wind-down moment, proportional soft CTA earned.
 */

export interface QuoteExpiredEmailInput {
  recipientName: string;
  companyName: string;
  /** Not a live URL anymore — but the page will render an "expired" state. */
  quoteUrl: string;
}

export function buildQuoteExpiredEmail(input: QuoteExpiredEmailInput): {
  subject: string;
  bodyParagraphs: string[];
  bodyHtml: string;
} {
  const { recipientName, companyName, quoteUrl } = input;
  const firstName = recipientName.split(/\s+/)[0] ?? recipientName;

  const subject = `${companyName} — your quote's lapsed`;
  const bodyParagraphs = [
    `${firstName}, the quote we put together for ${companyName} hit its expiry date and closed out.`,
    `If the timing's wrong, no harm done. If it's still on the cards, reply to this email and we'll put something fresh together — usually the shape shifts a little anyway.`,
    `Andy`,
  ];
  const bodyHtml = `<div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1a1a1a; max-width: 560px;">
${bodyParagraphs
  .map(
    (p) => `<p style="margin: 0 0 16px; line-height: 1.55;">${escapeHtml(p)}</p>`,
  )
  .join("\n")}
<p style="margin: 24px 0 0; font-size: 13px; color: #666;">The original quote link: <a href="${escapeAttr(quoteUrl)}" style="color: #666;">${escapeHtml(quoteUrl)}</a></p>
</div>`;

  return { subject, bodyParagraphs, bodyHtml };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
