/**
 * isWithinQuietWindow tests — A7.
 *
 * Uses fixed UTC dates and mocked settings to verify the Melbourne-timezone
 * quiet window gate without making real DB or network calls.
 *
 * Reference timezone: Australia/Melbourne
 *   - AEST = UTC+10 (winter, April–October)
 *   - AEDT = UTC+11 (summer/DST, October–April)
 *
 * Public holiday data: /data/au-holidays.json (loaded by quiet-window.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock settingsRegistry before importing quiet-window ─────────────────────
const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/settings", () => ({
  default: { get: mockGet },
}));

import { isWithinQuietWindow } from "@/lib/channels/email/quiet-window";

// Default: quiet window 08:00–18:00 Melbourne
beforeEach(() => {
  mockGet.mockImplementation(async (key: string) => {
    if (key === "email.quiet_window_start_hour") return 8;
    if (key === "email.quiet_window_end_hour") return 18;
    throw new Error(`Unexpected settings key in quiet-window test: ${key}`);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
// All dates constructed from UTC; the function converts to Melbourne local time.

// Wednesday 15 Jul 2026 09:00 AEST (UTC+10) → UTC 14 Jul 23:00
const WED_09_AEST = new Date("2026-07-14T23:00:00Z");
// Wednesday 15 Jul 2026 08:00 AEST → UTC 14 Jul 22:00 (start boundary, inclusive)
const WED_08_AEST = new Date("2026-07-14T22:00:00Z");
// Wednesday 15 Jul 2026 18:00 AEST → UTC 15 Jul 08:00 (end boundary, exclusive)
const WED_18_AEST = new Date("2026-07-15T08:00:00Z");
// Wednesday 15 Jul 2026 17:59 AEST → UTC 15 Jul 07:59 (just inside window)
const WED_1759_AEST = new Date("2026-07-15T07:59:00Z");
// Wednesday 15 Jul 2026 22:00 AEST → UTC 15 Jul 12:00 (outside hours)
const WED_22_AEST = new Date("2026-07-15T12:00:00Z");
// Saturday 18 Jul 2026 10:00 AEST → UTC 18 Jul 00:00
const SAT_10_AEST = new Date("2026-07-18T00:00:00Z");
// Sunday 19 Jul 2026 10:00 AEST → UTC 19 Jul 00:00
const SUN_10_AEST = new Date("2026-07-19T00:00:00Z");
// Monday 8 Jun 2026 10:00 AEST → UTC 8 Jun 00:00  (King's Birthday — VIC holiday)
const KINGS_BIRTHDAY = new Date("2026-06-08T00:00:00Z");
// Friday 25 Dec 2026 10:00 AEDT (UTC+11) → UTC 24 Dec 23:00  (Christmas Day)
const CHRISTMAS_2026 = new Date("2026-12-24T23:00:00Z");

// ── Tests ────────────────────────────────────────────────────────────────────
describe("isWithinQuietWindow", () => {
  it("returns true for Wednesday 09:00 Melbourne (mid-window)", async () => {
    expect(await isWithinQuietWindow(WED_09_AEST)).toBe(true);
  });

  it("returns true at exactly start hour (08:00, inclusive)", async () => {
    expect(await isWithinQuietWindow(WED_08_AEST)).toBe(true);
  });

  it("returns true at 17:59 (just before end boundary)", async () => {
    expect(await isWithinQuietWindow(WED_1759_AEST)).toBe(true);
  });

  it("returns false at exactly end hour (18:00, exclusive)", async () => {
    expect(await isWithinQuietWindow(WED_18_AEST)).toBe(false);
  });

  it("returns false outside hours (22:00 Melbourne)", async () => {
    expect(await isWithinQuietWindow(WED_22_AEST)).toBe(false);
  });

  it("returns false on Saturday (weekend)", async () => {
    expect(await isWithinQuietWindow(SAT_10_AEST)).toBe(false);
  });

  it("returns false on Sunday (weekend)", async () => {
    expect(await isWithinQuietWindow(SUN_10_AEST)).toBe(false);
  });

  it("returns false on King's Birthday (Mon 8 Jun 2026 — VIC public holiday)", async () => {
    expect(await isWithinQuietWindow(KINGS_BIRTHDAY)).toBe(false);
  });

  it("returns false on Christmas Day (Fri 25 Dec 2026 — public holiday)", async () => {
    expect(await isWithinQuietWindow(CHRISTMAS_2026)).toBe(false);
  });

  it("respects custom start/end hours from settings", async () => {
    // Override to 09:00–17:00 window
    mockGet.mockImplementation(async (key: string) => {
      if (key === "email.quiet_window_start_hour") return 9;
      if (key === "email.quiet_window_end_hour") return 17;
      throw new Error("Unexpected key");
    });

    // 08:00 Melbourne should now be false (before 09:00)
    expect(await isWithinQuietWindow(WED_08_AEST)).toBe(false);
    // 09:00 Melbourne should be true
    expect(await isWithinQuietWindow(WED_09_AEST)).toBe(true);
  });
});
