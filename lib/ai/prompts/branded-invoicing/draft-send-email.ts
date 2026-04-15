/**
 * Opus prompt — `invoice-draft-send-email`.
 *
 * Consumed by: `lib/invoicing/compose-send-email.ts`.
 * Slug in the model registry: `invoice-draft-send-email` (Opus).
 *
 * Purpose: draft the email that accompanies a sent invoice. The PDF is
 * attached; the online view is the primary CTA. Email is short, warm,
 * professional — not a cover letter. Per `docs/specs/branded-invoicing.md`
 * §4.6 + §6.1 (drift-checked against SuperBad Brand DNA).
 */

export type InvoiceSendEmailInput = {
  /** Recipient first name (or full name / company if first unknown). */
  recipientName: string;
  /** Company name as the recipient writes it. */
  companyName: string;
  /** Invoice number (e.g. "SB-2026-0042"). */
  invoiceNumber: string;
  /** Pre-formatted total ("$4,950.00 inc GST"). */
  totalDisplay: string;
  /** Pre-formatted due date ("21 April 2026"). */
  dueDateDisplay: string;
  /** Cycle index — 0 = first / one-off; 1+ = ongoing retainer cycle. */
  cycleIndex: number | null;
  /** One-line scope summary (from the source quote). */
  scopeSummary: string | null;
  /** Public token URL for the online invoice view. */
  invoiceUrl: string;
  /** True when this company has paid at least one previous invoice. */
  hasPaymentHistory: boolean;
};

export function buildDraftSendEmailPrompt(input: InvoiceSendEmailInput): string {
  const {
    recipientName,
    companyName,
    invoiceNumber,
    totalDisplay,
    dueDateDisplay,
    cycleIndex,
    scopeSummary,
    invoiceUrl,
    hasPaymentHistory,
  } = input;

  const cycleLine =
    cycleIndex == null || cycleIndex === 0
      ? "First invoice for this engagement."
      : `Ongoing retainer — cycle ${cycleIndex + 1}.`;

  return `You're drafting a short email from Andy Robinson (SuperBad Marketing) to a client whose invoice is ready. The PDF is attached; the online-view link is the primary CTA.

CLIENT
- Name: ${recipientName}
- Company: ${companyName}
- Payment history: ${hasPaymentHistory ? "previous invoice paid" : "first invoice for this company"}

INVOICE
- Number: ${invoiceNumber}
- Total: ${totalDisplay}
- Due: ${dueDateDisplay}
- ${cycleLine}
${scopeSummary ? `- Scope in one line: ${scopeSummary}` : ""}

LINK
${invoiceUrl}

VOICE
- Dry, observational, self-deprecating Melbourne wit. Honest first.
- Never explains the joke. No exclamation marks.
- Banned: synergy, leverage, solutions, ecosystem, stakeholder, unlock, "deliver value", "please find attached".
- Short sentences. Warm but brief — not a cover letter.

CONSTRAINTS
- Subject: specific, ≤60 chars, includes the invoice number. Never generic ("Invoice attached", "Your invoice").
- Body: 1–3 short paragraphs. Reference the company name at most once, the invoice number once, the total + due date together once. Don't mention the PDF attachment; the mail client handles that. Don't paste the URL — the button is rendered separately.
- Sign off "Andy".
- Output strictly valid JSON only — no prose, no markdown fences:

{
  "subject": "<subject line>",
  "bodyParagraphs": ["<paragraph 1>", "<paragraph 2>", "..."]
}`;
}
