/**
 * Opus prompt — `brand-dna-generate-signal-descriptions`.
 *
 * Consumed by: `lib/brand-dna/generate-signal-descriptions.ts`.
 *
 * Purpose: for each of the top 12 signals, write one sentence connecting
 * the signal to what actually showed up in this person's answers. This is
 * the contextual half of the hybrid description (paired with a static
 * definition from signal-definitions.ts).
 *
 * Voice: dry, perceptive, specific. Each sentence should feel like it
 * could only have been written about this person.
 */

export type SignalDescriptionsInput = {
  subjectName: string;
  track: string;
  signals: Array<{ tag: string; frequency: number; domain: string }>;
  sectionInsights: string[];
  reflectionText: string | null;
  industry?: string | null;
};

export function buildSignalDescriptionsPrompt(
  input: SignalDescriptionsInput,
): string {
  const {
    subjectName,
    track,
    signals,
    sectionInsights,
    reflectionText,
    industry,
  } = input;

  const subject = track === "business" ? "the brand" : "them";
  const possessive = track === "business" ? "the brand's" : "their";

  const signalList = signals
    .map(
      (s) =>
        `- ${s.tag.replace(/_/g, " ")} (×${s.frequency}, domain: ${s.domain})`,
    )
    .join("\n");

  const insightsBlock = sectionInsights.length
    ? sectionInsights
        .map((text, i) => `Section ${i + 1}: ${text}`)
        .join("\n")
    : "(no between-section insights)";

  const reflectionBlock = reflectionText
    ? `Their own words: "${reflectionText}"`
    : "(no reflection provided)";

  const businessLine = industry ? `\nIndustry: ${industry}.` : "";

  return `Write one contextual sentence per signal for ${subjectName}'s Brand DNA signal scores.

Each sentence explains how this specific signal showed up in ${possessive} assessment. Not a definition of the signal (that's handled separately). Your sentence should feel specific to ${subject} — something that could only be written about this person based on their answers.${businessLine}

Signals to describe (ranked by strength):
${signalList}

Context from the assessment:

Between-section insights (written during the assessment):
${insightsBlock}

${reflectionBlock}

For each signal, write ONE sentence (15–30 words) explaining how it manifested in ${possessive} answers. Connect it to a specific pattern, tension, or through-line you can see.

Voice — non-negotiable:
- Specific over generic. "Showed up in how ${subject === "the brand" ? "the brand handles" : "they handle"} client pushback" beats "present throughout the assessment."
- Perceptive but flat. No fortune-telling, no flattery.
- No hedging, no self-reference.
- Vary sentence structure across the list.

Format your response as one line per signal, exactly:

TAG_NAME: Your contextual sentence here.

Use the exact tag names (with underscores) from the input. Nothing else — no preamble, no numbering.`;
}
