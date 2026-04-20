import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";

const authMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "admin" } }),
);

vi.mock("@/lib/auth/session", () => ({ auth: authMock }));

const invokeLlmTextMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("null"),
);

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: invokeLlmTextMock,
  invokeLlmTextWithMeta: vi.fn(),
}));

let testDb: ReturnType<typeof drizzle>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    llm_calls_enabled: true,
    outreach_send_enabled: false,
    scheduled_tasks_enabled: false,
    drift_check_enabled: false,
    sentry_enabled: false,
  },
  KILL_SWITCH_KEYS: [],
  resetKillSwitchesToDefaults: vi.fn(),
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-sd4-admin-eggs.db");
let sqlite: Database.Database;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  const folder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(testDb, { migrationsFolder: folder });
  runSeeds(sqlite, folder);
});

afterAll(() => {
  sqlite.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

function ensureUser(id: string, role = "admin") {
  const existing = sqlite
    .prepare("SELECT id FROM user WHERE id = ?")
    .get(id);
  if (!existing) {
    sqlite
      .prepare(
        `INSERT INTO user (id, email, role, name, theme_preset, density_preference, typeface_preset, hidden_egg_tricks_enabled, created_at_ms) VALUES (?, ?, ?, ?, 'standard', 'comfortable', 'house', 1, ?)`,
      )
      .run(id, `${id}@test.com`, role, id, Date.now());
  }
}

function insertActivityLog(
  kind: string,
  body: string,
  createdAtMs: number,
  contactId?: string,
  companyId?: string,
) {
  const id = `al-${Math.random().toString(36).slice(2, 10)}`;
  sqlite
    .prepare(
      `INSERT INTO activity_log (id, kind, body, created_at_ms, contact_id, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, kind, body, createdAtMs, contactId ?? null, companyId ?? null);
  return id;
}

function clearTable(table: string) {
  sqlite.prepare(`DELETE FROM ${table}`).run();
}

describe("CRT turn-off admin trigger", () => {
  beforeEach(() => {
    clearTable("activity_log");
    clearTable("hidden_egg_fires");
    ensureUser("admin-1");
  });

  it("fires when 3 distinct late-night sessions exist within 7 days", async () => {
    const { evaluateCrtTurnOff } = await import(
      "@/lib/eggs/admin-triggers/crt-turn-off"
    );
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // 3 sessions at 2am Melbourne (approx — using UTC offsets for AEST +10/+11)
    // Melbourne is UTC+10 (AEST) or UTC+11 (AEDT). For simplicity, use
    // timestamps that resolve to 2am Melbourne regardless.
    for (let i = 0; i < 3; i++) {
      const sessionTime = now - (i + 1) * day;
      // Create a date at ~2am Melbourne time
      const d = new Date(sessionTime);
      d.setUTCHours(16, 0, 0, 0); // 16:00 UTC = 02:00 AEST (UTC+10)
      insertActivityLog("admin_session_started", "Admin signed in", d.getTime());
    }

    const result = await evaluateCrtTurnOff("admin-1", now);
    expect(result.shouldFire).toBe(true);
    expect(result.evidence.distinctDayCount).toBeGreaterThanOrEqual(3);
  });

  it("does not fire with only 2 late-night sessions", async () => {
    const { evaluateCrtTurnOff } = await import(
      "@/lib/eggs/admin-triggers/crt-turn-off"
    );
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    for (let i = 0; i < 2; i++) {
      const d = new Date(now - (i + 1) * day);
      d.setUTCHours(16, 0, 0, 0);
      insertActivityLog("admin_session_started", "Admin signed in", d.getTime());
    }

    const result = await evaluateCrtTurnOff("admin-1", now);
    expect(result.shouldFire).toBe(false);
  });

  it("does not fire if already fired within 30-day cooldown", async () => {
    const { evaluateCrtTurnOff } = await import(
      "@/lib/eggs/admin-triggers/crt-turn-off"
    );
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    for (let i = 0; i < 3; i++) {
      const d = new Date(now - (i + 1) * day);
      d.setUTCHours(16, 0, 0, 0);
      insertActivityLog("admin_session_started", "Admin signed in", d.getTime());
    }

    sqlite
      .prepare(
        `INSERT INTO hidden_egg_fires (id, egg_id, actor_type, user_id, fired_at_ms, trigger_evidence) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "hef-1",
        "crt_turn_off",
        "admin",
        "admin-1",
        now - 5 * day,
        JSON.stringify({ reason: "test" }),
      );

    const result = await evaluateCrtTurnOff("admin-1", now);
    expect(result.shouldFire).toBe(false);
  });

  it("does not count sessions during normal hours", async () => {
    const { evaluateCrtTurnOff } = await import(
      "@/lib/eggs/admin-triggers/crt-turn-off"
    );
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    for (let i = 0; i < 3; i++) {
      const d = new Date(now - (i + 1) * day);
      d.setUTCHours(0, 0, 0, 0); // 10:00 AEST — normal working hour
      insertActivityLog("admin_session_started", "Admin signed in", d.getTime());
    }

    const result = await evaluateCrtTurnOff("admin-1", now);
    expect(result.shouldFire).toBe(false);
  });
});

describe("Three Wons admin trigger (migrated)", () => {
  beforeEach(() => {
    clearTable("hidden_egg_fires");
    ensureUser("admin-1");
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  });

  it("fires and writes to hidden_egg_fires on a fresh admin call", async () => {
    const { maybeFireThreeWonsEgg } = await import(
      "@/lib/eggs/admin-triggers/three-wons"
    );
    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(true);

    const row = sqlite
      .prepare("SELECT * FROM hidden_egg_fires WHERE egg_id = 'three_wons'")
      .get() as { egg_id: string; actor_type: string; user_id: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.actor_type).toBe("admin");
    expect(row!.user_id).toBe("admin-1");
  });

  it("does not re-fire within 30-day cooldown", async () => {
    const { maybeFireThreeWonsEgg } = await import(
      "@/lib/eggs/admin-triggers/three-wons"
    );
    const first = await maybeFireThreeWonsEgg();
    expect(first).toBe(true);
    const second = await maybeFireThreeWonsEgg();
    expect(second).toBe(false);
  });

  it("refuses for non-admin sessions", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "client-1", role: "client" },
    });
    const { maybeFireThreeWonsEgg } = await import(
      "@/lib/eggs/admin-triggers/three-wons"
    );
    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(false);
  });

  it("refuses when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const { maybeFireThreeWonsEgg } = await import(
      "@/lib/eggs/admin-triggers/three-wons"
    );
    const fired = await maybeFireThreeWonsEgg();
    expect(fired).toBe(false);
  });
});

describe("Milestone spotter", () => {
  beforeEach(() => {
    clearTable("activity_log");
    clearTable("hidden_egg_fires");
    invokeLlmTextMock.mockReset();
    invokeLlmTextMock.mockResolvedValue("null");
  });

  it("returns empty when no notes exist", async () => {
    const { scanForMilestones } = await import(
      "@/lib/eggs/admin-triggers/milestone-spotter"
    );
    const results = await scanForMilestones(Date.now());
    expect(results).toEqual([]);
  });

  it("returns empty when note has no milestone", async () => {
    const { scanForMilestones } = await import(
      "@/lib/eggs/admin-triggers/milestone-spotter"
    );
    insertActivityLog("note", "Discussed marketing strategy for next quarter.", Date.now());
    invokeLlmTextMock.mockResolvedValue("null");

    const results = await scanForMilestones(Date.now());
    expect(results).toEqual([]);
  });

  it("detects a milestone when Claude extracts one", async () => {
    const { scanForMilestones } = await import(
      "@/lib/eggs/admin-triggers/milestone-spotter"
    );
    const now = Date.now();
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    insertActivityLog(
      "note",
      "Jess turns 5 in April. They mentioned the birthday party is tomorrow.",
      now,
    );
    invokeLlmTextMock.mockResolvedValue(
      JSON.stringify({
        eventType: "birthday",
        eventDate: tomorrow,
        dateConfidence: "exact",
      }),
    );

    const results = await scanForMilestones(now);
    expect(results.length).toBe(1);
    expect(results[0].eventType).toBe("birthday");
  });

  it("skips milestones more than 14 days in the future", async () => {
    const { scanForMilestones } = await import(
      "@/lib/eggs/admin-triggers/milestone-spotter"
    );
    const now = Date.now();
    const farFuture = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    insertActivityLog("note", "Business anniversary coming up", now);
    invokeLlmTextMock.mockResolvedValue(
      JSON.stringify({
        eventType: "anniversary",
        eventDate: farFuture,
        dateConfidence: "exact",
      }),
    );

    const results = await scanForMilestones(now);
    expect(results).toEqual([]);
  });

  it("skips milestones more than 3 days in the past", async () => {
    const { scanForMilestones } = await import(
      "@/lib/eggs/admin-triggers/milestone-spotter"
    );
    const now = Date.now();
    const pastDate = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    insertActivityLog("note", "Anniversary was last week", now);
    invokeLlmTextMock.mockResolvedValue(
      JSON.stringify({
        eventType: "anniversary",
        eventDate: pastDate,
        dateConfidence: "exact",
      }),
    );

    const results = await scanForMilestones(now);
    expect(results).toEqual([]);
  });

  it("skips notes shorter than 10 chars", async () => {
    const { scanForMilestones } = await import(
      "@/lib/eggs/admin-triggers/milestone-spotter"
    );
    insertActivityLog("note", "Short.", Date.now());

    const results = await scanForMilestones(Date.now());
    expect(results).toEqual([]);
    expect(invokeLlmTextMock).not.toHaveBeenCalled();
  });
});

describe("Milestone draft generation", () => {
  it("calls LLM with milestone context", async () => {
    const { generateMilestoneDraft } = await import(
      "@/lib/eggs/admin-triggers/milestone-spotter"
    );
    invokeLlmTextMock.mockResolvedValue(
      "Happy birthday to Jess — five is a big one.",
    );

    const draft = await generateMilestoneDraft({
      contactId: "c-1",
      companyId: null,
      contactName: "Jane Smith",
      companyName: null,
      eventType: "birthday",
      eventDate: "2026-04-25",
      dateConfidence: "exact",
      sourceNoteId: "n-1",
      sourceText: "Jess turns 5 in April",
      draftMessage: null,
    });

    expect(draft).toContain("Jess");
    expect(invokeLlmTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ job: "sd-milestone-draft" }),
    );
  });
});
