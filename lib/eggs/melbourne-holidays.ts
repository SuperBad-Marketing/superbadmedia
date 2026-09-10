import { readFileSync } from "node:fs";
import { join } from "node:path";

interface HolidayCalendar {
  dates: Record<string, string>;
}

let calendar: HolidayCalendar | null = null;

function loadCalendar(): HolidayCalendar {
  if (calendar) return calendar;
  const raw = readFileSync(join(process.cwd(), "data", "au-holidays.json"), "utf-8");
  calendar = JSON.parse(raw) as HolidayCalendar;
  return calendar;
}

export function getHolidayName(dateISO: string): string | null {
  const cal = loadCalendar();
  return cal.dates[dateISO] ?? null;
}

export function getMelbourneDateISO(nowMs: number): string {
  return new Date(nowMs).toLocaleDateString("en-CA", {
    timeZone: "Australia/Melbourne",
  });
}

export function getMelbourneHour(nowMs: number): number {
  return parseInt(
    new Date(nowMs).toLocaleString("en-AU", {
      timeZone: "Australia/Melbourne",
      hour: "2-digit",
      // Explicit 0-23 cycle: hour12:false can choose h24 on older ICU.
      hourCycle: "h23",
    }),
    10,
  );
}
