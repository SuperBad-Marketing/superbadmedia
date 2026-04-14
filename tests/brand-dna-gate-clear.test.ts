/**
 * Brand DNA gate-clear tests — BDA-4.
 *
 * Covers `isBrandDnaCompleteForUser` — the DB query consumed by the NextAuth
 * jwt callback in `lib/auth/auth.ts`. When this returns true, the gate
 * middleware in `proxy.ts` allows the authenticated admin past
 * `/lite/onboarding` and into the rest of `/lite/*`.
 *
 * Coverage:
 *   - Kill-switch off → always false (no DB cost, non-Brand-DNA deploys safe)
 *   - Empty userId → false
 *   - No superbad_self profile → false
 *   - Profile exists but status='in_progress' → false
 *   - Profile complete but is_current=false → false (archived retake)
 *   - SuperBad-self + is_current + status='complete' → true
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { isBrandDnaCompleteForUser } from "@/lib/auth/brand-dna-complete-check";
import {
  killSwitches,
  resetKillSwitchesToDefaults,
} from "@/lib/kill-switches";

// ── Isolated test DB ─────────────────────────────────────────────────────────

const TEST_DB = path.join(process.cwd(), "tests/.test-brand-dna-gate-clear.db");
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  drizzleMigrate(testDb, {
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

afterEach(async () => {
  resetKillSwitchesToDefaults();
  // Clean the one table this suite touches.
  sqlite.exec("DELETE FROM brand_dna_profiles");
});

type ProfileOverrides = {
  status?: "pending" | "in_progress" | "complete";
  is_current?: boolean;
  subject_type?: "superbad_self" | "client";
};

async function insertProfile(
  overrides: ProfileOverrides = {},
): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await testDb.insert(brand_dna_profiles).values({
    id,
    subject_type: overrides.subject_type ?? "superbad_self",
    is_superbad_self: (overrides.subject_type ?? "superbad_self") === "superbad_self",
    is_current: overrides.is_current ?? true,
    status: overrides.status ?? "in_progress",
    created_at_ms: now,
    updated_at_ms: now,
  });
  return id;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("isBrandDnaCompleteForUser", () => {
  it("returns false when brand_dna_assessment_enabled is off", async () => {
    await insertProfile({ status: "complete", is_current: true });
    // Kill-switch default is false — no override needed.
    expect(killSwitches.brand_dna_assessment_enabled).toBe(false);
    const result = await isBrandDnaCompleteForUser("user-001", testDb);
    expect(result).toBe(false);
  });

  it("returns false when userId is empty", async () => {
    killSwitches.brand_dna_assessment_enabled = true;
    await insertProfile({ status: "complete", is_current: true });
    const result = await isBrandDnaCompleteForUser("", testDb);
    expect(result).toBe(false);
  });

  it("returns false when no superbad_self profile exists", async () => {
    killSwitches.brand_dna_assessment_enabled = true;
    const result = await isBrandDnaCompleteForUser("user-001", testDb);
    expect(result).toBe(false);
  });

  it("returns false when the profile is still in_progress", async () => {
    killSwitches.brand_dna_assessment_enabled = true;
    await insertProfile({ status: "in_progress", is_current: true });
    const result = await isBrandDnaCompleteForUser("user-001", testDb);
    expect(result).toBe(false);
  });

  it("returns false when the complete profile is an archived retake (is_current=false)", async () => {
    killSwitches.brand_dna_assessment_enabled = true;
    await insertProfile({ status: "complete", is_current: false });
    const result = await isBrandDnaCompleteForUser("user-001", testDb);
    expect(result).toBe(false);
  });

  it("returns true when superbad_self + is_current + status='complete'", async () => {
    killSwitches.brand_dna_assessment_enabled = true;
    await insertProfile({ status: "complete", is_current: true });
    const result = await isBrandDnaCompleteForUser("user-001", testDb);
    expect(result).toBe(true);
  });

  it("ignores a complete client-type profile (gate only cares about superbad_self)", async () => {
    killSwitches.brand_dna_assessment_enabled = true;
    await insertProfile({
      status: "complete",
      is_current: true,
      subject_type: "client",
    });
    const result = await isBrandDnaCompleteForUser("user-001", testDb);
    expect(result).toBe(false);
  });
});
