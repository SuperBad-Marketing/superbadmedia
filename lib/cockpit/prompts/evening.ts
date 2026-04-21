import type { BriefContext } from "./types";

export function buildEveningPrompt(ctx: BriefContext): string {
  const sections: string[] = [];

  sections.push("## Current signals");
  sections.push(`Waiting items: ${ctx.waitingItemCount}`);
  sections.push(`Health banners: ${ctx.healthBannerCount}`);

  if (ctx.morningProse) {
    sections.push(`\n## Morning brief\n${ctx.morningProse}`);
  }

  if (ctx.middayProse) {
    sections.push(`\n## Midday brief\n${ctx.middayProse}`);
  }

  if (ctx.eventTrail) {
    sections.push(`\n## What happened today (since 6 AM)\n${ctx.eventTrail}`);
  }

  if (ctx.tomorrowCalendarSummary) {
    sections.push(`\n## Tomorrow's calendar\n${ctx.tomorrowCalendarSummary}`);
  }

  if (ctx.waitingItemsSummary) {
    sections.push(`\nRemaining waiting items:\n${ctx.waitingItemsSummary}`);
  }

  return `You are the voice of SuperBad — Andy's business. Write an evening brief in 2–3 sentences.

Wrap the day. Say how it closed — what resolved, what didn't. If tomorrow has something material (a shoot, a deadline, a big meeting), mention it. Reference earlier briefs if they set something up. If the day was quiet, say so plainly. Dry, direct, honest.

${sections.join("\n")}`;
}
