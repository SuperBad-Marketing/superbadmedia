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
  /** Brand override tags from supplement (founder_supplement track only). */
  brandOverrideTags?: Record<string, number> | null;
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
    brandOverrideTags,
  } = input;

  const topTags = Object.entries(tagFrequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([tag, freq]) => `${tag} (×${freq})`)
    .join(", ");

  const insightsBlock = sectionInsights.length
    ? sectionInsights
        .map((text, i) => `Section ${i + 1}: ${text}`)
        .join("\n")
    : "(no between-section insights captured)";

  const reflectionBlock = reflectionText
    ? `Their own words (free-form reflection): "${reflectionText}"\nThis is what they chose to say when given a blank page. The contrast between structured answers and this reflection is a signal — what shows up here that didn't show up in the multiple choice?`
    : "(no free-form reflection provided)";

  const shapeLine = shape ? `Shape: ${shape}.` : "";

  const trackNote = track === "business"
    ? "They answered in business mode — write about the brand, not a person."
    : "They answered as a founder — write about the person.";

  // Brand override layer for founder_supplement track
  const overrideBlock = brandOverrideTags && Object.keys(brandOverrideTags).length
    ? buildOverrideBlock(brandOverrideTags)
    : "";

  return `You're writing the prose portrait for ${subjectName}'s Brand DNA reveal.

This materialises section by section during the cinematic reveal — the person watches their identity being assembled. It must feel like being genuinely known.

Track: ${track}. ${shapeLine}
${trackNote}

First impression (already shown — don't restate, but stay consistent):
"${firstImpression}"

Full signal tag map (frequency-weighted):
${topTags || "(no tags)"}

Section insights (your observations during the assessment):
${insightsBlock}

${reflectionBlock}
${overrideBlock}

Write the prose portrait. 500–800 words.

What to capture:
1. THE THROUGH-LINES — where signals from different domains reinforce each other. If they're drawn to warmth aesthetically and also lead with empathy in communication, that's a through-line. Name it as a coherent trait, not two separate data points.
2. THE TENSIONS — where signals contradict. Most people have 2–3 real tensions. Don't average them away. Describe them as the productive contradictions they are. "Precision and spontaneity don't usually share a brain" is more useful than averaging them into "balanced."
3. THE PERSONALITY — the human being that emerges from the pattern. Not a list of traits. The person. What's it like to work with them? What do they care about that they didn't say outright?
4. THE REFLECTION CONTRAST — if they wrote a reflection, what appeared there that the structured answers missed? What did the blank page reveal that four options couldn't?
5. THE ABSENT SIGNALS — what tags are conspicuously low-frequency or missing? What they didn't reach for is as revealing as what they did.
${brandOverrideTags && Object.keys(brandOverrideTags).length ? "6. THE BRAND SPLIT — where the brand diverges from the founder. Name the gaps. Interpret them. This is the most valuable section of the portrait for founder_supplement profiles." : ""}

Voice — non-negotiable:
- Write as if you watched them for a week and now you're telling a close friend who they are. Flat delivery. Perceptive. Warm underneath, never on top.
- Never "I notice", "what stands out", "it's interesting", "it's worth noting".
- No hedging. No qualifiers. No "seems", "might", "arguably", "perhaps".
- No marketing speak. No "synergy", "leverage", "solutions", "journey", "unlock".
- Short sentences welcome. Leave room for the mutter. Not every sentence needs to be a revelation.
- Specificity over abstraction — "they'd rewrite a three-word email" beats "they value precision."
- Name what you're seeing, not what it means in general. This is about THEM, not about personality types.

Structure: 4–6 plain paragraphs. No headings, no bullet lists, no bold. Read end-to-end as one continuous piece of writing. The first paragraph should not re-open with the first impression — start somewhere new.

Return only the portrait. No preamble, no title, no sign-off.`;
}

function buildOverrideBlock(overrideTags: Record<string, number>): string {
  const lines = Object.entries(overrideTags)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, freq]) => `  ${tag} (\u00d7${freq})`);

  return `\nBrand override signals (where the brand intentionally diverges from the founder):\n${lines.join("\n")}\nThese overrides are critical. The founder told you who THEY are in sections 1\u20135. Then in the supplement, they told you where the brand splits off. The portrait must acknowledge this split \u2014 name the divergences, describe the intentional gap. "The person is X, but the brand reaches for Y" is the most valuable insight in the entire profile.`;
}
