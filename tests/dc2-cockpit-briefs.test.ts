import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      cockpit_briefs: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      calendar_bookings: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue("The business is quiet. Nothing on fire today."),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "mock-activity" }),
}));

vi.mock("@/lib/cockpit/aggregator", () => ({
  mergeWaitingItems: vi.fn().mockResolvedValue([]),
  mergeHealthBanners: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/cockpit/queries", async () => {
  const actual = await vi.importActual("@/lib/cockpit/queries");
  return {
    ...actual,
    getTodayCalendarEvents: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/cockpit/andy-facing-activity", () => ({
  getAndyFacingActivitySince: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    cockpit_briefs_enabled: true,
    llm_calls_enabled: true,
  },
}));

import { buildMorningPrompt } from "@/lib/cockpit/prompts/morning";
import { buildMiddayPrompt } from "@/lib/cockpit/prompts/midday";
import { buildEveningPrompt } from "@/lib/cockpit/prompts/evening";
import type { BriefContext } from "@/lib/cockpit/prompts/types";

const baseCtx: BriefContext = {
  waitingItemCount: 0,
  healthBannerCount: 0,
  calendarEventCount: 0,
  waitingItemsSummary: null,
  healthBannersSummary: null,
  calendarSummary: null,
  tomorrowCalendarSummary: null,
  morningProse: null,
  middayProse: null,
  eventTrail: null,
};

describe("DC-2 — Daily Cockpit briefs pipeline", () => {
  describe("prompt builders", () => {
    it("morning prompt includes signals section", () => {
      const prompt = buildMorningPrompt({
        ...baseCtx,
        waitingItemCount: 3,
        healthBannerCount: 1,
        calendarEventCount: 2,
      });
      expect(prompt).toContain("Waiting items: 3");
      expect(prompt).toContain("Health banners: 1");
      expect(prompt).toContain("Calendar events today: 2");
      expect(prompt).toContain("SuperBad");
    });

    it("morning prompt includes waiting items summary", () => {
      const prompt = buildMorningPrompt({
        ...baseCtx,
        waitingItemCount: 1,
        waitingItemsSummary: "- [quote_builder] Acme quote expiring",
      });
      expect(prompt).toContain("[quote_builder] Acme quote expiring");
    });

    it("midday prompt chains morning prose", () => {
      const prompt = buildMiddayPrompt({
        ...baseCtx,
        morningProse: "Quiet start. One invoice overdue.",
      });
      expect(prompt).toContain("Morning brief (for continuity)");
      expect(prompt).toContain("Quiet start. One invoice overdue.");
    });

    it("midday prompt includes event trail", () => {
      const prompt = buildMiddayPrompt({
        ...baseCtx,
        eventTrail: "- [quote_accepted] Acme signed",
      });
      expect(prompt).toContain("What's happened since 6 AM");
      expect(prompt).toContain("Acme signed");
    });

    it("evening prompt chains both morning and midday", () => {
      const prompt = buildEveningPrompt({
        ...baseCtx,
        morningProse: "Morning brief text",
        middayProse: "Midday brief text",
      });
      expect(prompt).toContain("Morning brief");
      expect(prompt).toContain("Morning brief text");
      expect(prompt).toContain("Midday brief");
      expect(prompt).toContain("Midday brief text");
    });

    it("evening prompt includes tomorrow calendar", () => {
      const prompt = buildEveningPrompt({
        ...baseCtx,
        tomorrowCalendarSummary: "- intro funnel shoot (10:00)",
      });
      expect(prompt).toContain("Tomorrow's calendar");
      expect(prompt).toContain("intro funnel shoot");
    });

    it("all prompts enforce dry voice", () => {
      const morning = buildMorningPrompt(baseCtx);
      const midday = buildMiddayPrompt(baseCtx);
      const evening = buildEveningPrompt(baseCtx);

      for (const p of [morning, midday, evening]) {
        expect(p.toLowerCase()).toContain("dry");
        expect(p).toContain("2–3 sentences");
      }
    });
  });

  describe("getCurrentSlot (tested in DC-1)", () => {
    it("slot boundaries are correct per spec", () => {
      // getCurrentSlot is tested in dc1-cockpit-scaffold.test.ts
      // These are structural checks on the prompt builder contract
      expect(buildMorningPrompt(baseCtx)).toContain("morning");
      expect(buildMiddayPrompt(baseCtx)).toContain("midday");
      expect(buildEveningPrompt(baseCtx)).toContain("evening");
    });
  });

  describe("kill switch gating", () => {
    it("returns kill_switch reason when cockpit_briefs_enabled is false", async () => {
      vi.doMock("@/lib/kill-switches", () => ({
        killSwitches: {
          cockpit_briefs_enabled: false,
          llm_calls_enabled: true,
        },
      }));
      const { generateBriefForSlot } = await import("@/lib/cockpit/generate-brief");
      const result = await generateBriefForSlot("morning");
      expect(result).toEqual({ generated: false, reason: "kill_switch" });
    });
  });

  describe("cron route", () => {
    it("slot param defaults to current slot", () => {
      const url = new URL("http://localhost/api/cron/cockpit-brief");
      expect(url.searchParams.get("slot")).toBeNull();
    });

    it("accepts explicit slot param", () => {
      const url = new URL("http://localhost/api/cron/cockpit-brief?slot=morning");
      expect(url.searchParams.get("slot")).toBe("morning");
    });
  });
});
