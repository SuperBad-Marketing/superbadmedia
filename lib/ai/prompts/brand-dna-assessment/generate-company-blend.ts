/**
 * Opus prompt — `brand-dna-generate-company-blend`.
 *
 * Consumed by: `lib/brand-dna/generate-company-blend.ts` (to be built).
 * Slug in the model registry: `brand-dna-generate-company-blend` (Opus).
 *
 * Purpose: synthesise multiple individual Brand DNA profiles into a single
 * company-level profile. Not an average — a synthesis that captures shared
 * signals and explicitly flags divergences as productive tensions.
 *
 * Generated when >= 2 stakeholders have completed individual profiles.
 * Regenerated when any stakeholder retakes.
 *
 * Per `docs/specs/brand-dna-assessment.md` §6.5 + §9.
 */

export type StakeholderProfile = {
  name: string;
  track: string;
  tagFrequencyMap: Record<string, number>;
  firstImpression: string;
  prosePortrait: string;
  brandOverrideTags?: Record<string, number> | null;
};

export type CompanyBlendInput = {
  companyName: string;
  stakeholders: StakeholderProfile[];
};

export function buildCompanyBlendPrompt(input: CompanyBlendInput): string {
  const { companyName, stakeholders } = input;

  const profileBlocks = stakeholders.map((s, i) => {
    const topTags = Object.entries(s.tagFrequencyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, freq]) => `${tag} (×${freq})`)
      .join(", ");

    const overrideBlock = s.brandOverrideTags && Object.keys(s.brandOverrideTags).length
      ? `Brand overrides: ${Object.entries(s.brandOverrideTags).sort((a, b) => b[1] - a[1]).map(([tag, freq]) => `${tag} (×${freq})`).join(", ")}`
      : "";

    return `--- Stakeholder ${i + 1}: ${s.name} (${s.track} track) ---
Top signals: ${topTags}
First impression: "${s.firstImpression}"
${overrideBlock}

Portrait excerpt (first 200 words):
${s.prosePortrait.split(/\s+/).slice(0, 200).join(" ")}...`;
  }).join("\n\n");

  return `You're synthesising the Brand DNA profiles of ${stakeholders.length} stakeholders into a single company-level profile for ${companyName}.

This is NOT an average. It's a synthesis. The company voice has its own character that emerges from the intersection of these individuals — and the tensions between them are as important as the agreements.

Individual profiles:

${profileBlocks}

Produce THREE outputs in this exact format:

=== SHARED SIGNALS ===
List the tags (with estimated combined frequency) where stakeholders clearly align. These are the brand's non-negotiable signals — the things everyone agrees on without trying. Group by domain (aesthetic, communication, values, creative, aspiration). Only include tags where 2+ stakeholders show meaningful frequency.

=== DIVERGENCES ===
List the specific points where stakeholders pull in different directions. For each divergence:
- Name the tension precisely (e.g. "visual warmth vs geometric precision")
- Name which stakeholders sit on which side
- Do NOT resolve the tension. Describe it. Downstream consumers decide how to use it.

=== COMPANY PORTRAIT ===
300–500 words. A coherent narrative of who this company is, told through the pattern of its people. Capture:
- What they share that defines the company's core
- Where they diverge and what that productive tension creates
- The company personality that emerges — not as a compromise, but as something richer than any individual
- If brand override signals exist, note where the company brand intentionally reaches beyond its people

Voice — non-negotiable:
- Flat delivery. Perceptive. Warm underneath.
- Never "I notice", "what stands out", "it's interesting".
- No hedging. No marketing speak.
- Write as if you're briefing a creative director who needs to understand this company in five minutes.
- Short sentences. Plain paragraphs. No headings inside the portrait.

Return all three sections with the === headers exactly as shown.`;
}
