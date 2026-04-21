import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { cockpit_briefs, type CockpitBriefSlot } from "@/lib/db/schema/cockpit-briefs";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { modelFor } from "@/lib/ai/models";
import { logActivity } from "@/lib/activity-log";
import { mergeWaitingItems, mergeHealthBanners } from "./aggregator";
import { getCurrentSlot, getTodayCalendarEvents } from "./queries";
import { getAndyFacingActivitySince } from "./andy-facing-activity";
import { buildMorningPrompt } from "./prompts/morning";
import { buildMiddayPrompt } from "./prompts/midday";
import { buildEveningPrompt } from "./prompts/evening";
import { melbourneStartAndEndOfDay, melbourneWallDate } from "@/lib/time/melbourne";
import type { BriefContext } from "./prompts/types";
import type { WaitingItem, HealthBanner } from "@/lib/tasks/cockpit";

const BRAND_DNA_SYSTEM = `You are SuperBad — a Melbourne marketing business with a dry, observational, self-deprecating voice. Short sentences. Leave room for the mutter. Never explain the joke. No motivational fluff. No "synergy", "leverage", "solutions". You're writing a brief for Andy, the sole operator.`;

const SLOT_CRON_HOURS: Record<CockpitBriefSlot, number> = {
  morning: 6,
  midday: 12,
  evening: 18,
};

export type GenerateBriefResult =
  | { generated: true; prose: string; briefId: string }
  | { generated: false; reason: "kill_switch" | "quiet_slot" };

export async function generateBriefForSlot(
  slot: CockpitBriefSlot,
  opts: {
    trigger?: "cron" | "material_event";
    triggerEvent?: string;
    nowMs?: number;
  } = {},
): Promise<GenerateBriefResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const trigger = opts.trigger ?? "cron";

  if (!killSwitches.cockpit_briefs_enabled || !killSwitches.llm_calls_enabled) {
    return { generated: false, reason: "kill_switch" };
  }

  const waitingItems = await mergeWaitingItems(nowMs);
  const healthBanners = await mergeHealthBanners(nowMs);
  const calendarEvents = await getTodayCalendarEvents(nowMs);

  const { startMs } = melbourneStartAndEndOfDay(nowMs);
  const eventTrailSince = SLOT_CRON_HOURS[slot] === 6 ? startMs : startMs + 6 * 3600_000;
  const events = await getAndyFacingActivitySince(eventTrailSince);

  if (isQuietSlot(waitingItems, healthBanners, events.length)) {
    await logActivity({
      kind: "cockpit_brief_skipped_quiet",
      body: `Quiet-slot skip: ${slot}`,
      meta: { slot, trigger, waitingItems: 0, banners: 0, events: 0 },
    });
    return { generated: false, reason: "quiet_slot" };
  }

  const priorBriefs = await getPriorBriefs(nowMs, slot);

  const ctx: BriefContext = {
    waitingItemCount: waitingItems.length,
    healthBannerCount: healthBanners.length,
    calendarEventCount: calendarEvents.length,
    waitingItemsSummary: summariseWaitingItems(waitingItems),
    healthBannersSummary: summariseBanners(healthBanners),
    calendarSummary: calendarEvents.length > 0
      ? calendarEvents.map((e) => `- ${e.booking_type.replace(/_/g, " ")} (${new Date(e.start_at_ms).toLocaleTimeString("en-AU", { timeZone: "Australia/Melbourne", hour: "2-digit", minute: "2-digit" })})`).join("\n")
      : null,
    tomorrowCalendarSummary: slot === "evening" ? await getTomorrowCalendarSummary(nowMs) : null,
    morningProse: priorBriefs.morning,
    middayProse: priorBriefs.midday,
    eventTrail: events.length > 0
      ? events.map((e) => `- [${e.type}] ${e.body}`).join("\n")
      : null,
  };

  const prompt = slot === "morning"
    ? buildMorningPrompt(ctx)
    : slot === "midday"
      ? buildMiddayPrompt(ctx)
      : buildEveningPrompt(ctx);

  const prose = await invokeLlmText({
    job: "cockpit-brief",
    prompt,
    system: BRAND_DNA_SYSTEM,
    maxTokens: 300,
    actorType: "internal",
  });

  const signalsSnapshot = {
    waitingItemCount: waitingItems.length,
    healthBannerCount: healthBanners.length,
    calendarEventCount: calendarEvents.length,
    eventTrailCount: events.length,
    priorSlots: Object.keys(priorBriefs).filter((k) => priorBriefs[k as keyof typeof priorBriefs] !== null),
  };

  const dateStr = toDateString(nowMs);
  const briefId = randomUUID();
  const modelVersion = modelFor("cockpit-brief");

  const existing = await db.query.cockpit_briefs.findFirst({
    where: and(
      eq(cockpit_briefs.user_id, "admin"),
      eq(cockpit_briefs.slot, slot),
      eq(cockpit_briefs.brief_date, dateStr),
    ),
  });

  if (existing) {
    await logActivity({
      kind: "cockpit_brief_regenerated",
      body: `Regenerated ${slot} brief`,
      meta: { slot, trigger, triggerEvent: opts.triggerEvent, previousProse: existing.prose },
    });

    await db
      .update(cockpit_briefs)
      .set({
        prose,
        generated_at_ms: nowMs,
        trigger,
        trigger_event: opts.triggerEvent ?? null,
        signals_snapshot: signalsSnapshot,
        model_version: modelVersion,
      })
      .where(eq(cockpit_briefs.id, existing.id));

    return { generated: true, prose, briefId: existing.id };
  }

  await db.insert(cockpit_briefs).values({
    id: briefId,
    user_id: "admin",
    slot,
    brief_date: dateStr,
    generated_at_ms: nowMs,
    trigger,
    trigger_event: opts.triggerEvent ?? null,
    prose,
    signals_snapshot: signalsSnapshot,
    model_version: modelVersion,
    created_at_ms: nowMs,
  });

  await logActivity({
    kind: "cockpit_brief_generated",
    body: `Generated ${slot} brief`,
    meta: { slot, trigger, triggerEvent: opts.triggerEvent },
  });

  return { generated: true, prose, briefId };
}

function isQuietSlot(
  waitingItems: WaitingItem[],
  healthBanners: HealthBanner[],
  eventCount: number,
): boolean {
  return waitingItems.length === 0 && healthBanners.length === 0 && eventCount === 0;
}

async function getPriorBriefs(
  nowMs: number,
  currentSlot: CockpitBriefSlot,
): Promise<{ morning: string | null; midday: string | null }> {
  const dateStr = toDateString(nowMs);

  if (currentSlot === "morning") {
    return { morning: null, midday: null };
  }

  const morningBrief = await db.query.cockpit_briefs.findFirst({
    where: and(
      eq(cockpit_briefs.user_id, "admin"),
      eq(cockpit_briefs.slot, "morning"),
      eq(cockpit_briefs.brief_date, dateStr),
    ),
  });

  if (currentSlot === "midday") {
    return { morning: morningBrief?.prose ?? null, midday: null };
  }

  const middayBrief = await db.query.cockpit_briefs.findFirst({
    where: and(
      eq(cockpit_briefs.user_id, "admin"),
      eq(cockpit_briefs.slot, "midday"),
      eq(cockpit_briefs.brief_date, dateStr),
    ),
  });

  return {
    morning: morningBrief?.prose ?? null,
    midday: middayBrief?.prose ?? null,
  };
}

async function getTomorrowCalendarSummary(nowMs: number): Promise<string | null> {
  const tomorrowMs = nowMs + 86400_000;
  const { startMs, endMs } = melbourneStartAndEndOfDay(tomorrowMs);
  const { calendar_bookings } = await import("@/lib/db/schema/calendar");
  const { gte, lte } = await import("drizzle-orm");

  const events = await db.query.calendar_bookings.findMany({
    where: and(
      eq(calendar_bookings.status, "active"),
      gte(calendar_bookings.start_at_ms, startMs),
      lte(calendar_bookings.start_at_ms, endMs),
    ),
  });

  if (events.length === 0) return null;

  return events
    .map((e) => `- ${e.booking_type.replace(/_/g, " ")} (${new Date(e.start_at_ms).toLocaleTimeString("en-AU", { timeZone: "Australia/Melbourne", hour: "2-digit", minute: "2-digit" })})`)
    .join("\n");
}

function summariseWaitingItems(items: WaitingItem[]): string | null {
  if (items.length === 0) return null;
  return items
    .slice(0, 10)
    .map((i) => `- [${i.source}] ${i.label}`)
    .join("\n");
}

function summariseBanners(banners: HealthBanner[]): string | null {
  if (banners.length === 0) return null;
  return banners
    .map((b) => `- [${b.severity}] ${b.summary}`)
    .join("\n");
}

function toDateString(ms: number): string {
  const { year, month, day } = melbourneWallDate(ms);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
