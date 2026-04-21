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

const TEST_DB = path.join(process.cwd(), "tests/.test-sd13-admin-eggs.db");
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
) {
  const id = `al-${Math.random().toString(36).slice(2, 10)}`;
  sqlite
    .prepare(
      `INSERT INTO activity_log (id, kind, body, created_at_ms) VALUES (?, ?, ?, ?)`,
    )
    .run(id, kind, body, createdAtMs);
  return id;
}

function insertDeal(id: string, stage: string, updatedAtMs: number) {
  const companyId = `co-${id}`;
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO companies (id, name, name_normalised, shape, first_seen_at_ms, created_at_ms, updated_at_ms) VALUES (?, ?, ?, 'small_local', ?, ?, ?)`,
    )
    .run(companyId, `Company ${id}`, `company ${id}`, updatedAtMs, updatedAtMs, updatedAtMs);
  sqlite
    .prepare(
      `INSERT INTO deals (id, company_id, title, stage, last_stage_change_at_ms, updated_at_ms, created_at_ms, value_estimated) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(id, companyId, `Deal ${id}`, stage, updatedAtMs, updatedAtMs, updatedAtMs);
}

function clearTable(table: string) {
  sqlite.prepare(`DELETE FROM ${table}`).run();
}

// -------------------------------------------------------
// getAmbientCopy
// -------------------------------------------------------

describe("getAmbientCopy", () => {
  beforeEach(() => {
    clearTable("ambient_copy_cache");
  });

  it("returns cached text for a valid slot", async () => {
    const { getAmbientCopy } = await import(
      "@/lib/eggs/get-ambient-copy"
    );
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO ambient_copy_cache (id, slot, context_hash, generated_text, generated_at_ms) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("acc-1", "empty_state", "default:empty_state", "nothing here. as expected.", now);

    const text = await getAmbientCopy("empty_state");
    expect(text).toBe("nothing here. as expected.");
  });

  it("returns null when no cached copy exists", async () => {
    const { getAmbientCopy } = await import(
      "@/lib/eggs/get-ambient-copy"
    );
    const text = await getAmbientCopy("error_page");
    expect(text).toBeNull();
  });

  it("returns null when cached copy is expired", async () => {
    const { getAmbientCopy } = await import(
      "@/lib/eggs/get-ambient-copy"
    );
    const expiredMs = Date.now() - 60 * 86_400_000; // 60 days ago
    sqlite
      .prepare(
        `INSERT INTO ambient_copy_cache (id, slot, context_hash, generated_text, generated_at_ms) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("acc-2", "loading_copy", "default:loading_copy", "still here.", expiredMs);

    const text = await getAmbientCopy("loading_copy");
    expect(text).toBeNull();
  });

  it("returns the most recent text when multiple exist", async () => {
    const { getAmbientCopy } = await import(
      "@/lib/eggs/get-ambient-copy"
    );
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO ambient_copy_cache (id, slot, context_hash, generated_text, generated_at_ms) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("acc-3", "success_toast", "default:success_toast", "old copy.", now - 1000);
    sqlite
      .prepare(
        `INSERT INTO ambient_copy_cache (id, slot, context_hash, generated_text, generated_at_ms) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("acc-4", "success_toast", "default:success_toast", "fresh copy.", now);

    const text = await getAmbientCopy("success_toast");
    expect(text).toBe("fresh copy.");
  });
});

// -------------------------------------------------------
// Weekend warrior
// -------------------------------------------------------

describe("Weekend warrior", () => {
  beforeEach(() => {
    clearTable("activity_log");
    clearTable("hidden_egg_fires");
    ensureUser("admin-1");
  });

  it("does not fire on a weekday", async () => {
    const { evaluateWeekendWarrior } = await import(
      "@/lib/eggs/admin-triggers/weekend-warrior"
    );
    // 2026-04-20 is a Monday in Melbourne
    const mondayMs = new Date("2026-04-20T10:00:00+10:00").getTime();
    const result = await evaluateWeekendWarrior("admin-1", mondayMs);
    expect(result.shouldFire).toBe(false);
  });

  it("does not fire with insufficient sessions on a weekend", async () => {
    const { evaluateWeekendWarrior } = await import(
      "@/lib/eggs/admin-triggers/weekend-warrior"
    );
    // 2026-04-25 is a Saturday in Melbourne
    const satMs = new Date("2026-04-25T14:00:00+10:00").getTime();
    insertActivityLog("admin_session_started", "session", satMs - 3600000);
    const result = await evaluateWeekendWarrior("admin-1", satMs);
    expect(result.shouldFire).toBe(false);
  });

  it("fires on a Saturday with 3+ sessions", async () => {
    const { evaluateWeekendWarrior } = await import(
      "@/lib/eggs/admin-triggers/weekend-warrior"
    );
    const satMs = new Date("2026-04-25T16:00:00+10:00").getTime();
    insertActivityLog("admin_session_started", "session", satMs - 7200000);
    insertActivityLog("admin_session_started", "session", satMs - 3600000);
    insertActivityLog("admin_session_started", "session", satMs - 1800000);
    const result = await evaluateWeekendWarrior("admin-1", satMs);
    expect(result.shouldFire).toBe(true);
    expect(result.evidence.dayOfWeek).toBe(6);
    expect(result.evidence.sessionCount).toBe(3);
  });

  it("respects 30-day cooldown", async () => {
    const { evaluateWeekendWarrior } = await import(
      "@/lib/eggs/admin-triggers/weekend-warrior"
    );
    const satMs = new Date("2026-04-25T16:00:00+10:00").getTime();
    insertActivityLog("admin_session_started", "session", satMs - 7200000);
    insertActivityLog("admin_session_started", "session", satMs - 3600000);
    insertActivityLog("admin_session_started", "session", satMs - 1800000);

    sqlite
      .prepare(
        `INSERT INTO hidden_egg_fires (id, egg_id, actor_type, user_id, fired_at_ms, trigger_evidence) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("hef-ww-1", "weekend_warrior", "admin", "admin-1", satMs - 86400000, "{}");

    const result = await evaluateWeekendWarrior("admin-1", satMs);
    expect(result.shouldFire).toBe(false);
  });
});

// -------------------------------------------------------
// Inbox zero
// -------------------------------------------------------

describe("Inbox zero", () => {
  beforeEach(() => {
    clearTable("scheduled_tasks");
    clearTable("hidden_egg_fires");
    ensureUser("admin-1");
  });

  it("fires when no pending tasks exist", async () => {
    const { evaluateInboxZero } = await import(
      "@/lib/eggs/admin-triggers/inbox-zero"
    );
    const result = await evaluateInboxZero("admin-1");
    expect(result.shouldFire).toBe(true);
    expect(result.evidence.clearedAt).toBeGreaterThan(0);
  });

  it("does not fire when pending tasks exist", async () => {
    const { evaluateInboxZero } = await import(
      "@/lib/eggs/admin-triggers/inbox-zero"
    );
    sqlite
      .prepare(
        `INSERT INTO scheduled_tasks (id, task_type, status, run_at_ms, created_at_ms) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("st-1", "ambient_copy_generate", "pending", Date.now(), Date.now());

    const result = await evaluateInboxZero("admin-1");
    expect(result.shouldFire).toBe(false);
  });

  it("respects 30-day cooldown", async () => {
    const { evaluateInboxZero } = await import(
      "@/lib/eggs/admin-triggers/inbox-zero"
    );
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO hidden_egg_fires (id, egg_id, actor_type, user_id, fired_at_ms, trigger_evidence) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("hef-iz-1", "inbox_zero", "admin", "admin-1", now - 86400000, "{}");

    const result = await evaluateInboxZero("admin-1", now);
    expect(result.shouldFire).toBe(false);
  });
});

// -------------------------------------------------------
// First client won
// -------------------------------------------------------

describe("First client won", () => {
  beforeEach(() => {
    clearTable("deals");
    clearTable("hidden_egg_fires");
    ensureUser("admin-1");
  });

  it("fires when exactly one deal is Won", async () => {
    const { evaluateFirstClientWon } = await import(
      "@/lib/eggs/admin-triggers/first-client-won"
    );
    const now = Date.now();
    insertDeal("deal-1", "won", now);

    const result = await evaluateFirstClientWon("admin-1", now);
    expect(result.shouldFire).toBe(true);
    expect(result.evidence.dealId).toBe("deal-1");
  });

  it("does not fire when no deals are Won", async () => {
    const { evaluateFirstClientWon } = await import(
      "@/lib/eggs/admin-triggers/first-client-won"
    );
    const result = await evaluateFirstClientWon("admin-1");
    expect(result.shouldFire).toBe(false);
  });

  it("does not fire when multiple deals are Won", async () => {
    const { evaluateFirstClientWon } = await import(
      "@/lib/eggs/admin-triggers/first-client-won"
    );
    const now = Date.now();
    insertDeal("deal-2", "won", now - 100000);
    insertDeal("deal-3", "won", now);

    const result = await evaluateFirstClientWon("admin-1", now);
    expect(result.shouldFire).toBe(false);
  });

  it("does not fire if egg already fired (one-shot)", async () => {
    const { evaluateFirstClientWon } = await import(
      "@/lib/eggs/admin-triggers/first-client-won"
    );
    const now = Date.now();
    insertDeal("deal-4", "won", now);

    sqlite
      .prepare(
        `INSERT INTO hidden_egg_fires (id, egg_id, actor_type, user_id, fired_at_ms, trigger_evidence) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("hef-fcw-1", "first_client_won", "admin", "admin-1", now - 86400000, "{}");

    const result = await evaluateFirstClientWon("admin-1", now);
    expect(result.shouldFire).toBe(false);
  });
});

// -------------------------------------------------------
// Registry — new eggs present
// -------------------------------------------------------

describe("Registry expansion", () => {
  it("has 6 admin eggs registered", async () => {
    const { ADMIN_EGGS } = await import("@/lib/eggs/registry");
    expect(ADMIN_EGGS).toHaveLength(6);
    const ids = ADMIN_EGGS.map((e) => e.id);
    expect(ids).toContain("weekend_warrior");
    expect(ids).toContain("inbox_zero");
    expect(ids).toContain("first_client_won");
  });
});
