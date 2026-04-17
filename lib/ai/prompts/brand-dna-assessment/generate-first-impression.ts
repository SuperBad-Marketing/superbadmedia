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
    .slice(0, 15)
    .map(([tag, freq]) => `${tag} (×${freq})`)
    .join(", ");

  // Surface the most interesting tensions — tags that appear together but
  // don't usually coexist (e.g. risk_appetite + perfectionism)
  const tensionPairs = findTensionPairs(tagFrequencyMap);
  const tensionBlock = tensionPairs.length
    ? `Notable tensions in their signals (tags that don't usually coexist):\n${tensionPairs.map(t => `- ${t}`).join("\n")}`
    : "";

  // Group tags by domain for richer context
  const domainSummary = buildDomainSummary(tagFrequencyMap);

  const insightsBlock = sectionInsights.length
    ? sectionInsights
        .map((text, i) => `Section ${i + 1}: ${text}`)
        .join("\n")
    : "(no between-section insights captured)";

  const reflectionBlock = reflectionText
    ? `Their own words (free-form reflection at the end): "${reflectionText}"\nPay attention to what they chose to say — and what they didn't. The gap between the structured answers and this reflection is a signal.`
    : "(no free-form reflection provided)";

  const shapeLine = shape ? `Shape: ${shape}.` : "";

  const trackNote = track === "business"
    ? "They answered in business mode — 'the brand', not 'I'. Write about the brand."
    : "They answered as a founder. Write about the person.";

  return `You're writing the first impression for ${subjectName}'s Brand DNA reveal.

This is the emotional peak. It fades in alone on screen — 2–3 sentences, nothing else visible. It must feel like a punch of recognition: "how do they know that about me?"

Track: ${track}. ${shapeLine}
${trackNote}

Strongest signals across the full assessment:
${topTags || "(no tags)"}

${domainSummary}

${tensionBlock}

Between-section insights (you wrote these during the assessment):
${insightsBlock}

${reflectionBlock}

Write the first impression. Two or three sentences. Not a summary — the irreducible insight. The one thing that's true about this ${track === "business" ? "brand" : "person"} that everything else orbits.

Look for:
- The through-line that connects seemingly unrelated signals across domains
- The central tension that defines them (most people have one)
- What the reflection reveals that the structured answers tried to hide
- What's conspicuously absent from their signals

Voice — non-negotiable:
- Flat delivery. Perceptive. Slightly warm. Like a sharp friend, not a fortune teller.
- Never start with "You". Vary the subject.
- No hedging ("seems like", "might be", "arguably", "perhaps").
- No self-reference ("I notice", "what stands out", "it's interesting").
- No marketing speak. No "synergy", "leverage", "solutions", "journey".
- Short sentences. Let the observation land. Don't over-explain.
- Name things precisely — not "you value quality" but the specific quality of their quality.

Return only the 2–3 sentences. No preamble, no header, no quotes.`;
}

/** Known tension pairs — tags that signal contradictory pulls. */
const TENSION_PAIRS: [string, string][] = [
  ["risk_appetite", "perfectionism"],
  ["risk_appetite", "risk_caution"],
  ["introversion", "extraversion"],
  ["patience", "ambition"],
  ["independence", "affiliation"],
  ["minimalism", "maximalism"],
  ["directness", "conflict_avoidant"],
  ["gut_first", "head_first"],
  ["admires_restraint", "admires_boldness"],
  ["warmth_in_voice", "formality"],
  ["innovation_pull", "nostalgia_pull"],
  ["conviction", "agreeableness"],
  ["control_need", "loyalty"],
  ["pragmatism", "perfectionism"],
  ["quiet_confidence", "proving_ground"],
];

function findTensionPairs(tagFrequencyMap: Record<string, number>): string[] {
  const results: string[] = [];
  for (const [a, b] of TENSION_PAIRS) {
    if (tagFrequencyMap[a] && tagFrequencyMap[b]) {
      results.push(`${a} (×${tagFrequencyMap[a]}) vs ${b} (×${tagFrequencyMap[b]})`);
    }
  }
  return results;
}

function buildDomainSummary(tagFrequencyMap: Record<string, number>): string {
  const domainPrefixes: Record<string, string[]> = {
    aesthetic: ["warmth", "minimalism", "maximalism", "organic_forms", "geometric_precision", "analogue_texture", "high_contrast", "muted_palette", "cinematic_eye", "tactile_craft", "sensory_memory", "curation_instinct"],
    communication: ["directness", "dry_humour", "brevity", "warmth_in_voice", "storytelling", "formality", "confrontation_comfort", "metaphor_use", "listen_first", "provocation", "selective_vulnerability", "tonal_awareness", "introversion", "extraversion", "conflict_avoidant", "agreeableness"],
    values: ["authenticity", "risk_appetite", "risk_caution", "patience", "perfectionism", "pragmatism", "independence", "loyalty", "transparency", "conviction", "control_need", "legacy_drive", "gut_first", "head_first", "high_sensitivity", "thick_skin", "openness", "conscientiousness", "neuroticism", "resilience", "curiosity", "prudence", "ambition"],
    creative: ["admires_restraint", "admires_boldness", "admires_craft", "rejects_trend", "genre_fluency", "nostalgia_pull", "innovation_pull", "emotional_resonance", "intellectual_depth", "visual_storytelling", "taste_as_identity", "anti_polish", "improviser"],
    aspiration: ["premium_positioning", "underdog_energy", "quiet_confidence", "category_creation", "personality_forward", "community_building", "thought_leadership", "proving_ground", "reputation_weight", "global_ambition", "local_roots", "achievement_orientation", "affiliation", "power_drive", "independence"],
  };

  const lines: string[] = [];
  for (const [domain, tags] of Object.entries(domainPrefixes)) {
    const domainTags = tags
      .filter(t => tagFrequencyMap[t])
      .sort((a, b) => (tagFrequencyMap[b] ?? 0) - (tagFrequencyMap[a] ?? 0))
      .slice(0, 4)
      .map(t => `${t} (×${tagFrequencyMap[t]})`);
    if (domainTags.length) {
      lines.push(`${domain}: ${domainTags.join(", ")}`);
    }
  }
  return lines.length ? `Top signals by domain:\n${lines.join("\n")}` : "";
}
