/**
 * Opus prompt — `brand-dna-generate-long-tail-summary`.
 *
 * Consumed by: `lib/brand-dna/generate-long-tail-summary.ts`.
 *
 * Purpose: a single sentence tying together the below-threshold signal tags
 * into a coherent observation instead of dumping them as a comma list.
 *
 * Voice: dry, perceptive, flat delivery. Same register as the signal scores intro.
 */

export type LongTailSummaryInput = {
  subjectName: string;
  longTailTags: string[];
  topSignalNames: string[];
};

export function buildLongTailSummaryPrompt(
  input: LongTailSummaryInput,
): string {
  const { subjectName, longTailTags, topSignalNames } = input;

  const longTailFormatted = longTailTags
    .map((t) => t.replace(/_/g, " "))
    .join(", ");

  const topFormatted = topSignalNames
    .slice(0, 3)
    .map((t) => t.replace(/_/g, " "))
    .join(", ");

  return `Write exactly 1 sentence about ${subjectName}'s quieter Brand DNA signals.

Their dominant signals (already covered above): ${topFormatted}.
Their quieter signals (below the threshold, still present): ${longTailFormatted}.

Your job: tie the quieter signals together into one observation. What do these background signals say about the brand that the dominant ones don't? These are the undertones, not the headline.

Voice — non-negotiable:
- Flat delivery. Perceptive. Like noticing something in the background that most people miss.
- No hedging ("seems like", "might be", "arguably", "perhaps").
- No self-reference ("I notice", "what stands out", "it's interesting").
- No marketing speak. No compliments. Just observation.
- Do not list the signals by name. Synthesise them into a single thought.

Output: exactly 1 sentence. Nothing else. No quotes, no labels, no preamble.`;
}
