const MELBOURNE_TZ = "Australia/Melbourne";

export function melbourneWallDate(utcMs: number): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcMs));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

export function melbourneWallToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
): number {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  const offsetMs = melbourneOffsetMsAt(naiveUtc);
  return naiveUtc - offsetMs;
}

export function melbourneOffsetMsAt(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const melbAsIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === "24" ? "00" : map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return melbAsIfUtc - utcMs;
}

export function melbourneStartAndEndOfDay(utcMs: number): {
  startMs: number;
  endMs: number;
} {
  const { year, month, day } = melbourneWallDate(utcMs);
  const startMs = melbourneWallToUtcMs(year, month, day, 0);
  const endMs =
    melbourneWallToUtcMs(year, month, day, 23) + 59 * 60_000 + 59_999;
  return { startMs, endMs };
}

export function nextMelbourneHourMs(nowMs: number, hour: number): number {
  const today = melbourneWallDate(nowMs);
  let candidate = melbourneWallToUtcMs(today.year, today.month, today.day, hour);
  if (candidate <= nowMs) {
    const tomorrow = new Date(
      Date.UTC(today.year, today.month - 1, today.day + 1),
    );
    candidate = melbourneWallToUtcMs(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
      hour,
    );
  }
  return candidate;
}
