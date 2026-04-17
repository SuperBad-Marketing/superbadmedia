/**
 * Opus prompt — `brand-dna-generate-retake-comparison`.
 *
 * Consumed by: `lib/brand-dna/generate-retake-comparison.ts` (to be built).
 * Slug in the model registry: `brand-dna-generate-retake-comparison` (Opus).
 *
 * Purpose: when a retake completes, compare the previous and current profiles
 * and narrate what shifted, what held, and what the movement means.
 *
 * Shown during the retake reveal as a side-by-side narrative.
 *
 * Per `docs/specs/brand-dna-assessment.md` §3.4 + §6.6 + §9.
 */

export type RetakeComparisonInput = {
  subjectName: string;
  track: string;
  /** Previous profile's tag frequency map. */
  previousTags: Record<string, number>;
  /** Current profile's tag frequency map. */
  currentTags: Record<string, number>;
  previousFirstImpression: string;
  currentFirstImpression: string;
  previousPortraitExcerpt: string;
  currentPortraitExcerpt: string;
  /** Days between the two assessments. */
  daysBetween: number;
};

export function buildRetakeComparisonPrompt(input: RetakeComparisonInput): string {
  const {
    subjectName,
    track,
    previousTags,
    currentTags,
    previousFirstImpression,
    currentFirstImpression,
    previousPortraitExcerpt,
    currentPortraitExcerpt,
    daysBetween,
  } = input;

  // Compute tag movements
  const allTags = new Set([...Object.keys(previousTags), ...Object.keys(currentTags)]);
  const gained: string[] = [];
  const lost: string[] = [];
  const strengthened: string[] = [];
  const weakened: string[] = [];
  const stable: string[] = [];

  for (const tag of allTags) {
    const prev = previousTags[tag] ?? 0;
    const curr = currentTags[tag] ?? 0;
    if (prev === 0 && curr > 0) gained.push(`${tag} (now ×${curr})`);
    else if (prev > 0 && curr === 0) lost.push(`${tag} (was ×${prev})`);
    else if (curr > prev + 1) strengthened.push(`${tag} (${prev} → ${curr})`);
    else if (prev > curr + 1) weakened.push(`${tag} (${prev} → ${curr})`);
    else if (prev > 0 && curr > 0) stable.push(tag);
  }

  const movementBlock = [
    gained.length ? `New signals (didn't appear before): ${gained.join(", ")}` : "",
    lost.length ? `Disappeared signals (were present, now gone): ${lost.join(", ")}` : "",
    strengthened.length ? `Strengthened (frequency increased significantly): ${strengthened.join(", ")}` : "",
    weakened.length ? `Weakened (frequency decreased significantly): ${weakened.join(", ")}` : "",
    stable.length ? `Stable (held steady): ${stable.slice(0, 10).join(", ")}${stable.length > 10 ? ` + ${stable.length - 10} more` : ""}` : "",
  ].filter(Boolean).join("\n");

  const timeframe = daysBetween <= 30
    ? `${daysBetween} days apart — likely re-answering from a similar place, look for subtle shifts`
    : daysBetween <= 180
    ? `${daysBetween} days apart — enough time for real change, look for genuine evolution`
    : `${daysBetween} days apart — substantial time has passed, expect meaningful shifts`;

  const trackNote = track === "business"
    ? "Both assessments were in business mode. Write about the brand's evolution."
    : "Both assessments were as a founder. Write about the person's evolution.";

  return `You're comparing two Brand DNA assessments for ${subjectName}, taken ${timeframe}.

${trackNote}

Previous first impression:
"${previousFirstImpression}"

Current first impression:
"${currentFirstImpression}"

Previous portrait excerpt (first 150 words):
${previousPortraitExcerpt.split(/\s+/).slice(0, 150).join(" ")}...

Current portrait excerpt (first 150 words):
${currentPortraitExcerpt.split(/\s+/).slice(0, 150).join(" ")}...

Tag movements:
${movementBlock}

Write a comparison narrative. 200–400 words. This appears alongside the new profile reveal as a side-by-side. It should feel like catching up with someone after time apart — "here's what changed, here's what didn't, and here's what the movement means."

What to capture:
1. WHAT HELD — the signals that didn't move. These are the foundation. Name them with confidence: "this is bedrock."
2. WHAT SHIFTED — the meaningful changes. Don't list them — interpret them. Why might this person's aesthetic have warmed? Why might directness have softened? Offer a reading, not a summary.
3. WHAT APPEARED OR DISAPPEARED — new signals are significant. Lost signals are significant. Both tell a story.
4. THE NARRATIVE — what does the overall movement say? "The confidence was always there — now it's quieter" is more useful than "quiet_confidence increased."

Voice — non-negotiable:
- Flat delivery. Perceptive. Warm underneath.
- Never "I notice", "what stands out", "it's interesting".
- No hedging. No marketing speak.
- Speak to the movement, not just the data points.
- Short sentences. Plain paragraphs. No headings, no bullets.

Return only the comparison narrative. No preamble, no title.`;
}
