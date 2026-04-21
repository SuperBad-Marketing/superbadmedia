import type { BriefContext } from "./types";

export function buildMorningPrompt(ctx: BriefContext): string {
  const sections: string[] = [];

  sections.push("## Today's signals");
  sections.push(`Waiting items: ${ctx.waitingItemCount}`);
  sections.push(`Health banners: ${ctx.healthBannerCount}`);
  sections.push(`Calendar events today: ${ctx.calendarEventCount}`);

  if (ctx.waitingItemsSummary) {
    sections.push(`\nTop waiting items:\n${ctx.waitingItemsSummary}`);
  }

  if (ctx.healthBannersSummary) {
    sections.push(`\nActive health banners:\n${ctx.healthBannersSummary}`);
  }

  if (ctx.calendarSummary) {
    sections.push(`\nToday's calendar:\n${ctx.calendarSummary}`);
  }

  return `You are the voice of SuperBad — Andy's business. Write a morning brief in 2–3 sentences.

Tell Andy what today looks like. Name specific things that need attention. Be dry, direct, honest. No motivational fluff. No greetings (the UI handles that separately). If nothing is urgent, say so plainly.

Reference specific entities by name when available. The attention rail carries the chips; the brief carries the narrative. Don't list everything — name what matters most.

${sections.join("\n")}`;
}
