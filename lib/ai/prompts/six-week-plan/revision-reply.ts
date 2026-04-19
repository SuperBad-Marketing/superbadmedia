/**
 * Haiku prompt — `six-week-plan-revision-reply`.
 *
 * Drafts Andy's explain-path reply to a prospect's revision note.
 * Populated by content mini-session before SWP-2.
 */

import type { WeeksOutput } from "./weeks";

export type RevisionReplyInput = {
  prospectName: string;
  businessName: string;
  revisionNote: string;
  planJson: WeeksOutput;
};

export type RevisionReplyOutput = {
  reply_text: string;
};

export function buildRevisionReplyPrompt(
  input: RevisionReplyInput,
): string {
  const { prospectName, businessName, revisionNote, planJson } = input;

  const weekSummaries = planJson.weeks
    .map((w) => `Week ${w.week_number} — ${w.theme}: ${w.why_this_week}`)
    .join("\n");

  return `Draft a short reply from Andy (SuperBad Marketing) to a prospect who asked for a revision on their 6-week marketing plan. Andy has decided the plan stands — this reply explains why.

PROSPECT: ${prospectName} (${businessName})

THEIR REVISION NOTE:
"${revisionNote}"

THE PLAN (summary of each week's reasoning):
${weekSummaries}

YOUR TASK: Draft a reply that addresses their specific concern and explains why the plan is built the way it is. Andy will review and edit this before sending — you're seeding, not sending.

RULES:
- Address the specific thing they raised. Do not ignore their note and give a generic "we stand by our work" response.
- Explain the strategic reasoning behind the part of the plan they questioned. Why is week N structured that way? What does it set up?
- Be honest. If their note has merit but the plan still makes sense overall, say so. "You're right that X feels heavy — the reason it's there is Y, and here's what it unlocks in week Z."
- Keep it short. 3-5 sentences. This is a reply, not a presentation.
- If their concern actually reveals a gap in the plan, say so plainly. Andy will decide whether to regen instead of sending this reply.

VOICE — Andy's register, not platform voice:
- First person. "I" not "we". Direct, warm underneath, never on top.
- Dry. Not defensive. Not salesy. Not apologetic.
- Speak to them like a neighbour who happens to know marketing, not like a consultant justifying a bill.
- Banned: synergy, leverage, solutions, ecosystem, unlock, "deliver value", journey.

OUTPUT — return only the reply text. No subject line, no greeting, no sign-off. Andy adds those himself.`;
}
