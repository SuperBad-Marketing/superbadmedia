/**
 * SW-4 — hasCompletedCriticalFlight (real DB path).
 *
 * Replaces the A8 stub-era semantics (always-true). Verifies:
 *   - kill-switch off → true (matches SW-2/SW-3 no-op convention);
 *   - kill-switch on + empty db → false;
 *   - kill-switch on + all critical-flight completions → true;
 *   - empty userId → false.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { killSwitches, resetKillSwitchesToDefaults } from "@/lib/kill-switches";

const ORDERED = ["stripe-admin", "resend", "graph-api-admin"] as const;

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "wizards.critical_flight_wizards") return [...ORDERED];
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const { hasCompletedCriticalFlight } = await import(
  "@/lib/auth/has-completed-critical-flight"
);

const TEST_DB = path.join(
  process.cwd(),
  "tests/.test-has-completed-critical-flight.db",
);

let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof drizzle<any>>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  drizzleMigrate(db, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  resetKillSwitchesToDefaults();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  sqlite.exec("DELETE FROM wizard_completions");
  resetKillSwitchesToDefaults();
});

async function seedCompletion(userId: string, key: string): Promise<void> {
  await db.insert(wizard_completions).values({
    id: randomUUID(),
    wizard_key: key,
    user_id: userId,
    audience: "admin",
    completion_payload: {},
    contract_version: "v1",
    completed_at_ms: Date.now(),
  });
}

describe("hasCompletedCriticalFlight", () => {
  it("short-circuits to true when setup_wizards_enabled is false", async () => {
    // defaults: setup_wizards_enabled = false
    expect(await hasCompletedCriticalFlight("user-andy", db)).toBe(true);
  });

  it("returns false when any critical-flight wizard is missing", async () => {
    killSwitches.setup_wizards_enabled = true;
    expect(await hasCompletedCriticalFlight("user-andy", db)).toBe(false);
    await seedCompletion("user-andy", "stripe-admin");
    await seedCompletion("user-andy", "resend");
    expect(await hasCompletedCriticalFlight("user-andy", db)).toBe(false);
  });

  it("returns true once every critical-flight wizard is complete", async () => {
    killSwitches.setup_wizards_enabled = true;
    for (const k of ORDERED) await seedCompletion("user-andy", k);
    expect(await hasCompletedCriticalFlight("user-andy", db)).toBe(true);
  });

  it("returns false on empty userId even when the switch is on", async () => {
    killSwitches.setup_wizards_enabled = true;
    expect(await hasCompletedCriticalFlight("", db)).toBe(false);
  });
});
