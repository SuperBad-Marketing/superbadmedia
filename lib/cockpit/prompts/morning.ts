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

Reference specific entities by name when available. Don't list everything — name what matters most.

CRITICAL RULES:
- Describe each calendar event using ONLY its own data (subject, organizer, time). Never infer the purpose of a calendar event from waiting items, emails, or other signals.
- Do not connect unrelated signals. A waiting email from one person has nothing to do with a meeting with a different person.
- If a calendar event has no subject or organizer, just state the type and time. Do not guess.

${sections.join("\n")}`;
}
