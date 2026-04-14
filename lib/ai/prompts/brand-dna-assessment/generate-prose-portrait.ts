/**
 * Opus prompt — `brand-dna-generate-prose-portrait`.
 *
 * Consumed by: `lib/brand-dna/generate-prose-portrait.ts`.
 * Slug in the model registry: `brand-dna-generate-prose-portrait` (Opus).
 *
 * Purpose: a 500–800 word narrative portrait that captures who this person or
 * brand actually is — not a list of traits, but a coherent description that
 * holds the through-lines and the tensions together in one piece of writing.
 *
 * Per `docs/specs/brand-dna-assessment.md` §6.2 + §9. Full content calibration
 * lives in the Brand DNA content mini-session (post-BDA-3).
 */

export type ProsePortraitInput = {
  subjectName: string;
  track: string;
  shape: string | null;
  tagFrequencyMap: Record<string, number>;
  reflectionText: string | null;
  firstImpression: string;
  sectionInsights: string[];
};

export function buildProsePortraitPrompt(input: ProsePortraitInput): string {
  const {
    subjectName,
    track,
    shape,
    tagFrequencyMap,
    reflectionText,
    firstImpression,
    sectionInsights,
  } = input;

  const topTags = Object.entries(tagFrequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
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

  return `You're writing a prose portrait for ${subjectName}'s Brand DNA reveal.

Track: ${track}. ${shapeLine}

Strongest signal tags across the assessment: ${topTags || "(no tags)"}.

Section-by-section observations from the assessment:
${insightsBlock}

${reflectionBlock}

A first impression has already been written (keep it consistent with this, but
don't restate it): "${firstImpression}"

Write the prose portrait. 500–800 words. Coherent narrative — not a list of
traits. Capture:
- The through-lines across domains (where signals reinforce each other).
- The tensions (where signals contradict — describe them as tensions, don't
  average them away).
- The personality that emerges from the pattern.
- Any texture the reflection added that the multiple-choice answers missed.

Voice constraints:
- Flat delivery. Perceptive. Never performative.
- Never "I notice", "what stands out", "it's interesting".
- No hedging ("seems like", "might be", "arguably").
- No marketing speak. No "synergy", "leverage", "solutions".
- Short sentences welcome. Leave room for the mutter.
- Write as if you watched them for a week and now you're telling a friend.

Structure: no headings, no bullet lists. Plain paragraphs, 3–6 of them. The
portrait is read end-to-end as one piece of writing.

Return only the portrait. No preamble, no title, no sign-off.`;
}
