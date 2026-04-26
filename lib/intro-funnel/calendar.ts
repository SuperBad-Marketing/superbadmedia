/**
 * Calendar availability engine for the Intro Funnel trial shoot booking.
 *
 * Owner: IF-2. Consumer: booking page, reschedule surface, admin panel.
 */
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendar_bookings, calendar_config } from "@/lib/db/schema/calendar";
import type { TrialShootTier } from "@/lib/db/schema/intro-funnel-submissions";
import settings from "@/lib/settings";

export interface Slot {
  startMs: number;
  endMs: number;
  label: string;
}

interface CalendarConfigData {
  timezone: string;
  businessHours: Record<string, { start: string; end: string }>;
  blackoutDates: string[];
  advanceNoticeDays: number;
  perWeekCap: number;
}

async function getSlotDurationMs(tier?: TrialShootTier): Promise<number> {
  const key = tier === "session"
    ? "trial_shoot.session_duration_minutes"
    : "trial_shoot.production_duration_minutes";
  const minutes = await settings.get(key) as number;
  return minutes * 60 * 1000;
}

async function loadCalendarConfig(): Promise<CalendarConfigData> {
  const rows = await db
    .select()
    .from(calendar_config)
    .where(eq(calendar_config.id, "singleton"))
    .limit(1);

  const cfg = rows[0];
  if (!cfg) {
    return {
      timezone: "Australia/Melbourne",
      businessHours: {
        "1": { start: "09:00", end: "17:00" },
        "2": { start: "09:00", end: "17:00" },
        "3": { start: "09:00", end: "17:00" },
        "4": { start: "09:00", end: "17:00" },
        "5": { start: "09:00", end: "17:00" },
      },
      blackoutDates: [],
      advanceNoticeDays: 5,
      perWeekCap: 3,
    };
  }

  const rawHours = (cfg.business_hours_json ?? {}) as Record<string, unknown>;
  const businessHours = normaliseBusinessHours(rawHours);

  return {
    timezone: cfg.timezone,
    businessHours,
    blackoutDates: (cfg.blackout_dates_json as string[]) ?? [],
    advanceNoticeDays: cfg.intro_funnel_advance_notice_business_days,
    perWeekCap: cfg.intro_funnel_per_week_cap,
  };
}

const DAY_NAME_TO_NUMBER: Record<string, string> = {
  sun: "0", mon: "1", tue: "2", wed: "3", thu: "4", fri: "5", sat: "6",
};

function normaliseBusinessHours(
  raw: Record<string, unknown>,
): Record<string, { start: string; end: string }> {
  const result: Record<string, { start: string; end: string }> = {};
  for (const [key, val] of Object.entries(raw)) {
    const dayNum = DAY_NAME_TO_NUMBER[key.toLowerCase()] ?? key;
    if (Array.isArray(val) && val.length >= 2) {
      result[dayNum] = { start: String(val[0]), end: String(val[1]) };
    } else if (
      val &&
      typeof val === "object" &&
      "start" in val &&
      "end" in val
    ) {
      result[dayNum] = val as { start: string; end: string };
    }
  }
  return result;
}

function addBusinessDays(date: Date, days: number, tz: string): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = getDayOfWeekInTz(result, tz);
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      added++;
    }
  }
  return result;
}

function getDayOfWeekInTz(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[weekday] ?? 0;
}

function getDatePartsInTz(
  date: Date,
  tz: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function formatDateInTz(date: Date, tz: string): string {
  const p = getDatePartsInTz(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function getISOWeekKey(date: Date, tz: string): string {
  const p = getDatePartsInTz(date, tz);
  const d = new Date(p.year, p.month - 1, p.day);
  const dayOfYear =
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000;
  const weekNum = Math.ceil((dayOfYear + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
  return `${p.year}-W${weekNum}`;
}

async function getExistingBookingsInRange(
  fromMs: number,
  toMs: number,
): Promise<Array<{ startMs: number; endMs: number; weekKey: string; isShoot: boolean }>> {
  const rows = await db
    .select({
      start_at_ms: calendar_bookings.start_at_ms,
      end_at_ms: calendar_bookings.end_at_ms,
      booking_type: calendar_bookings.booking_type,
    })
    .from(calendar_bookings)
    .where(
      and(
        eq(calendar_bookings.status, "active"),
        gte(calendar_bookings.start_at_ms, fromMs),
        lte(calendar_bookings.start_at_ms, toMs),
      ),
    );

  return rows.map((r) => ({
    startMs: r.start_at_ms,
    endMs: r.end_at_ms,
    weekKey: getISOWeekKey(new Date(r.start_at_ms), "Australia/Melbourne"),
    isShoot: r.booking_type === "intro_funnel_shoot",
  }));
}

export async function computeAvailableSlots(
  fromDate: Date,
  toDate: Date,
  tier?: TrialShootTier,
): Promise<Slot[]> {
  const cfg = await loadCalendarConfig();
  const tz = cfg.timezone;

  const minDate = addBusinessDays(new Date(), cfg.advanceNoticeDays, tz);
  const effectiveFrom = fromDate > minDate ? fromDate : minDate;

  const existing = await getExistingBookingsInRange(
    effectiveFrom.getTime(),
    toDate.getTime(),
  );

  const weekCounts: Record<string, number> = {};
  for (const b of existing) {
    if (b.isShoot) {
      weekCounts[b.weekKey] = (weekCounts[b.weekKey] ?? 0) + 1;
    }
  }

  const slots: Slot[] = [];
  const cursor = new Date(effectiveFrom);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= toDate) {
    const dayOfWeek = getDayOfWeekInTz(cursor, tz);
    const dayKey = String(dayOfWeek);
    const hours = cfg.businessHours[dayKey];

    if (!hours) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const dateStr = formatDateInTz(cursor, tz);
    if (cfg.blackoutDates.includes(dateStr)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const weekKey = getISOWeekKey(cursor, tz);
    if ((weekCounts[weekKey] ?? 0) >= cfg.perWeekCap) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const [startH, startM] = hours.start.split(":").map(Number);
    const [endH, endM] = hours.end.split(":").map(Number);
    const dayStartMinutes = startH * 60 + startM;
    const dayEndMinutes = endH * 60 + endM;

    const slotDurationMs = await getSlotDurationMs(tier);
    const slotDurationMinutes = slotDurationMs / (60 * 1000);

    for (
      let mins = dayStartMinutes;
      mins + slotDurationMinutes <= dayEndMinutes;
      mins += slotDurationMinutes
    ) {
      const slotDate = new Date(cursor);
      const parts = getDatePartsInTz(slotDate, tz);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, h, m, 0);
      const targetOffset = getTimezoneOffsetMs(new Date(utcMs), tz);
      const startMs = utcMs + targetOffset;
      const endMs = startMs + slotDurationMs;

      if (startMs < effectiveFrom.getTime()) {
        continue;
      }

      const overlaps = existing.some(
        (b) => startMs < b.endMs && endMs > b.startMs,
      );
      if (overlaps) continue;

      const label = formatSlotLabel(new Date(startMs), new Date(endMs), tz);
      slots.push({ startMs, endMs, label });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

function getTimezoneOffsetMs(date: Date, tz: string): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: tz });
  return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

function formatSlotLabel(start: Date, end: Date, tz: string): string {
  const dateFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export { loadCalendarConfig };
export type { CalendarConfigData };
