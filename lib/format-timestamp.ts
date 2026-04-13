/**
 * All storage is UTC epoch milliseconds (see FOUNDATIONS §11.3). Display
 * formatting goes through this helper so the user's `timezone` column
 * always governs what they see.
 *
 * Default tz is Australia/Melbourne — SuperBad's home office.
 */
export type TimestampFormat =
  | "datetime" // "14 Apr 2026, 3:45 pm"
  | "date" // "14 Apr 2026"
  | "time" // "3:45 pm"
  | "relative" // "2 hours ago" / "in 30 minutes"
  | "iso"; // "2026-04-14T03:45:00+10:00"

export interface FormatTimestampOptions {
  format?: TimestampFormat;
  now?: Date;
}

export const DEFAULT_TIMEZONE = "Australia/Melbourne";

export function formatTimestamp(
  date: Date | number,
  tz: string = DEFAULT_TIMEZONE,
  options: FormatTimestampOptions = {},
): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const format = options.format ?? "datetime";

  if (format === "iso") {
    return formatIsoWithOffset(d, tz);
  }

  if (format === "relative") {
    const now = options.now ?? new Date();
    return formatRelative(d.getTime() - now.getTime());
  }

  const intlOptions: Intl.DateTimeFormatOptions = { timeZone: tz };
  if (format === "datetime" || format === "date") {
    intlOptions.day = "2-digit";
    intlOptions.month = "short";
    intlOptions.year = "numeric";
  }
  if (format === "datetime" || format === "time") {
    intlOptions.hour = "numeric";
    intlOptions.minute = "2-digit";
    intlOptions.hour12 = true;
  }

  const parts = new Intl.DateTimeFormat("en-AU", intlOptions).formatToParts(d);
  if (format === "datetime") {
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "";
    const dayPeriod = (
      parts.find((p) => p.type === "dayPeriod")?.value ?? ""
    ).toLowerCase();
    return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`.trim();
  }
  if (format === "date") {
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    return `${day} ${month} ${year}`;
  }
  // time
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = (
    parts.find((p) => p.type === "dayPeriod")?.value ?? ""
  ).toLowerCase();
  return `${hour}:${minute} ${dayPeriod}`.trim();
}

function formatRelative(diffMs: number): string {
  const future = diffMs > 0;
  const abs = Math.abs(diffMs);
  const table: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60_000, "second"],
    [3_600_000, "minute"],
    [86_400_000, "hour"],
    [604_800_000, "day"],
    [2_592_000_000, "week"],
    [31_536_000_000, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  const divisors: Record<Intl.RelativeTimeFormatUnit | string, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
    quarter: 0,
  };
  const unit = table.find(([threshold]) => abs < threshold)?.[1] ?? "year";
  const value = Math.round(abs / divisors[unit]);
  const rtf = new Intl.RelativeTimeFormat("en-AU", { numeric: "auto" });
  return rtf.format(future ? value : -value, unit);
}

function formatIsoWithOffset(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = get("hour");
  if (hour === "24") hour = "00";
  const minute = get("minute");
  const second = get("second");

  const localMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const offsetMinutes = Math.round((localMs - d.getTime()) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offH = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const offM = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offH}:${offM}`;
}
