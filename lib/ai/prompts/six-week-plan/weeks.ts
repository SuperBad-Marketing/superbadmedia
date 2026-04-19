/**
 * Opus prompt — `six-week-plan-weeks`.
 *
 * Stage 2: per-week elaboration from strategy outline + context.
 * Populated by content mini-session before SWP-2.
 */

import type { SixWeekContextBundle, StrategyOutput } from "./strategy";

export type WeeksInput = {
  contextBundle: SixWeekContextBundle;
  strategyOutline: StrategyOutput;
  regenNote?: string | null;
  regenWeekNumbers?: number[] | null;
  selfReviewIssues?: string[] | null;
};

export type TaskCategory =
  | "infrastructure"
  | "content"
  | "distribution"
  | "conversion"
  | "measurement";

export type EffortEstimate = "quick" | "half_day" | "full_day" | "multi_day";

export type PlanTask = {
  title: string;
  detail: string;
  category: TaskCategory;
  effort_estimate: EffortEstimate;
};

export type ContentAngle = {
  description: string;
  shoot_asset_ref: string;
  caption_direction: string;
};

export type WeekPlan = {
  week_number: 1 | 2 | 3 | 4 | 5 | 6;
  theme: string;
  why_this_week: string;
  content_angles: ContentAngle[];
  channel_mix: string[];
  tasks: PlanTask[];
  success_signal: string;
  fallback: string;
};

export type WeeksOutput = {
  plan_intro: string;
  weeks: WeekPlan[];
};

export function buildWeeksPrompt(input: WeeksInput): string {
  const { contextBundle, strategyOutline, regenNote, regenWeekNumbers, selfReviewIssues } = input;

  const contextSummary = buildContextSummary(contextBundle);

  const strategyBlock = JSON.stringify(strategyOutline, null, 2);

  const regenBlock = regenNote
    ? `\nREGENERATION NOTE (Andy wants changes):\n"${regenNote}"\n${regenWeekNumbers?.length ? `Specifically regen weeks: ${regenWeekNumbers.join(", ")}. Leave other weeks unchanged in structure but ensure continuity.` : "Full regen requested — rebuild all 6 weeks."}`
    : "";

  const selfReviewBlock = selfReviewIssues?.length
    ? `\nSELF-REVIEW ISSUES FROM PRIOR PASS (fix these):\n${selfReviewIssues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}\nAddress every issue. Do not ignore any.`
    : "";

  return `You've outlined the strategy for this client. Now decompose each week so they could execute it themselves if they chose to.

STRATEGY OUTLINE (approved — do not contradict):
${strategyBlock}

CLIENT CONTEXT (condensed):
${contextSummary}
${regenBlock}${selfReviewBlock}

YOUR TASK — produce the full 6-week plan as structured JSON.

OUTPUT SCHEMA (strictly valid JSON, no prose, no markdown fences):
{
  "plan_intro": "<1 paragraph, spoken directly to the client. Frame the 6 weeks ahead. Set expectations honestly — this is real work, not a magic list. Acknowledge where they are and where this takes them. 40-80 words.>",
  "weeks": [
    {
      "week_number": 1,
      "theme": "<carries over from strategy outline theme_arc>",
      "why_this_week": "<2-3 sentences. Narrative reason — why this comes now, what it builds on, what it enables next week.>",
      "content_angles": [
        {
          "description": "<what to shoot/create/post>",
          "shoot_asset_ref": "<reference a specific asset type from their shoot — e.g. 'the wide shot of the café bar', 'the close-up of the product in use', 'the owner portrait'. Be specific to what a photographer would have captured at THEIR business.>",
          "caption_direction": "<tone + hook direction for the post, not a full caption>"
        }
      ],
      "channel_mix": ["<where this week's work lands — instagram, email, google_business, facebook, tiktok, website, local_partnerships>"],
      "tasks": [
        {
          "title": "<short, action-oriented>",
          "detail": "<1-2 sentences. Specific enough to execute without asking 'but how?'>",
          "category": "infrastructure | content | distribution | conversion | measurement",
          "effort_estimate": "quick | half_day | full_day | multi_day"
        }
      ],
      "success_signal": "<1 sentence — 'you'll know it worked when...' Name something observable, not aspirational.>",
      "fallback": "<1 sentence — 'if [signal weak], try [specific alternative] next week.' Not 'try harder'.>"
    }
  ]
}

ELABORATION RULES — non-negotiable:
- Every week must reference specific shoot assets. Not "a photo of your business" — "the wide shot of the front counter with the chalkboard menu visible." You're referencing assets from a real photography shoot at their specific location.
- 3-6 tasks per week. Fewer for low-energy clients. More is not better — completable is better.
- Effort estimates must be honest. If "set up Mailchimp" is a full_day for someone who's never used it, say so. Don't underestimate to look efficient.
- Content angles need caption direction, not captions. The client writes (or their agency does). You're giving the strategic hook, not the copy.
- Channel mix should match their infrastructure. Don't prescribe Meta ads in week 2 if their ad_experience is "none" — that's a week 4-5 play after they've built content.
- Success signals must be measurable or at least observable. "More engagement" is banned. "3+ DMs asking about the new menu" is real.
- Fallbacks must name a specific alternative action, not a vaguer version of the same thing. "Post at a different time" is lazy. "Repost the top-performing angle as a Story with a poll" is a fallback.
- Infrastructure tasks in weeks 1-2 are non-negotiable if the strategy outline chose primitives that need setup (email list, lead magnet, retargeting pixel, etc.).
- The plan_intro speaks TO the client. Not about them. Not about the plan. To them. As if you sat across from them and said "here's what the next six weeks look like."

VOICE:
- Direct, practical, specific. You're briefing someone who's going to do the work. No inspiration, no motivation — just clear next steps.
- Banned: synergy, leverage, solutions, ecosystem, unlock, "deliver value", journey, "elevate your brand", "take your business to the next level".
- Write tasks like a colleague would leave on a sticky note, not like a consultant would write in a deck.
- Short sentences. If a task detail runs past 2 sentences, split it into 2 tasks.`;
}

function buildContextSummary(bundle: SixWeekContextBundle): string {
  const parts: string[] = [];

  if (bundle.shootDayNotes) {
    const n = bundle.shootDayNotes;
    const goals = n.goals.sort((a, b) => a.priority - b.priority).map((g) => g.text).join("; ");
    parts.push(`Goals: ${goals || "(none)"}`);
    parts.push(`Energy: ${n.signals.energy}/5, Fluency: ${n.signals.fluency}/5, ICP clarity: ${n.signals.icp_clarity}/5, Conversion ready: ${n.signals.conversion_ready}/5`);
    if (n.observations) parts.push(`Andy's observations: "${n.observations}"`);

    const infraEntries = Object.entries(n.infrastructure)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (infraEntries) parts.push(`Infrastructure: ${infraEntries}`);
  }

  if (bundle.questionnaireAnswers) {
    parts.push(`Questionnaire answers: ${JSON.stringify(bundle.questionnaireAnswers)}`);
  }

  if (bundle.enrichmentProfile) {
    parts.push(`Enrichment profile: ${JSON.stringify(bundle.enrichmentProfile)}`);
  }

  if (bundle.brandDnaProfile) {
    parts.push(`Brand DNA: ${JSON.stringify(bundle.brandDnaProfile)}`);
  }

  return parts.join("\n\n");
}
