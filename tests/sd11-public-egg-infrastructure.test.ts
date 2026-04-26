import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import fs from "node:fs";
import path from "node:path";

const TEST_DB = "test-sd11-public-eggs.db";

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  testDb = drizzle(sqlite, { schema });
  const migrationsFolder = path.join(process.cwd(), "lib", "db", "migrations");
  if (fs.existsSync(migrationsFolder)) {
    drizzleMigrate(testDb, { migrationsFolder });
  }
});

afterAll(() => {
  sqlite?.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

// ---------------------------------------------------------------------------
// Public egg state (cookie/localStorage management)
// ---------------------------------------------------------------------------
describe("public-egg-state", () => {
  it("recordVisit adds today to visitDates", async () => {
    const { recordVisit, getVisitCount } = await import("@/lib/eggs/public-egg-state");
    const state = {
      firstEggDeliveredAt: null,
      lastHiddenEggFiredAt: null,
      firedEggIds: [],
      tricksDisabled: false,
      visitDates: [],
      sessionFiredEggIds: [],
    };

    const after = recordVisit(state);
    expect(getVisitCount(after)).toBe(1);
    expect(after.visitDates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("recordVisit deduplicates same-day visits", async () => {
    const { recordVisit, getVisitCount } = await import("@/lib/eggs/public-egg-state");
    const today = new Date().toISOString().slice(0, 10);
    const state = {
      firstEggDeliveredAt: null,
      lastHiddenEggFiredAt: null,
      firedEggIds: [],
      tricksDisabled: false,
      visitDates: [today],
      sessionFiredEggIds: [],
    };

    const after = recordVisit(state);
    expect(getVisitCount(after)).toBe(1);
  });

  it("recordEggFired sets firstEggDeliveredAt on first fire", async () => {
    const { recordEggFired } = await import("@/lib/eggs/public-egg-state");
    const state = {
      firstEggDeliveredAt: null,
      lastHiddenEggFiredAt: null,
      firedEggIds: [],
      tricksDisabled: false,
      visitDates: [],
      sessionFiredEggIds: [],
    };

    const after = recordEggFired(state, "late_night_visitor");
    expect(after.firstEggDeliveredAt).toBeGreaterThan(0);
    expect(after.lastHiddenEggFiredAt).toBeGreaterThan(0);
    expect(after.firedEggIds).toContain("late_night_visitor");
    expect(after.sessionFiredEggIds).toContain("late_night_visitor");
  });

  it("recordEggFired preserves existing firstEggDeliveredAt", async () => {
    const { recordEggFired } = await import("@/lib/eggs/public-egg-state");
    const state = {
      firstEggDeliveredAt: 1000,
      lastHiddenEggFiredAt: 1000,
      firedEggIds: ["late_night_visitor"],
      tricksDisabled: false,
      visitDates: [],
      sessionFiredEggIds: [],
    };

    const after = recordEggFired(state, "sunday_researcher");
    expect(after.firstEggDeliveredAt).toBe(1000);
  });

  it("setTricksDisabled toggles the flag", async () => {
    const { setTricksDisabled } = await import("@/lib/eggs/public-egg-state");
    const state = {
      firstEggDeliveredAt: null,
      lastHiddenEggFiredAt: null,
      firedEggIds: [],
      tricksDisabled: false,
      visitDates: [],
      sessionFiredEggIds: [],
    };

    const after = setTricksDisabled(state, true);
    expect(after.tricksDisabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Trigger evaluator — verify public triggers register and evaluate
// ---------------------------------------------------------------------------
describe("trigger-evaluator with public triggers", () => {
  beforeEach(async () => {
    await import("@/lib/eggs/triggers");
  });

  it("evaluates late_night_visitor when localHour is 3am", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 3,
      dayOfWeek: 2,
      referrer: "",
      dwellMs: 10000,
      scrollDepth: 0.5,
      scrollDurationMs: 5000,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
    });

    const lateNight = results.find((r) => r.eggId === "late_night_visitor");
    expect(lateNight).toBeDefined();
    expect(lateNight!.evidence.reason).toBe("visitor_local_time_0200_0459");
  });

  it("evaluates sunday_researcher on Sunday with search referrer and dwell > 45s", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 14,
      dayOfWeek: 0,
      referrer: "https://www.google.com/search?q=marketing+agency",
      dwellMs: 60000,
      scrollDepth: 0.5,
      scrollDurationMs: 30000,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
    });

    const sunday = results.find((r) => r.eggId === "sunday_researcher");
    expect(sunday).toBeDefined();
  });

  it("evaluates rapid_scroller when scrolled full page under 6s", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 14,
      dayOfWeek: 2,
      referrer: "",
      dwellMs: 10000,
      scrollDepth: 0.95,
      scrollDurationMs: 4000,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
    });

    const rapid = results.find((r) => r.eggId === "rapid_scroller");
    expect(rapid).toBeDefined();
  });

  it("evaluates abandoned_tab when backgrounded 10+ min", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 14,
      dayOfWeek: 2,
      referrer: "",
      dwellMs: 700000,
      scrollDepth: 0.5,
      scrollDurationMs: 30000,
      tabBackgroundedMs: 700000,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
    });

    const abandoned = results.find((r) => r.eggId === "abandoned_tab");
    expect(abandoned).toBeDefined();
  });

  it("does not fire late_night at 10am", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 10,
      dayOfWeek: 2,
      referrer: "",
      dwellMs: 10000,
      scrollDepth: 0.5,
      scrollDurationMs: 5000,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
    });

    const lateNight = results.find((r) => r.eggId === "late_night_visitor");
    expect(lateNight).toBeUndefined();
  });

  it("melbourne_rain fires when precipitation > 0 and Melbourne timezone", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 14,
      dayOfWeek: 2,
      referrer: "",
      dwellMs: 10000,
      scrollDepth: 0.5,
      scrollDurationMs: 5000,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
      weatherPrecipitationMm: 2.5,
    });

    const rain = results.find((r) => r.eggId === "melbourne_rain");
    expect(rain).toBeDefined();
  });

  it("public_crt_turn_off fires at 2am Melbourne with 3+ min dwell", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 14,
      dayOfWeek: 2,
      referrer: "",
      dwellMs: 200000,
      scrollDepth: 0.5,
      scrollDurationMs: 5000,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
      melbourneHour: 2,
      firedEggIdsInSession: [],
    });

    const crt = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(crt).toBeDefined();
  });

  it("public_crt_turn_off does NOT fire if late_night_visitor already fired in session", async () => {
    const { evaluateAllTriggers } = await import("@/lib/eggs/trigger-evaluator");

    const results = evaluateAllTriggers({
      nowMs: Date.now(),
      localHour: 3,
      dayOfWeek: 2,
      referrer: "",
      dwellMs: 200000,
      scrollDepth: 0.5,
      scrollDurationMs: 5000,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "test",
      isMobile: false,
      melbourneHour: 3,
      firedEggIdsInSession: ["late_night_visitor"],
    });

    const crt = results.find((r) => r.eggId === "public_crt_turn_off");
    expect(crt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cadence gates for public eggs
// ---------------------------------------------------------------------------
describe("cadence gates — public", () => {
  it("allows first egg when no prior fires", async () => {
    const { canFirePublicEgg } = await import("@/lib/eggs/cadence");
    const { PUBLIC_EGGS } = await import("@/lib/eggs/registry");

    const egg = PUBLIC_EGGS.find((e) => e.id === "late_night_visitor")!;
    const ok = canFirePublicEgg(
      egg,
      { firstEggDeliveredAt: null, lastHiddenEggFiredAt: null, firedEggIds: [], tricksDisabled: false },
      Date.now(),
      14,
    );
    expect(ok).toBe(true);
  });

  it("blocks when tricks disabled", async () => {
    const { canFirePublicEgg } = await import("@/lib/eggs/cadence");
    const { PUBLIC_EGGS } = await import("@/lib/eggs/registry");

    const egg = PUBLIC_EGGS.find((e) => e.id === "late_night_visitor")!;
    const ok = canFirePublicEgg(
      egg,
      { firstEggDeliveredAt: 1000, lastHiddenEggFiredAt: Date.now(), firedEggIds: ["a", "b"], tricksDisabled: true },
      Date.now(),
      14,
    );
    expect(ok).toBe(false);
  });

  it("allows budget-exempt eggs even when budget exhausted", async () => {
    const { canFirePublicEgg } = await import("@/lib/eggs/cadence");
    const { PUBLIC_EGGS } = await import("@/lib/eggs/registry");

    const egg = PUBLIC_EGGS.find((e) => e.id === "public_crt_turn_off")!;
    expect(egg.exemptFromBudget).toBe(true);

    const ok = canFirePublicEgg(
      egg,
      { firstEggDeliveredAt: 1000, lastHiddenEggFiredAt: Date.now(), firedEggIds: ["a", "b"], tricksDisabled: false },
      Date.now(),
      14,
    );
    expect(ok).toBe(true);
  });

  it("blocks one-shot eggs that already fired", async () => {
    const { canFirePublicEgg } = await import("@/lib/eggs/cadence");
    const { PUBLIC_EGGS } = await import("@/lib/eggs/registry");

    const egg = PUBLIC_EGGS.find((e) => e.id === "sunday_researcher")!;
    expect(egg.cooldownDays).toBe(Infinity);

    const ok = canFirePublicEgg(
      egg,
      { firstEggDeliveredAt: 1000, lastHiddenEggFiredAt: 1000, firedEggIds: ["sunday_researcher"], tricksDisabled: false },
      Date.now(),
      14,
    );
    expect(ok).toBe(false);
  });
});
