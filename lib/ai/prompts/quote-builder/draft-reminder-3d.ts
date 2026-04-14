/**
 * Opus prompt — `quote-builder-draft-reminder-3d`.
 *
 * Consumed by: `lib/quote-builder/compose-reminder-email.ts`.
 * Slug in the model registry: `quote-builder-draft-reminder-3d` (Opus).
 *
 * Purpose: draft the 3-day nudge email sent when a client has not yet
 * opened their quote. Not pushy. Not templated. One short paragraph, one
 * doorway — the quote link.
 *
 * Voice: dry, observational, never sales-y. SuperBad voice end to end.
 * Per `docs/specs/quote-builder.md` §8.3 + memory
 * `feedback_outreach_never_templated` (every email drafted end-to-end per
 * recipient — no variable templates).
 */

export type QuoteReminder3dInput = {
  /** Recipient first name (or full name if first unknown). */
  recipientName: string;
  /** Company name as the recipient writes it. */
  companyName: string;
  /** Quote URL (the token link). */
  quoteUrl: string;
  /** Days since the quote was sent (integer, typically 3). */
  daysSinceSent: number;
  /** Optional context snippet from the original discovery call — keeps the nudge anchored. */
  contextSnippet: string | null;
};

/** Build the user-facing instruction prompt. */
export function buildDraftReminder3dPrompt(input: QuoteReminder3dInput): string {
  const {
    recipientName,
    companyName,
    quoteUrl,
    daysSinceSent,
    contextSnippet,
  } = input;

  return `You're drafting a short nudge email from Andy Robinson (SuperBad Marketing) to a client whose quote has been sitting unread for ${daysSinceSent} days.

CLIENT
- Name: ${recipientName}
- Company: ${companyName}
- Days since quote sent: ${daysSinceSent}
${contextSnippet ? `- Last meaningful note from the discovery call: ${contextSnippet}` : ""}

LINK
${quoteUrl}

VOICE
- Dry, observational, self-deprecating Melbourne wit.
- Honest first. Never explains the joke.
- Banned: synergy, leverage, solutions, ecosystem, stakeholder, unlock, "deliver value", "just circling back", "checking in", "touching base".
- Short sentences. Leave room for the mutter.
- Never use exclamation marks.
- Not pushy. Not needy. Assumes life happened.

CONSTRAINTS
- Subject line: specific, ≤55 chars, never "Following up" or "Quote reminder".
- Body: 1–2 short paragraphs. Reference the company name once, the quote URL once. The button label is "Read your quote →" — your job is the surrounding copy, not the CTA itself.
- Sign off "Andy".
- Output strictly valid JSON only — no prose, no markdown fences:

{
  "subject": "<subject line>",
  "bodyParagraphs": ["<paragraph 1>", "<paragraph 2>"]
}`;
}
