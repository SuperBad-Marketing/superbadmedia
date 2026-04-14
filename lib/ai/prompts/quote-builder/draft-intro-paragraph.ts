/**
 * Opus prompt — `quote-builder-draft-intro-paragraph`.
 *
 * Consumed by: `lib/quote-builder/compose-intro-paragraph.ts`.
 * Slug in the model registry: `quote-builder-draft-intro-paragraph` (Opus).
 *
 * Purpose: synthesise the `What you told us` paragraph via pyramid
 * source-rank weighting per memory `feedback_client_doc_source_hierarchy`:
 *   rank 1 — client-supplied docs
 *   rank 2 — direct notes on the deal
 *   rank 3 — activity log (meeting notes, reply excerpts)
 *   rank 4 — Brand DNA + Client Context Engine
 * Higher rank wins on conflict. Rank-4-only → confidence: low + flag.
 *
 * Voice: dry, observational, specific. Never invents facts.
 */

export type IntroParagraphSource = {
  rank: 1 | 2 | 3 | 4;
  label: string;
  text: string;
};

export type DraftIntroParagraphInput = {
  companyName: string;
  sources: IntroParagraphSource[];
  freeformInstruction?: string | null;
};

export type DraftIntroParagraphOutput = {
  paragraph_text: string;
  primary_source_rank: 1 | 2 | 3 | 4;
  drew_from_ranks: (1 | 2 | 3 | 4)[];
  confidence: "high" | "medium" | "low";
  flags_json: Record<string, string>;
};

export function buildDraftIntroParagraphPrompt(
  input: DraftIntroParagraphInput,
): string {
  const sourceBlock =
    input.sources.length === 0
      ? "(no sources — do NOT generate; return empty paragraph)"
      : input.sources
          .map(
            (s) =>
              `[rank ${s.rank} — ${s.label}]\n${s.text.trim().slice(0, 2000)}`,
          )
          .join("\n\n");

  return `You're drafting the "What you told us" section of a SuperBad Marketing quote for ${input.companyName}. This paragraph frames the whole quote in the client's own context.

SOURCE MATERIAL (higher rank wins on conflict):
${sourceBlock}

${input.freeformInstruction ? `OPERATOR INSTRUCTION: ${input.freeformInstruction}\n\n` : ""}VOICE
- Dry, observational, self-deprecating Melbourne wit. Honest first.
- Banned: synergy, leverage, solutions, ecosystem, stakeholder, unlock, "deliver value".
- No greeting, sign-off, "we" or "our". Write as if reflecting what the client themselves said.
- Short sentences. Never filler. Never generic openers.

HARD RULES
- Rank 1 wins any conflict. Rank 4 alone → confidence: low + flag "rank_4_only": "true".
- Never invent specifics not present in the sources.
- Target ~80 words, hard cap 120.
- If all sources are empty, return paragraph_text="" and confidence: low.

OUTPUT — strictly valid JSON only, no prose, no markdown fences:

{
  "paragraph_text": "<≤120 words>",
  "primary_source_rank": <1|2|3|4>,
  "drew_from_ranks": [<1|2|3|4>, ...],
  "confidence": "high" | "medium" | "low",
  "flags_json": { "<key>": "<value>" }
}`;
}
