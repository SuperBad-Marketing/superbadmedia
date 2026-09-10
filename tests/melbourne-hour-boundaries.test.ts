import { describe, expect, it } from "vitest";
import { getMelbourneHour } from "@/lib/eggs/melbourne-holidays";

describe("FM-TIME-01: Melbourne hour is always 0-23 at civil-time boundaries", () => {
  it.each([
    ["2026-09-10T13:59:00Z", 23],
    ["2026-09-10T14:00:00Z", 0],
    ["2026-09-10T14:45:00Z", 0],
    ["2026-09-10T15:00:00Z", 1],
    ["2026-01-01T13:00:00Z", 0],
    ["2026-04-04T15:59:00Z", 2],
    ["2026-04-04T16:00:00Z", 2],
    ["2026-10-03T15:59:00Z", 1],
    ["2026-10-03T16:00:00Z", 3],
  ])("%s gives hour %i without relying on the current clock", (iso, expected) => {
    expect(getMelbourneHour(Date.parse(iso))).toBe(expected);
  });
});
