/**
 * Opus prompt — `brand-dna-generate-section-insight`.
 *
 * Consumed by: `lib/brand-dna/generate-insight.ts`.
 * Slug in the model registry: `brand-dna-generate-section-insight` (Opus).
 *
 * Purpose: between-section reveal — 2–3 sentences naming what the
 * assessment just surfaced, delivered as the respondent crosses into the
 * next section. Not a summary; a small, specific observation.
 *
 * Voice: dry, perceptive, flat delivery. Admin-roommate register. Never
 * "it seems like" or "you might be" — just the observation, stated.
 *
 * Per `docs/specs/brand-dna-assessment.md` §6.4 + §9. The full content
 * calibration lives in the Brand DNA content mini-session (post-BDA-3).
 */

export type SectionInsightInput = {
  subjectName: string;
  sectionTitle: string;
  topTags: string;
};

/**
 * Compose the Opus prompt for between-section insight generation.
 *
 * Inputs are aggregated by the caller (`lib/brand-dna/generate-insight.ts`)
 * which reads `brand_dna_answers` and `brand_dna_profiles` before calling this.
 */
export function buildSectionInsightPrompt(input: SectionInsightInput): string {
  const { subjectName, sectionTitle, topTags } = input;

  return `You're helping reveal the brand DNA of ${subjectName}.
They just completed the "${sectionTitle}" section of their Brand DNA Assessment.
Their strongest signal tags from this section: ${topTags || "no tags yet"}.

Write 2–3 sentences. Sharp, perceptive, slightly warm. No marketing speak.
No hedging phrases like "it seems like" or "you might be". Write as if you're
naming something the person already knew but hadn't articulated yet. Don't
start with "You" — vary the sentence structure.`;
}
