/**
 * Haiku prompt — `invoice-draft-supersede-notification`.
 *
 * Consumed by: `lib/invoicing/compose-supersede-email.ts`.
 * Slug in the model registry: `invoice-draft-supersede-notification` (Haiku).
 *
 * Purpose: short, functional notification email sent when a previously
 * dispatched invoice is superseded by a new one. Per
 * `docs/specs/branded-invoicing.md` §6.3 — no drift-check needed; one
 * paragraph max.
 */

export type InvoiceSupersedeInput = {
  recipientName: string;
  companyName: string;
  previousInvoiceNumber: string;
  newInvoiceNumber: string;
  /** Pre-formatted total of the new invoice ("$4,950.00 inc GST"). */
  newTotalDisplay: string;
  /** Public token URL for the replacement invoice. */
  newInvoiceUrl: string;
};

export function buildDraftSupersedeNotificationPrompt(
  input: InvoiceSupersedeInput,
): string {
  const {
    recipientName,
    companyName,
    previousInvoiceNumber,
    newInvoiceNumber,
    newTotalDisplay,
  } = input;

  return `You're drafting a very short, functional notification email from Andy Robinson (SuperBad Marketing). The previously sent invoice has been replaced by an updated one. The client should understand: ignore the old one, use the new one.

CLIENT
- Name: ${recipientName}
- Company: ${companyName}

CHANGE
- Previous invoice number: ${previousInvoiceNumber}
- Replacement invoice number: ${newInvoiceNumber}
- Replacement total: ${newTotalDisplay}

VOICE
- Plain, functional, brief.
- No exclamation marks. No hedging. No apology theatre.

CONSTRAINTS
- Subject: ≤60 chars. Must reference that the invoice was updated. Includes the new invoice number.
- Body: ONE paragraph, 2 sentences max. Reference both invoice numbers. Don't paste any URL.
- Sign off "Andy".
- Output strictly valid JSON only — no prose, no markdown fences:

{
  "subject": "<subject line>",
  "bodyParagraphs": ["<one paragraph>"]
}`;
}
