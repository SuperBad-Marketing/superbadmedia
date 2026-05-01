/**
 * Opus prompt — `brand-dna-generate-signal-scores-intro`.
 *
 * Consumed by: `lib/brand-dna/generate-signal-scores-intro.ts`.
 *
 * Purpose: a 2-sentence intro framing the signal scores chart. Names the
 * top 3 signals and says what the pattern means for this person/brand.
 * Bridges the emotional first impression into the analytical bar chart.
 *
 * Voice: dry, perceptive, flat delivery. Same register as section insights.
 */

export type SignalScoresIntroInput = {
  subjectName: string;
  track: string;
  topSignals: Array<{ tag: string; frequency: number }>;
  industry?: string | null;
};

export function buildSignalScoresIntroPrompt(
  input: SignalScoresIntroInput,
): string {
  const { subjectName, track, topSignals, industry } = input;

  const top3 = topSignals
    .slice(0, 3)
    .map((s) => `${s.tag.replace(/_/g, " ")} (×${s.frequency})`)
    .join(", ");

  const fullList = topSignals
    .map((s) => `${s.tag.replace(/_/g, " ")} (×${s.frequency})`)
    .join(", ");

  const subject = track === "business" ? "the brand" : "the person";
  const businessLine = industry ? ` They operate in ${industry}.` : "";

  return `Write a 2-sentence intro for ${subjectName}'s signal scores chart.

The chart shows ranked signal strengths from their Brand DNA assessment. The top 3 signals are: ${top3}. Full ranked list: ${fullList}.${businessLine}

Your job: name the top 3 signals naturally (not as a list) and frame what the overall pattern says about ${subject}. What does it mean that these specific signals dominate?

Sentence 1: name the dominant signals conversationally.
Sentence 2: what the pattern tells you about how ${subject} operates.

Voice — non-negotiable:
- Flat delivery. Perceptive. Like stating a fact you noticed, not performing insight.
- No hedging ("seems like", "might be", "arguably", "perhaps").
- No self-reference ("I notice", "what stands out", "it's interesting").
- No marketing speak. Short sentences. Let it land.
- Write about ${subject}, not about the chart.

Output: exactly 2 sentences. Nothing else. No quotes, no labels, no preamble.`;
}
