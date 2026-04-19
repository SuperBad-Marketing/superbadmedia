/**
 * Haiku prompt — `six-week-plan-review`.
 *
 * Self-review pass after stage 2 elaboration.
 * Populated by content mini-session before SWP-2.
 */

import type { WeeksOutput } from "./weeks";

export type ReviewInput = {
  planJson: WeeksOutput;
  signalEnergy: number;
};

export type ReviewOutput = {
  passes: boolean;
  issues: string[];
};

export function buildReviewPrompt(input: ReviewInput): string {
  const { planJson, signalEnergy } = input;

  return `You are a quality reviewer for a bespoke 6-week marketing plan. The plan was generated for a specific client. Your job is to catch problems before the plan ships.

PLAN TO REVIEW:
${JSON.stringify(planJson, null, 2)}

CLIENT ENERGY RATING: ${signalEnergy}/5
${signalEnergy <= 2 ? "(Low energy client — task load should be lighter, ambition tempered. Flag if too many tasks or effort estimates are too high.)" : ""}${signalEnergy >= 4 ? "(High energy client — can handle more. Flag if tasks seem timid or underscoped.)" : ""}

REVIEW CHECKLIST — check every item. If any fails, the plan does not pass.

1. SHOOT ASSET SPECIFICITY: Does each week's content_angles reference specific shoot assets ("the wide shot of the café bar"), not generic language ("a photo of your business")? Every content angle must feel like it references a real photo or video from a real shoot at this specific location.

2. MEASURABLE SUCCESS SIGNALS: Does each week's success_signal name something observable and concrete? "More engagement" fails. "3+ saves on the carousel post" passes. "First 20 email signups" passes.

3. ENERGY-TASK CALIBRATION: Is the scale of tasks matched to the energy rating? A ${signalEnergy}/5 energy client ${signalEnergy <= 2 ? "should have fewer, simpler tasks — 3-4 per week max, mostly quick/half_day effort" : signalEnergy >= 4 ? "can handle 4-6 tasks per week with some full_day efforts" : "should have a moderate workload"}.

4. INFRASTRUCTURE FOUNDATION: Is at least one infrastructure task present in weeks 1-2? If the client needs an email list, a lead magnet, or a pixel — that must appear before the content/distribution plays that depend on it.

5. REAL FALLBACKS: Does each week's fallback name a specific alternative action? "Try harder" or "post more" fails. "Repost the top angle as a Story with a poll" passes. The fallback must be a different play, not a repeated attempt.

6. NO DUPLICATE WEEKS: Is any week's task list substantially the same as another week? Each week should feel like a distinct beat in a progression, not the same advice recycled.

7. INTERLOCKING PROGRESSION: Does week N build on what weeks 1 through N-1 established? The arc should feel like a story — setup, build, expand, refine — not 6 independent lists.

8. PLAN INTRO TONE: Does the plan_intro speak TO the client (not about them, not about the plan)? Does it set honest expectations without hype?

OUTPUT — strictly valid JSON, no prose, no markdown fences:
{
  "passes": true | false,
  "issues": ["<specific issue description — name the week number and what's wrong>"]
}

If the plan passes all checks, return { "passes": true, "issues": [] }.
If any check fails, return { "passes": false, "issues": [...] } with every failing item described specifically enough that the generator can fix it on the next pass.`;
}
