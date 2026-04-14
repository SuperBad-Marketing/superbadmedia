/**
 * Opus prompt — `quote-builder-draft-send-email`.
 *
 * Consumed by: `lib/quote-builder/compose-send-email.ts`.
 * Slug in the model registry: `quote-builder-draft-send-email` (Opus).
 *
 * Purpose: draft the email Andy sends a client when their quote is ready.
 * Short, human, specific. The quote does the talking — the email is the
 * doorway. One primary CTA: open the quote.
 *
 * Voice: dry, observational, never sales-y. SuperBad voice end to end.
 * Per `docs/specs/quote-builder.md` §3.2.1 + §4.2 (drift-checked against
 * Brand DNA + Client Context per memories `project_brand_dna_as_perpetual
 * _context` and `project_two_perpetual_contexts`).
 */

export type QuoteSendEmailInput = {
  /** Recipient first name (or full name if first unknown). */
  recipientName: string;
  /** Company name as the recipient writes it. */
  companyName: string;
  /** Headline structure of the quote — drives the framing line. */
  structure: "retainer" | "project" | "mixed";
  /** Pre-formatted total ("$4,950 inc GST" / "$1,200/mo + $2,400 one-off"). */
  totalDisplay: string;
  /** Term-length suffix (e.g. "6-month commitment"), null for project-only. */
  termLine: string | null;
  /** One-line scope summary (Claude-drafted, ≤140 chars). */
  scopeSummary: string;
  /** Quote URL (the token link). */
  quoteUrl: string;
  /** Optional thread anchor — last meaningful note from the discovery call. */
  contextSnippet: string | null;
};

/** Build the user-facing instruction prompt. */
export function buildDraftSendEmailPrompt(input: QuoteSendEmailInput): string {
  const {
    recipientName,
    companyName,
    structure,
    totalDisplay,
    termLine,
    scopeSummary,
    quoteUrl,
    contextSnippet,
  } = input;

  return `You're drafting a short email from Andy Robinson (SuperBad Marketing) to a client whose quote is ready to read.

CLIENT
- Name: ${recipientName}
- Company: ${companyName}
- Quote shape: ${structure}${termLine ? ` (${termLine})` : ""}
- Headline: ${totalDisplay}
- Scope in one line: ${scopeSummary}
${contextSnippet ? `- Last meaningful note from the discovery call: ${contextSnippet}` : ""}

LINK
${quoteUrl}

VOICE
- Dry, observational, self-deprecating Melbourne wit.
- Honest first. Never explains the joke.
- Banned: synergy, leverage, solutions, ecosystem, stakeholder, unlock, "deliver value".
- Short sentences. Leave room for the mutter.
- Never use exclamation marks.

CONSTRAINTS
- Subject line: specific, ≤55 chars, never "Your quote".
- Body: 2–4 short paragraphs. Reference the company by name once, the discovery context once, the quote URL once. The button label is "Read your quote →" — your job is the surrounding copy, not the CTA itself.
- Sign off "Andy".
- Output strictly valid JSON only — no prose, no markdown fences:

{
  "subject": "<subject line>",
  "bodyParagraphs": ["<paragraph 1>", "<paragraph 2>", "..."]
}`;
}
