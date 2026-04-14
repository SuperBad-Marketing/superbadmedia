/**
 * SW-4 — critical-flight helpers.
 *
 * Hermetic sqlite DB with full migrations applied; mocks @/lib/settings so
 * `wizards.critical_flight_wizards` is supplied deterministically.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";

const ORDERED = ["stripe-admin", "resend", "graph-api-admin"] as const;

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "wizards.critical_flight_wizards") return [...ORDERED];
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

const { getCriticalFlightStatus, nextCriticalWizardKey } = await import(
  "@/lib/wizards/critical-flight"
);

const TEST_DB = path.join(process.cwd(), "tests/.test-critical-flight.db");

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
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  sqlite.exec("DELETE FROM wizard_completions");
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

describe("getCriticalFlightStatus", () => {
  it("returns the full ordered list as remaining when no completions exist", async () => {
    const s = await getCriticalFlightStatus("user-andy", db);
    expect(s.ordered).toEqual([...ORDERED]);
    expect(s.completedKeys.size).toBe(0);
    expect(s.remaining).toEqual([...ORDERED]);
  });

  it("removes completed keys while preserving the ordered tail", async () => {
    await seedCompletion("user-andy", "stripe-admin");
    const s = await getCriticalFlightStatus("user-andy", db);
    expect(s.completedKeys.has("stripe-admin")).toBe(true);
    expect(s.remaining).toEqual(["resend", "graph-api-admin"]);
  });

  it("is per-user: other users' completions don't count", async () => {
    await seedCompletion("user-other", "stripe-admin");
    await seedCompletion("user-other", "resend");
    const s = await getCriticalFlightStatus("user-andy", db);
    expect(s.remaining).toEqual([...ORDERED]);
  });

  it("returns empty remaining once every critical wizard is complete", async () => {
    for (const k of ORDERED) await seedCompletion("user-andy", k);
    const s = await getCriticalFlightStatus("user-andy", db);
    expect(s.remaining).toEqual([]);
    expect(s.completedKeys.size).toBe(ORDERED.length);
  });

  it("tolerates duplicate completions (spec §6.1 allows multiple rows per key)", async () => {
    await seedCompletion("user-andy", "stripe-admin");
    await seedCompletion("user-andy", "stripe-admin");
    const s = await getCriticalFlightStatus("user-andy", db);
    expect(s.completedKeys.has("stripe-admin")).toBe(true);
    expect(s.remaining).toEqual(["resend", "graph-api-admin"]);
  });
});

describe("nextCriticalWizardKey", () => {
  it("returns the first incomplete key in order", async () => {
    expect(await nextCriticalWizardKey("user-andy", db)).toBe("stripe-admin");
    await seedCompletion("user-andy", "stripe-admin");
    expect(await nextCriticalWizardKey("user-andy", db)).toBe("resend");
    await seedCompletion("user-andy", "resend");
    expect(await nextCriticalWizardKey("user-andy", db)).toBe("graph-api-admin");
  });

  it("returns null when every critical wizard is complete", async () => {
    for (const k of ORDERED) await seedCompletion("user-andy", k);
    expect(await nextCriticalWizardKey("user-andy", db)).toBeNull();
  });
});
