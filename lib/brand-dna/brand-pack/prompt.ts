/**
 * Brand Pack LLM prompt — asks Claude to produce a structured JSON
 * recommendation of fonts, colours, colour grades, creative direction,
 * tone of voice, and visual don'ts based on the Brand DNA profile.
 *
 * Consumed by: `lib/brand-dna/brand-pack/generate.ts`.
 *
 * Owner: BDA-PACK.
 */

export interface BrandPackPromptInput {
  subjectName: string;
  track: string;
  tagFrequencyMap: Record<string, number>;
  businessContext: {
    businessDoes?: string;
    customers?: string;
    differentiator?: string;
  } | null;
  industry: string | null;
  prosePortrait: string | null;
}

export function buildBrandPackPrompt(input: BrandPackPromptInput): string {
  const {
    subjectName,
    track,
    tagFrequencyMap,
    businessContext,
    industry,
    prosePortrait,
  } = input;

  const topTags = Object.entries(tagFrequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([tag, freq]) => `${tag} (×${freq})`)
    .join(", ");

  const businessLines: string[] = [];
  if (businessContext?.businessDoes)
    businessLines.push(`What the business does: ${businessContext.businessDoes}`);
  else if (industry) businessLines.push(`Industry: ${industry}`);
  if (businessContext?.customers)
    businessLines.push(`Customers: ${businessContext.customers}`);
  if (businessContext?.differentiator)
    businessLines.push(`Differentiator: ${businessContext.differentiator}`);

  const businessBlock = businessLines.length
    ? `Business context:\n${businessLines.join("\n")}`
    : "(no business context available)";

  const portraitBlock = prosePortrait
    ? `Prose portrait (the narrative identity):\n"${prosePortrait}"`
    : "(no prose portrait available)";

  return `You are a senior brand strategist building a Brand Pack for ${subjectName}.

Track: ${track}.

Signal tags (frequency-weighted):
${topTags || "(no tags)"}

${businessBlock}

${portraitBlock}

Based on everything above, produce a JSON object with the following structure. Every recommendation must flow directly from the signals — not from generic "brand guidelines" thinking. If they're drawn to warmth and texture, don't recommend a geometric sans-serif. If their tags scream precision, don't suggest hand-drawn anything.

{
  "primaryFont": {
    "name": "<exact Google Fonts name>",
    "category": "serif | sans-serif | display | handwriting | monospace",
    "reason": "<1 sentence connecting this font to their signals>"
  },
  "secondaryFont": {
    "name": "<exact Google Fonts name>",
    "category": "serif | sans-serif | display | handwriting | monospace",
    "reason": "<1 sentence>"
  },
  "accentFont": {
    "name": "<exact Google Fonts name or null if two fonts are enough>",
    "category": "serif | sans-serif | display | handwriting | monospace",
    "reason": "<1 sentence or null>"
  },
  "colours": {
    "primary": { "hex": "#XXXXXX", "name": "<evocative colour name>", "usage": "<where and how to use it>" },
    "secondary": { "hex": "#XXXXXX", "name": "<evocative colour name>", "usage": "<where and how>" },
    "accent": { "hex": "#XXXXXX", "name": "<evocative colour name>", "usage": "<where and how>" },
    "neutral": { "hex": "#XXXXXX", "name": "<evocative colour name>", "usage": "<where and how>" },
    "background": { "hex": "#XXXXXX", "name": "<evocative colour name>", "usage": "<where and how>" }
  },
  "colourGrades": [
    { "hex": "#XXXXXX", "label": "<role — e.g. 'Primary 100', 'Accent 50'>" },
    ...8-12 grades showing tints and shades of the primary and accent colours
  ],
  "photographyDirection": "<2-3 sentences: lighting, composition, subject treatment, mood>",
  "toneOfVoice": "<2-3 sentences: how the brand should sound in copy — register, sentence length, what to lean into, what to avoid>",
  "visualDonts": [
    "<specific thing to avoid — e.g. 'Stock photography with forced smiles'>",
    "<another>",
    "<another>",
    "<another — aim for 4-6 entries>"
  ]
}

Rules:
- Fonts MUST be available on Google Fonts. Use exact names (e.g. "DM Sans", "Playfair Display", "Space Grotesk").
- Colour hex values must be valid 6-digit hex codes. No shorthand.
- Colour names should be evocative, not generic ("Harbour Slate" not "Dark Blue").
- colourGrades: produce 8-12 entries. Include tints (lighter) and shades (darker) of the primary and accent colours. Label them with a system (e.g. "Primary 50", "Primary 100", ... "Primary 900").
- photographyDirection: be specific to THIS brand. "Warm natural light, shallow depth of field" is generic. "Overhead flatlays on raw timber, never on white — the grain is the point" is specific.
- toneOfVoice: connect to the signals. Don't just say "friendly and professional."
- visualDonts: things that would feel wrong for this specific brand. Not generic design sins.
- accentFont: only include if there's a genuine use case (e.g. a display face for headlines that neither primary nor secondary covers). Set to null if two fonts handle everything.

Return ONLY the JSON object. No markdown fencing, no explanation, no preamble.`;
}
