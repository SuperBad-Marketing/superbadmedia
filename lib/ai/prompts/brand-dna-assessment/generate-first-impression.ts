/**
 * Opus prompt — `brand-dna-generate-first-impression`.
 *
 * Consumed by: `lib/brand-dna/generate-first-impression.ts`.
 * Slug in the model registry: `brand-dna-generate-first-impression` (Opus).
 *
 * Purpose: the sharpest, most irreducible 2–3 sentences Claude can say about
 * this person or brand. Not a summary of the portrait — a stand-alone insight
 * that could be dropped on a blank page and still land. The emotional peak of
 * the reveal.
 *
 * Voice: dry, perceptive, flat delivery. Admin-roommate register. Never
 * "I notice that…" or "it's interesting how…" — just the observation, stated.
 *
 * Per `docs/specs/brand-dna-assessment.md` §6.3 + §9. The full content
 * calibration lives in the Brand DNA content mini-session (post-BDA-3).
 */

export type FirstImpressionInput = {
  subjectName: string;
  track: string;
  shape: string | null;
  tagFrequencyMap: Record<string, number>;
  reflectionText: string | null;
  sectionInsights: string[];
};

/**
 * Compose the Opus prompt for first-impression generation.
 *
 * Inputs are aggregated by the caller (`lib/brand-dna/generate-first-impression.ts`)
 * which reads `brand_dna_answers` and `brand_dna_profiles` before calling this.
 */
export function buildFirstImpressionPrompt(input: FirstImpressionInput): string {
  const {
    subjectName,
    track,
    shape,
    tagFrequencyMap,
    reflectionText,
    sectionInsights,
  } = input;

  const topTags = Object.entries(tagFrequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, freq]) => `${tag} (×${freq})`)
    .join(", ");

  const insightsBlock = sectionInsights.length
    ? sectionInsights
        .map((text, i) => `Section ${i + 1}: ${text}`)
        .join("\n")
    : "(no between-section insights captured)";

  const reflectionBlock = reflectionText
    ? `Their reflection: "${reflectionText}"`
    : "(no free-form reflection provided)";

  const shapeLine = shape ? `Shape: ${shape}.` : "";

  return `You're writing the opening two or three sentences of a Brand DNA reveal for ${subjectName}.

Track: ${track}. ${shapeLine}
Strongest signal tags across the whole assessment: ${topTags || "(no tags)"}.

Between-section observations captured during the assessment:
${insightsBlock}

${reflectionBlock}

Write the first impression. Two or three sentences. The sharpest thing you
could say if you had one breath — the irreducible insight, not a summary.

Voice constraints:
- Flat delivery. Perceptive, slightly warm, never performative.
- Never start with "You" — vary the subject.
- No hedging ("seems like", "might be", "it appears").
- No self-reference ("I notice", "what stands out is", "it's interesting").
- No marketing speak. No "synergy", "leverage", "solutions".
- Write as if naming something the person already knew but hadn't articulated yet.

Return only the two or three sentences. No preamble, no header, no quotes.`;
}
