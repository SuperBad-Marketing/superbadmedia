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

Write 2–3 sentences. This appears as a transition card between sections — a moment that makes the person feel genuinely seen. Not summarised. Seen.

Your job is to name something specific they did — a choice, a pattern across choices, a telling rejection — and say what it reveals. Reference their actual decisions, not abstract traits. "Every room you picked had warm light in it" hits harder than "you gravitate toward warmth." "You chose the hand-drawn logo but the sans-serif typeface — that's not a contradiction, that's a hierarchy" hits harder than "you balance polish with personality."

The best insight names something the person already felt but hadn't put words to. The second-best names a tension between two of their choices that they haven't reconciled yet. The worst is a personality summary that could apply to anyone.

Voice — non-negotiable:
- Flat delivery. Perceptive, slightly warm. Like a sharp friend who just watched you make fourteen decisions in a row and has something to say about it.
- Never "I notice", "it seems like", "what stands out", "it's interesting that", "your answers suggest", "there's a clear pattern".
- Never start with "You". Vary sentence structure.
- No hedging. No qualifiers. No marketing speak. No praise.
- Short sentences. One observation per sentence.
- Name the tension if there is one. Name what's absent if the absence is revealing.
- You can reference specific choices directly — "the concrete floors but the warm music" — when the juxtaposition reveals something.

Return only the 2–3 sentences. No preamble, no quotes, no header.`;
}
