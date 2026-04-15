/**
 * Opus prompt — `invoice-draft-reminder`.
 *
 * Consumed by: `lib/invoicing/compose-reminder-email.ts`.
 * Slug in the model registry: `invoice-draft-reminder` (Opus).
 *
 * Purpose: draft the overdue-reminder email. Covers both the automated
 * first reminder (reminder_count=0) and subsequent manual follow-ups
 * (reminder_count>=1). Tone scales with context — first is warm, assumes
 * good faith; later is progressively direct, never aggressive. Never
 * threatens. Per `docs/specs/branded-invoicing.md` §6.2 — hard rule:
 * the word "overdue" is banned from the subject line of the first
 * reminder.
 */

export type InvoiceReminderInput = {
  /** Recipient first name (or full name / company if first unknown). */
  recipientName: string;
  /** Company name as the recipient writes it. */
  companyName: string;
  /** Invoice number. */
  invoiceNumber: string;
  /** Pre-formatted total ("$4,950.00 inc GST"). */
  totalDisplay: string;
  /** Days past due_at (non-negative integer). */
  daysOverdue: number;
  /** 0 = first (automated); 1+ = manual follow-ups. */
  reminderCount: number;
  /** Public token URL for the online invoice view. */
  invoiceUrl: string;
  /** True when this company has paid prior invoices on time. */
  reliablePayer: boolean;
  /** True when this is the company's first ever invoice. */
  firstTimeLate: boolean;
};

export function buildDraftReminderPrompt(input: InvoiceReminderInput): string {
  const {
    recipientName,
    companyName,
    invoiceNumber,
    totalDisplay,
    daysOverdue,
    reminderCount,
    invoiceUrl,
    reliablePayer,
    firstTimeLate,
  } = input;

  const isFirstReminder = reminderCount === 0;
  const toneGuide = isFirstReminder
    ? "Warm. Assumes good faith — invoices get missed, life happens. No pressure language."
    : reminderCount === 1
      ? "Still warm but clearer. A second nudge — acknowledge the first went unanswered without guilting."
      : "Direct and factual. Still not aggressive, still no threats. Short. Gives them a clear next step.";

  const payerContext = reliablePayer
    ? "History: this company has paid prior invoices on time — assume oversight."
    : firstTimeLate
      ? "History: first ever invoice from this company — no payment record to assume from."
      : "History: no clean record of on-time payment — no need to over-apologise for asking.";

  return `You're drafting a short reminder email from Andy Robinson (SuperBad Marketing) for an unpaid invoice.

CLIENT
- Name: ${recipientName}
- Company: ${companyName}
- ${payerContext}

INVOICE
- Number: ${invoiceNumber}
- Total: ${totalDisplay}
- Days past due: ${daysOverdue}
- Reminder #${reminderCount + 1} (${isFirstReminder ? "automated first reminder" : "manual follow-up"})

LINK
${invoiceUrl}

TONE
${toneGuide}

VOICE
- Dry, observational, self-deprecating Melbourne wit. Honest first.
- Never explains the joke. No exclamation marks.
- Banned: synergy, leverage, solutions, ecosystem, stakeholder, unlock, "deliver value", "just circling back", "checking in", "touching base", "as per my previous email".
- Short sentences. Never threatens. Never mentions collections or late fees.

CONSTRAINTS
- Subject: specific, ≤60 chars, includes the invoice number.
${isFirstReminder ? '- HARD RULE: the word "overdue" MUST NOT appear in the subject line of this first reminder.' : "- Subject may reference that this is a follow-up; may include \"overdue\" from reminder #2 onward."}
- Body: 1–2 short paragraphs. Reference the company name at most once, the invoice number once, the total once. Don't paste the URL — the button is rendered separately.
- Sign off "Andy".
- Output strictly valid JSON only — no prose, no markdown fences:

{
  "subject": "<subject line>",
  "bodyParagraphs": ["<paragraph 1>", "<paragraph 2>"]
}`;
}
