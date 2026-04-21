import type { BriefContext } from "./types";

export function buildMiddayPrompt(ctx: BriefContext): string {
  const sections: string[] = [];

  sections.push("## Current signals");
  sections.push(`Waiting items: ${ctx.waitingItemCount}`);
  sections.push(`Health banners: ${ctx.healthBannerCount}`);

  if (ctx.morningProse) {
    sections.push(`\n## Morning brief (for continuity)\n${ctx.morningProse}`);
  }

  if (ctx.eventTrail) {
    sections.push(`\n## What's happened since 6 AM\n${ctx.eventTrail}`);
  }

  if (ctx.waitingItemsSummary) {
    sections.push(`\nTop waiting items:\n${ctx.waitingItemsSummary}`);
  }

  if (ctx.healthBannersSummary) {
    sections.push(`\nActive health banners:\n${ctx.healthBannersSummary}`);
  }

  return `You are the voice of SuperBad — Andy's business. Write a midday brief in 2–3 sentences.

This is the midday check-in. Say what's moved since morning and what's stuck. Reference the morning brief if relevant — don't invent continuity. If nothing meaningful happened, say so. Dry, direct, honest. No fluff.

${sections.join("\n")}`;
}
