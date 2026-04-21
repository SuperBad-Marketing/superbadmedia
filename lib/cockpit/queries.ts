import { db } from "@/lib/db";
import { cockpit_briefs } from "@/lib/db/schema/cockpit-briefs";
import { calendar_bookings } from "@/lib/db/schema/calendar";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { melbourneStartAndEndOfDay, melbourneWallDate } from "@/lib/time/melbourne";
import type { CockpitBriefSlot } from "@/lib/db/schema/cockpit-briefs";

function toDateString(ms: number): string {
  const { year, month, day } = melbourneWallDate(ms);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const SLOT_BOUNDARIES: Record<CockpitBriefSlot, number> = {
  morning: 6,
  midday: 12,
  evening: 18.5,
};

export function getCurrentSlot(nowMs: number = Date.now()): CockpitBriefSlot {
  const d = new Date(nowMs);
  const mel = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).format(d);
  const [h, m] = mel.split(":").map(Number);
  const hour = h + m / 60;

  if (hour >= SLOT_BOUNDARIES.evening) return "evening";
  if (hour >= SLOT_BOUNDARIES.midday) return "midday";
  return "morning";
}

export async function getCurrentBrief(
  userId: string,
  nowMs: number = Date.now(),
) {
  const dateStr = toDateString(nowMs);
  const slot = getCurrentSlot(nowMs);

  const brief = await db.query.cockpit_briefs.findFirst({
    where: and(
      eq(cockpit_briefs.user_id, userId),
      eq(cockpit_briefs.brief_date, dateStr),
      eq(cockpit_briefs.slot, slot),
    ),
    orderBy: [desc(cockpit_briefs.generated_at_ms)],
  });

  if (brief) return { brief, slot, fallback: false };

  const anyToday = await db.query.cockpit_briefs.findFirst({
    where: and(
      eq(cockpit_briefs.user_id, userId),
      eq(cockpit_briefs.brief_date, dateStr),
    ),
    orderBy: [desc(cockpit_briefs.generated_at_ms)],
  });

  if (anyToday) return { brief: anyToday, slot, fallback: false };

  return { brief: null, slot, fallback: true };
}

export async function getTodayCalendarEvents(nowMs: number = Date.now()) {
  const { startMs, endMs } = melbourneStartAndEndOfDay(nowMs);

  return db.query.calendar_bookings.findMany({
    where: and(
      eq(calendar_bookings.status, "active"),
      gte(calendar_bookings.start_at_ms, startMs),
      lte(calendar_bookings.start_at_ms, endMs),
    ),
    orderBy: [calendar_bookings.start_at_ms],
  });
}
