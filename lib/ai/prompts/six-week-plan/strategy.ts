/**
 * Opus prompt — `six-week-plan-strategy`.
 *
 * Stage 1: strategy outline from full context bundle.
 * Populated by content mini-session before SWP-2.
 */

export type StrategyInput = {
  contextBundle: SixWeekContextBundle;
  regenNote?: string | null;
};

export type SixWeekContextBundle = {
  questionnaireAnswers: Record<string, unknown> | null;
  enrichmentProfile: Record<string, unknown> | null;
  shootDayNotes: ShootDayNotesContext | null;
  brandDnaProfile: Record<string, unknown> | null;
  trialShootOffer: string;
};

export type ShootDayNotesContext = {
  infrastructure: Record<string, unknown>;
  goals: Array<{ priority: number; text: string }>;
  signals: {
    energy: number;
    fluency: number;
    icp_clarity: number;
    conversion_ready: number;
  };
  observations: string;
};

export type FlaggedAssumption = {
  statement: string;
  confidence: "low" | "medium" | "high";
  what_to_verify: string;
};

export type WeeklyTheme = {
  week_number: 1 | 2 | 3 | 4 | 5 | 6;
  theme: string;
};

export type StrategyOutput = {
  current_state_diagnosis: string;
  primary_goal: string;
  chosen_primitives: string[];
  theme_arc: WeeklyTheme[];
  flagged_assumptions: FlaggedAssumption[];
};

export function buildStrategyPrompt(input: StrategyInput): string {
  const { contextBundle, regenNote } = input;

  const questionnaireBlock = contextBundle.questionnaireAnswers
    ? `INTAKE QUESTIONNAIRE (prospect's own answers from the booking funnel):\n${JSON.stringify(contextBundle.questionnaireAnswers, null, 2)}`
    : "(no questionnaire answers on file)";

  const enrichmentBlock = contextBundle.enrichmentProfile
    ? `ENRICHMENT PROFILE (automated research — 9 signals, pre-verified):\n${JSON.stringify(contextBundle.enrichmentProfile, null, 2)}`
    : "(no enrichment profile available)";

  const shootDayBlock = contextBundle.shootDayNotes
    ? buildShootDayBlock(contextBundle.shootDayNotes)
    : "(no shoot-day notes captured — degrade gracefully, flag low-confidence assumptions liberally)";

  const brandDnaBlock = contextBundle.brandDnaProfile
    ? `BRAND DNA PROFILE (completed assessment — voice + personality signals):\n${JSON.stringify(contextBundle.brandDnaProfile, null, 2)}`
    : "(Brand DNA not taken — voice specificity will be lower; strategic framing unaffected)";

  const regenBlock = regenNote
    ? `\nREGENERATION NOTE (Andy rejected the previous strategy and asked for this):\n"${regenNote}"\nTake this seriously. It means the previous outline missed something fundamental. Re-read the context through this lens.`
    : "";

  return `You are SuperBad's lead strategist. You have been briefed on a new client — everything known about them is below. Outline the first six weeks of work you would run for this client as their agency.

This plan will be handed to the client. If they convert to retainer, you'll execute it. If they don't, they'll run it themselves. Either way, it must be real — specific to their business, honest about where they are, and scaled to what they can actually do.

CONTEXT ABOUT THE OFFER THEY RECEIVED:
${contextBundle.trialShootOffer}

${questionnaireBlock}

${enrichmentBlock}

${shootDayBlock}

${brandDnaBlock}
${regenBlock}

YOUR TASK — produce a strategy outline as structured JSON.

OUTPUT SCHEMA (strictly valid JSON, no prose, no markdown fences):
{
  "current_state_diagnosis": "<3-6 sentences. Read the bundle and summarise what's real about this business right now. What's working, what's broken, what's missing. No flattery — they hired you to see clearly.>",
  "primary_goal": "<1 sentence. Distilled from their stated goals — the one thing this plan most needs to move. If their goals conflict, pick the one that unblocks the others.>",
  "chosen_primitives": ["<ranked list of marketing primitives this plan will deploy — e.g. email_list_setup, lead_magnet_flow, meta_ads, content_cadence, local_seo, review_flywheel, referral_system, retargeting, partnership_outreach, conversion_page. Pick 3-6. Rank by impact given their current state, not by what's fashionable.>"],
  "theme_arc": [
    { "week_number": 1, "theme": "<one sentence — what week 1 is about and why it comes first>" },
    { "week_number": 2, "theme": "..." },
    { "week_number": 3, "theme": "..." },
    { "week_number": 4, "theme": "..." },
    { "week_number": 5, "theme": "..." },
    { "week_number": 6, "theme": "..." }
  ],
  "flagged_assumptions": [
    { "statement": "<something you assumed because the data was thin>", "confidence": "low" | "medium" | "high", "what_to_verify": "<what Andy should check before this plan ships>" }
  ]
}

STRATEGIC RULES — non-negotiable:
- Match the scale. A solo café owner gets different primitives than a multi-location franchise. Read their revenue signals, team size, and energy rating.
- Infrastructure first. If they don't have an email list, week 1 isn't "content strategy" — it's "set up the thing that makes content strategy possible." Build the base before the plays.
- Shoot-day signals calibrate ambition. Energy 1-2 = fewer tasks, simpler plays, permission to start small. Energy 4-5 = they can handle more, push harder. ICP clarity 1-2 = spend early weeks sharpening who they're talking to.
- Reference their actual business. "A café" is wrong. "Your cold-brew-first positioning in Brunswick" is right. Use what they told you.
- Flag what you don't know. Every assumption built on thin data gets a flagged_assumption entry. Andy reviews these before the plan ships. Be honest about confidence.
- The theme arc must interlock. Week 3 should build on what weeks 1-2 established. Week 6 should feel like an arrival, not a random collection. Tell a story.

VOICE:
- Direct, specific, no filler. Write like you've done this a hundred times and you're not trying to impress anyone.
- Banned: synergy, leverage, solutions, ecosystem, unlock, "deliver value", journey, "elevate your brand".
- Never generic. If you could swap in a different business name and the plan still reads the same, it's wrong.`;
}

function buildShootDayBlock(notes: ShootDayNotesContext): string {
  const infraLines = Object.entries(notes.infrastructure)
    .map(([key, val]) => `  ${key}: ${val ?? "(not set)"}`)
    .join("\n");

  const goalsText = notes.goals.length
    ? notes.goals
        .sort((a, b) => a.priority - b.priority)
        .map((g) => `  ${g.priority}. ${g.text}`)
        .join("\n")
    : "  (none recorded)";

  return `SHOOT-DAY NOTES (Andy's in-person observations, highest-trust source):

Marketing infrastructure:
${infraLines}

Goals (prospect's own words, priority-ordered):
${goalsText}

Shoot-day signals (Andy's read, 1-5 scale):
  Energy: ${notes.signals.energy}/5
  Fluency on offering: ${notes.signals.fluency}/5
  ICP clarity: ${notes.signals.icp_clarity}/5
  Conversion readiness: ${notes.signals.conversion_ready}/5

${notes.signals.energy <= 2 ? "⚠ Low energy — scale tasks down. This person needs permission to start small, not a 50-item to-do list." : ""}${notes.signals.icp_clarity <= 2 ? "⚠ Low ICP clarity — early weeks should sharpen who they're talking to before deploying channels." : ""}
Andy's observations:
"${notes.observations}"`;
}
