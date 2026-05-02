/**
 * Opus prompt — `brand-dna-generate-marketing-playbook`.
 *
 * Consumed by: `lib/brand-dna/generate-marketing-playbook.ts`.
 *
 * Purpose: generate a personalised marketing playbook with 5 discipline
 * sections, each containing a brief overview and practical day-to-day
 * examples. Every recommendation is driven by the subject's Brand DNA
 * signals, not generic marketing advice.
 */

export interface MarketingPlaybookInput {
  subjectName: string;
  signalTags: Record<string, number>;
  firstImpression: string;
  prosePortraitExcerpt: string;
  sectionInsights: string[];
  businessContext: {
    businessDoes?: string;
    customers?: string;
    differentiator?: string;
  } | null;
}

export function buildMarketingPlaybookPrompt(
  input: MarketingPlaybookInput,
): string {
  const {
    subjectName,
    signalTags,
    firstImpression,
    prosePortraitExcerpt,
    sectionInsights,
    businessContext,
  } = input;

  const sortedSignals = Object.entries(signalTags)
    .sort(([, a], [, b]) => b - a)
    .map(([tag, freq]) => `${tag.replace(/_/g, " ")} (${freq})`)
    .join(", ");

  const insightsBlock = sectionInsights
    .map((s, i) => `Section ${i + 1}: ${s}`)
    .join("\n");

  const contextBlock = businessContext
    ? [
        businessContext.businessDoes && `What they do: ${businessContext.businessDoes}`,
        businessContext.customers && `Who they serve: ${businessContext.customers}`,
        businessContext.differentiator && `What makes them different: ${businessContext.differentiator}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "No business context available.";

  return `Generate a personalised marketing playbook for ${subjectName} based on their Brand DNA profile.

═══ BRAND DNA CONTEXT ═══

First impression: ${firstImpression}

Portrait excerpt: ${prosePortraitExcerpt}

Signal scores (tag: frequency): ${sortedSignals}

Section insights:
${insightsBlock}

Business context:
${contextBlock}

═══ TASK ═══

Write a JSON object with exactly 5 sections. Each section covers a marketing discipline and must be deeply personalised to this brand's DNA — not generic advice anyone could follow.

The 5 sections, in order:
1. "Copywriting & Written Marketing" — website copy, emails, captions, taglines, any written touchpoint
2. "Video Content" — style, pacing, what to show, tone on camera, what to lean into
3. "Social Media Presence" — posting voice, engagement style, platform personality, cadence
4. "Visual Identity & Photography" — imagery direction, colour instincts, composition, what to avoid
5. "Advertising & Paid Media" — creative angles, what to lead with, audience messaging, ad tone

For each section:
- "title": the section name exactly as listed above
- "overview": 2-3 sentences. What this brand should prioritise in this discipline and why, based on their DNA. Specific to them. Not a definition of the discipline.
- "examples": array of exactly 2 objects, each with:
  - "scenario": a specific day-to-day situation (e.g. "Writing an Instagram caption for a new product")
  - "guidance": 2-3 sentences of practical, concrete advice for that scenario, shaped by this brand's DNA

═══ VOICE — NON-NEGOTIABLE ═══

- Direct. Practical. Like a smart colleague giving specific advice, not a textbook.
- No hedging ("you might want to", "consider trying", "it could be worth").
- No marketing jargon ("leverage", "synergy", "optimise your funnel").
- No compliments ("your brand is amazing", "you clearly have great taste").
- Speak to the business as "you" — second person.
- Every recommendation must trace back to something in their DNA signals or profile. If you can't connect it to their DNA, don't include it.

═══ OUTPUT FORMAT ═══

Return ONLY a JSON object. No markdown, no code fences, no preamble.

{
  "sections": [
    {
      "title": "...",
      "overview": "...",
      "examples": [
        { "scenario": "...", "guidance": "..." },
        { "scenario": "...", "guidance": "..." }
      ]
    }
  ]
}`;
}
