import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Melbourne time helpers (shared module) ─────────────────────────

describe("TM-9 — Task Manager polish", () => {
  describe("lib/time/melbourne.ts — shared module", () => {
    it("exports melbourneWallDate", async () => {
      const mod = await import("@/lib/time/melbourne");
      expect(typeof mod.melbourneWallDate).toBe("function");
    });

    it("exports melbourneWallToUtcMs", async () => {
      const mod = await import("@/lib/time/melbourne");
      expect(typeof mod.melbourneWallToUtcMs).toBe("function");
    });

    it("exports melbourneOffsetMsAt", async () => {
      const mod = await import("@/lib/time/melbourne");
      expect(typeof mod.melbourneOffsetMsAt).toBe("function");
    });

    it("exports melbourneStartAndEndOfDay", async () => {
      const mod = await import("@/lib/time/melbourne");
      expect(typeof mod.melbourneStartAndEndOfDay).toBe("function");
    });

    it("exports nextMelbourneHourMs", async () => {
      const mod = await import("@/lib/time/melbourne");
      expect(typeof mod.nextMelbourneHourMs).toBe("function");
    });

    it("melbourneWallDate returns year/month/day for a known instant", async () => {
      const { melbourneWallDate } = await import("@/lib/time/melbourne");
      // 2026-01-15 00:00:00 UTC → Melbourne is UTC+11 (AEDT), so it's Jan 15 11:00
      const utcMs = Date.UTC(2026, 0, 15, 0, 0, 0);
      const result = melbourneWallDate(utcMs);
      expect(result.year).toBe(2026);
      expect(result.month).toBe(1);
      expect(result.day).toBe(15);
    });

    it("melbourneStartAndEndOfDay returns valid bounds", async () => {
      const { melbourneStartAndEndOfDay } = await import(
        "@/lib/time/melbourne"
      );
      const HOUR_MS = 60 * 60 * 1000;
      const now = Date.now();
      const { startMs, endMs } = melbourneStartAndEndOfDay(now);
      expect(startMs).toBeLessThan(endMs);
      expect(endMs - startMs).toBeLessThanOrEqual(24 * HOUR_MS);
      expect(endMs - startMs).toBeGreaterThan(23 * HOUR_MS);
    });

    it("nextMelbourneHourMs returns a future time", async () => {
      const { nextMelbourneHourMs } = await import("@/lib/time/melbourne");
      const now = Date.now();
      const nextRun = nextMelbourneHourMs(now, 8);
      expect(nextRun).toBeGreaterThan(now);
    });

    it("nextMelbourneHourMs wraps to next day if hour has passed", async () => {
      const { nextMelbourneHourMs, melbourneWallDate } =
        await import("@/lib/time/melbourne");
      // Jan 15 23:00 UTC = Jan 16 10:00 AEDT — 3am has already passed today
      const utc10amMelb = Date.UTC(2026, 0, 15, 23, 0, 0);
      const next3am = nextMelbourneHourMs(utc10amMelb, 3);
      expect(next3am).toBeGreaterThan(utc10amMelb);
      // Next 3am Melbourne = Jan 17 03:00 AEDT
      const nextDate = melbourneWallDate(next3am);
      expect(nextDate.day).toBe(17);
    });
  });

  // ── Consumer files no longer have local Melbourne helpers ──────────

  describe("deduplication verification", () => {
    const FILES_THAT_SHOULD_NOT_HAVE_LOCAL_HELPERS = [
      "lib/tasks/digest.ts",
      "lib/scheduled-tasks/handlers/inbox-digest.ts",
      "lib/scheduled-tasks/handlers/task-morning-digest.ts",
      "lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts",
    ];

    for (const file of FILES_THAT_SHOULD_NOT_HAVE_LOCAL_HELPERS) {
      it(`${file} does not define its own melbourneOffsetMsAt`, () => {
        const content = fs.readFileSync(
          path.resolve(process.cwd(), file),
          "utf-8",
        );
        expect(content).not.toContain("function melbourneOffsetMsAt");
      });
    }

    it("lib/tasks/digest.ts imports melbourneStartAndEndOfDay from shared module", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "lib/tasks/digest.ts"),
        "utf-8",
      );
      expect(content).toContain(
        'import { melbourneStartAndEndOfDay } from "@/lib/time/melbourne"',
      );
    });

    it("lib/scheduled-tasks/handlers/task-morning-digest.ts imports nextMelbourneHourMs from shared module", () => {
      const content = fs.readFileSync(
        path.resolve(
          process.cwd(),
          "lib/scheduled-tasks/handlers/task-morning-digest.ts",
        ),
        "utf-8",
      );
      expect(content).toContain(
        'import { nextMelbourneHourMs } from "@/lib/time/melbourne"',
      );
    });
  });

  // ── Cockpit integration contracts ─────────────────────────────────

  describe("lib/tasks/cockpit.ts — exports", () => {
    it("exports getTasksForCockpitKanban", async () => {
      const mod = await import("@/lib/tasks/cockpit");
      expect(typeof mod.getTasksForCockpitKanban).toBe("function");
    });

    it("exports getTaskWaitingItems", async () => {
      const mod = await import("@/lib/tasks/cockpit");
      expect(typeof mod.getTaskWaitingItems).toBe("function");
    });

    it("exports getTaskHealthBanners", async () => {
      const mod = await import("@/lib/tasks/cockpit");
      expect(typeof mod.getTaskHealthBanners).toBe("function");
    });
  });

  describe("cockpit contract types", () => {
    it("WaitingItem has correct shape", async () => {
      const item: import("@/lib/tasks/cockpit").WaitingItem = {
        id: "test_1",
        label: "Test task",
        href: "/lite/tasks?open=1",
        urgency: { kind: "time_sensitive", value: Date.now() },
        scope: "own",
        source: "task_manager",
      };
      expect(item.id).toBe("test_1");
      expect(item.urgency.kind).toBe("time_sensitive");
      expect(item.scope).toBe("own");
    });

    it("HealthBanner has correct shape", async () => {
      const banner: import("@/lib/tasks/cockpit").HealthBanner = {
        id: "test_1",
        severity: "warning",
        summary: "3 overdue tasks",
        href: "/lite/tasks?due=overdue",
        source: "task_manager",
      };
      expect(banner.severity).toBe("warning");
      expect(banner.source).toBe("task_manager");
    });

    it("CockpitKanban has mustDo/shouldDo/ifTime arrays", async () => {
      const kanban: import("@/lib/tasks/cockpit").CockpitKanban = {
        mustDo: [],
        shouldDo: [],
        ifTime: [],
      };
      expect(Array.isArray(kanban.mustDo)).toBe(true);
      expect(Array.isArray(kanban.shouldDo)).toBe(true);
      expect(Array.isArray(kanban.ifTime)).toBe(true);
    });
  });

  // ── Deep-link wiring ──────────────────────────────────────────────

  describe("deep-link support", () => {
    it("tasks-page-client.tsx imports useSearchParams", () => {
      const content = fs.readFileSync(
        path.resolve(
          process.cwd(),
          "components/lite/admin/tasks/tasks-page-client.tsx",
        ),
        "utf-8",
      );
      expect(content).toContain("useSearchParams");
      expect(content).toContain('searchParams.get("open")');
    });
  });

  // ── Digest bootstrap wiring ───────────────────────────────────────

  describe("digest bootstrap", () => {
    it("auth.ts imports and calls ensureTaskDigestEnqueued", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "lib/auth/auth.ts"),
        "utf-8",
      );
      expect(content).toContain("ensureTaskDigestEnqueued");
      expect(content).toContain("void ensureTaskDigestEnqueued()");
    });
  });

  // ── Dynamic browser tab title ─────────────────────────────────────

  describe("dynamic tab title", () => {
    it("tasks page uses generateMetadata instead of static metadata", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "app/lite/tasks/page.tsx"),
        "utf-8",
      );
      expect(content).toContain("generateMetadata");
      expect(content).not.toMatch(/^export const metadata/m);
    });

    it("tab title includes overdue count logic", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "app/lite/tasks/page.tsx"),
        "utf-8",
      );
      expect(content).toContain("overdue");
      expect(content).toContain("nothing's on fire");
    });
  });

  // ── Barrel re-export ──────────────────────────────────────────────

  describe("barrel export", () => {
    it("lib/tasks/index.ts re-exports cockpit", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "lib/tasks/index.ts"),
        "utf-8",
      );
      expect(content).toContain('./cockpit"');
    });
  });
});
