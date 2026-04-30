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

export type AnswerTrace = {
  question: string;
  chosen: string;
  rejected: string[];
};

export type SectionInsightInput = {
  subjectName: string;
  sectionNumber: 1 | 2 | 3 | 4;
  sectionTitle: string;
  topTags: string;
  answerTraces: AnswerTrace[];
  priorInsights: string[];
  track: string;
};

/**
 * Section domain context — tells Opus what each section was actually measuring
 * so the insight is grounded in the right lens.
 */
const SECTION_CONTEXT: Record<number, string> = {
  1: "Aesthetic Identity — visual taste, sensory world, relationship to beauty, what they can't stop looking at and what they'd never wear.",
  2: "Communication DNA — how they write, speak, handle conflict, exist in a room. How they land when nobody's watching versus when everyone is.",
  3: "Values & Instincts — what drives decisions, what frustrates, risk appetite, gut reactions, the version of themselves nobody else sees. The deepest section.",
  4: "Creative Compass — taste in others' creative work, what they admire versus what they'd never make, their creative process and weaknesses.",
};

/**
 * Compose the Opus prompt for between-section insight generation.
 *
 * Inputs are aggregated by the caller (`lib/brand-dna/generate-insight.ts`)
 * which reads `brand_dna_answers` and `brand_dna_profiles` before calling this.
 */
export function buildSectionInsightPrompt(input: SectionInsightInput): string {
  const { subjectName, sectionNumber, sectionTitle, topTags, answerTraces, priorInsights, track } = input;

  const context = SECTION_CONTEXT[sectionNumber] ?? sectionTitle;

  const priorBlock = priorInsights.length
    ? `You've already said this about them in prior sections:\n${priorInsights.map((t, i) => `- After Section ${i + 1}: "${t}"`).join("\n")}\nDon't repeat yourself. Build on what's come before — or contradict it if the new signals warrant it.`
    : "This is the first section. You have nothing on them yet — make it count.";

  const trackNote = track === "business"
    ? `They're answering in business mode — "the brand", not "I". Address the brand, not the person.`
    : `They're answering as a founder. Address them personally.`;

  const choicesBlock = answerTraces.length
    ? `Here's what they actually chose — and what they walked past:\n${answerTraces.map((t) => `Q: "${t.question}"\n  → Chose: "${t.chosen}"\n  → Passed on: ${t.rejected.map((r) => `"${r}"`).join(", ")}`).join("\n\n")}`
    : "";

  return `You're revealing the brand DNA of ${subjectName}.

They just completed "${sectionTitle}" — ${context}

${trackNote}

${choicesBlock}

Aggregate signal pattern: ${topTags || "no tags yet"}.

${priorBlock}

Write the insight in a structured format. This appears as a transition card between sections — a moment that makes the person feel genuinely understood.

Structure — three parts:

HEADLINE: A single bold sentence (max 10 words) that names the core observation from this section. This renders large and bold. Think: "You'd rather be honest than impressive." or "Texture matters more than symmetry." It should land on its own without explanation.

BODY: 2–3 sentences that ground and expand the headline. Two moves:
- MOVE 1: Name something specific they did — a choice, a pattern, a telling rejection. "Every room you picked had warm light in it" hits harder than "you gravitate toward warmth."
- MOVE 2: Make a leap. Infer something they didn't tell you — something that follows from the pattern but goes beyond what they answered.

The leap can take many forms:
- Predict an everyday preference ("your home office probably has one good lamp and nothing on the walls, or everything on the walls, no in-between.")
- Name a real-world behaviour ("the kind of person who rearranges the café table before sitting down")
- Surface what their workspace or home probably looks like
- Identify a frustration they live with
- Predict what they'd notice or reject in everyday life
- Name what kind of first impression they want their business to make

TAGS: The 3 most relevant signal tags from this section, as plain English (spaces not underscores, lowercase). These display as small pills beneath the insight.

CRITICAL — audience context: these are business owners, tradies, café owners, professionals — not designers or creatives. The inferences must land in their everyday world. Reference their shopfront, their home, their office, their morning routine. Never reference galleries, art movements, or design culture unless the person's answers explicitly signal that world.

The leap must feel earned by the choices they made — not generic fortune-cookie wisdom. It should make them think "how did it know that?" not "that could be anyone."

Voice — non-negotiable:
- Flat delivery. Perceptive, slightly warm. Like a sharp friend who just watched you make fourteen decisions in a row and has something to say about it.
- Never "I notice", "it seems like", "what stands out", "it's interesting that", "your answers suggest", "there's a clear pattern".
- Never "There's a...", "This suggests...", "What emerges is...", "It's worth noting".
- Never open with "The kind of person who" — you can use it mid-sentence, but never as a sentence starter.
- Never use the word "interesting" — if something is interesting, describe why without the word.
- Never start with "You" in the HEADLINE. Vary sentence structure throughout.
- No hedging. No qualifiers. No marketing speak. No praise.
- Short sentences. One observation per sentence. One sentence can be a fragment. Let the rhythm breathe.
- Name the tension if there is one. Name what's absent if the absence is revealing.
- Write like someone who's known them for a year, not someone who just read their results. The difference is specificity.
- Occasionally end the BODY with a question. Not a hook question. A real one — something they'll think about after they close the tab. Use this sparingly (maybe 1 in 3 insights).

Format your response exactly as:

HEADLINE: (your bold lead sentence)
BODY: (your 2–3 supporting sentences)
TAGS: (tag one, tag two, tag three)

Nothing else. No preamble, no quotes.`;
}
