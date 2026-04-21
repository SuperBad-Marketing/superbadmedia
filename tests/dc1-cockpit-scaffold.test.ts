import { describe, it, expect } from "vitest";
import { sortWaitingItems } from "@/lib/cockpit/aggregator";
import type { WaitingItem } from "@/lib/tasks/cockpit";
import { getCurrentSlot } from "@/lib/cockpit/queries";

describe("DC-1 — Daily Cockpit scaffold", () => {
  describe("sortWaitingItems", () => {
    it("sorts time_sensitive before age_of_wait", () => {
      const items: WaitingItem[] = [
        {
          id: "b",
          label: "age item",
          href: "/b",
          urgency: { kind: "age_of_wait", value: 1000 },
          scope: "own",
          source: "test",
        },
        {
          id: "a",
          label: "time item",
          href: "/a",
          urgency: { kind: "time_sensitive", value: 2000 },
          scope: "own",
          source: "test",
        },
      ];
      const sorted = sortWaitingItems(items);
      expect(sorted[0].id).toBe("a");
      expect(sorted[1].id).toBe("b");
    });

    it("sorts time_sensitive items by deadline ASC", () => {
      const items: WaitingItem[] = [
        {
          id: "later",
          label: "later",
          href: "/later",
          urgency: { kind: "time_sensitive", value: 3000 },
          scope: "own",
          source: "test",
        },
        {
          id: "sooner",
          label: "sooner",
          href: "/sooner",
          urgency: { kind: "time_sensitive", value: 1000 },
          scope: "own",
          source: "test",
        },
      ];
      const sorted = sortWaitingItems(items);
      expect(sorted[0].id).toBe("sooner");
      expect(sorted[1].id).toBe("later");
    });

    it("sorts age_of_wait items by wait-start ASC (longest wait first)", () => {
      const items: WaitingItem[] = [
        {
          id: "recent",
          label: "recent",
          href: "/recent",
          urgency: { kind: "age_of_wait", value: 5000 },
          scope: "own",
          source: "test",
        },
        {
          id: "oldest",
          label: "oldest",
          href: "/oldest",
          urgency: { kind: "age_of_wait", value: 1000 },
          scope: "own",
          source: "test",
        },
      ];
      const sorted = sortWaitingItems(items);
      expect(sorted[0].id).toBe("oldest");
      expect(sorted[1].id).toBe("recent");
    });

    it("tiebreaks on id", () => {
      const items: WaitingItem[] = [
        {
          id: "z",
          label: "z",
          href: "/z",
          urgency: { kind: "time_sensitive", value: 1000 },
          scope: "own",
          source: "test",
        },
        {
          id: "a",
          label: "a",
          href: "/a",
          urgency: { kind: "time_sensitive", value: 1000 },
          scope: "own",
          source: "test",
        },
      ];
      const sorted = sortWaitingItems(items);
      expect(sorted[0].id).toBe("a");
      expect(sorted[1].id).toBe("z");
    });

    it("returns empty array for empty input", () => {
      expect(sortWaitingItems([])).toEqual([]);
    });
  });

  describe("getCurrentSlot", () => {
    it("returns morning for 7am Melbourne time", () => {
      const mel7am = new Date("2026-04-21T07:00:00+10:00").getTime();
      expect(getCurrentSlot(mel7am)).toBe("morning");
    });

    it("returns midday for 1pm Melbourne time", () => {
      const mel1pm = new Date("2026-04-21T13:00:00+10:00").getTime();
      expect(getCurrentSlot(mel1pm)).toBe("midday");
    });

    it("returns evening for 7pm Melbourne time", () => {
      const mel7pm = new Date("2026-04-21T19:00:00+10:00").getTime();
      expect(getCurrentSlot(mel7pm)).toBe("evening");
    });

    it("returns morning for exactly 6am", () => {
      const mel6am = new Date("2026-04-21T06:00:00+10:00").getTime();
      expect(getCurrentSlot(mel6am)).toBe("morning");
    });

    it("returns midday for exactly 12pm", () => {
      const mel12pm = new Date("2026-04-21T12:00:00+10:00").getTime();
      expect(getCurrentSlot(mel12pm)).toBe("midday");
    });

    it("returns evening for exactly 6:30pm", () => {
      const mel630pm = new Date("2026-04-21T18:30:00+10:00").getTime();
      expect(getCurrentSlot(mel630pm)).toBe("evening");
    });
  });

  describe("cockpit_briefs schema", () => {
    it("exports the table and types", async () => {
      const { cockpit_briefs, COCKPIT_BRIEF_SLOTS, COCKPIT_BRIEF_TRIGGERS } =
        await import("@/lib/db/schema/cockpit-briefs");
      expect(cockpit_briefs).toBeDefined();
      expect(COCKPIT_BRIEF_SLOTS).toEqual(["morning", "midday", "evening"]);
      expect(COCKPIT_BRIEF_TRIGGERS).toEqual(["cron", "material_event"]);
    });
  });
});
