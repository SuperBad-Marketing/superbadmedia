/**
 * Quiet window gate — returns true when it's a safe time to send outreach
 * email in the Australia/Melbourne timezone.
 *
 * "Safe" = Monday–Friday, between quiet_window_start_hour and
 * quiet_window_end_hour (exclusive), and NOT a public holiday in the
 * au-holidays.json calendar.
 *
 * Settings read: `email.quiet_window_start_hour`, `email.quiet_window_end_hour`
 * Data source: `/data/au-holidays.json` (national + Victoria, 2026–2027)
 */
import settingsRegistry from "@/lib/settings";
import holidaysData from "@/data/au-holidays.json";

const MELBOURNE_TZ = "Australia/Melbourne";

interface MelbourneTimeParts {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Mon … 6 = Sat
  dateStr: string;   // YYYY-MM-DD in Melbourne local time
}

/**
 * Extract local time parts for Australia/Melbourne using the Intl API.
 *
 * Uses a locale-neutral approach for day-of-week: formats the Melbourne
 * local date as YYYY-MM-DD (via en-CA locale), then computes getUTCDay()
 * on that local date rather than relying on locale weekday strings.
 *
 * @internal
 */
function getMelbourneTimeParts(date: Date): MelbourneTimeParts {
  // Get Melbourne local date as YYYY-MM-DD (en-CA locale yields ISO format)
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  // dateStr = "2026-04-07"

  // Get Melbourne local hour (24-hour)
  const hourStr = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  // hourStr may be "08" or occasionally "24" at midnight — normalise
  const hour = parseInt(hourStr, 10) % 24;

  // Compute day-of-week from the Melbourne local date components.
  // Construct a UTC noon date using the Melbourne local YYYY-MM-DD so that
  // getUTCDay() reflects the Melbourne calendar day, not the UTC calendar day.
  const [y, m, d] = dateStr.split("-").map(Number);
  const localNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayOfWeek = localNoon.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat

  return { hour, dayOfWeek, dateStr };
}

const holidays: Record<string, string> = holidaysData.dates;

/**
 * Returns `true` when `now` (defaults to current UTC time) falls within the
 * configured quiet window in Australia/Melbourne time.
 *
 * Quiet window = Mon–Fri, [start_hour, end_hour), excluding public holidays.
 *
 * @param now - Optional fixed Date for testing
 */
export async function isWithinQuietWindow(now?: Date): Promise<boolean> {
  const date = now ?? new Date();

  const startHour = await settingsRegistry.get("email.quiet_window_start_hour");
  const endHour = await settingsRegistry.get("email.quiet_window_end_hour");

  const { hour, dayOfWeek, dateStr } = getMelbourneTimeParts(date);

  // Must be Monday–Friday (1–5)
  if (dayOfWeek < 1 || dayOfWeek > 5) return false;

  // Must be within the configured hour window [start, end)
  if (hour < startHour || hour >= endHour) return false;

  // Must not be a public holiday
  if (dateStr in holidays) return false;

  return true;
}
