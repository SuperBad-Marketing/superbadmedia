/**
 * Brand DNA reveal — BDA-3 tests.
 *
 * Coverage:
 *   - generateFirstImpression (kill-switch, missing profile, cache hit, happy path)
 *   - generateProsePortrait (kill-switch, missing profile, cache hit, happy path)
 *   - markProfileComplete (kill-switch gated, idempotent, sets status + completed_at_ms)
 *   - Tier 2 `brand-dna-reveal` choreography registered
 *   - `brand_dna_reveal` sound key registered
 *
 * Uses an isolated SQLite DB (same pattern as brand-dna-card.test.ts).
 */

import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate };
  },
}));

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-test-bda3-001", role: "admin", brand_dna_complete: false },
  }),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// ── Test DB ──────────────────────────────────────────────────────────────────

let testDb: ReturnType<typeof drizzle>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-brand-dna-reveal.db");
let sqlite: Database.Database;

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

beforeEach(() => {
  mockMessagesCreate.mockClear();
});

// ── Lazy imports (after mocks hoisted) ───────────────────────────────────────

const { generateFirstImpression } = await import(
  "@/lib/brand-dna/generate-first-impression"
);
const { generateProsePortrait } = await import(
  "@/lib/brand-dna/generate-prose-portrait"
);
const { markProfileComplete } = await import("@/app/lite/brand-dna/actions");
const { killSwitches, resetKillSwitchesToDefaults } = await import(
  "@/lib/kill-switches"
);
const { tier2, TIER_2_KEYS } = await import("@/lib/motion/choreographies");
const { SOUND_KEYS, soundRegistry } = await import("@/lib/sounds");

async function insertProfile(
  overrides: Partial<{
    id: string;
    status: "pending" | "in_progress" | "complete";
    subject_display_name: string | null;
    signal_tags: string | null;
    section_insights: string | null;
    first_impression: string | null;
    prose_portrait: string | null;
    reflection_text: string | null;
    track: "founder" | "business" | "founder_supplement" | null;
  }> = {},
): Promise<string> {
  const id = overrides.id ?? randomUUID();
  const now = Date.now();
  await testDb.insert(brand_dna_profiles).values({
    id,
    subject_type: "superbad_self",
    is_superbad_self: true,
    is_current: true,
    status: overrides.status ?? "in_progress",
    subject_display_name: overrides.subject_display_name ?? "Andy",
    signal_tags: overrides.signal_tags ?? JSON.stringify({ authentic: 3, warm: 2 }),
    section_insights:
      overrides.section_insights ?? JSON.stringify(["s1 note", "s2 note"]),
    first_impression: overrides.first_impression ?? null,
    prose_portrait: overrides.prose_portrait ?? null,
    reflection_text: overrides.reflection_text ?? null,
    track: overrides.track ?? "founder",
    created_at_ms: now,
    updated_at_ms: now,
  });
  return id;
}

// ── generateFirstImpression ──────────────────────────────────────────────────

describe("generateFirstImpression", () => {
  afterEach(() => resetKillSwitchesToDefaults());

  it("returns a stub string when llm_calls_enabled is false", async () => {
    const profileId = await insertProfile();
    const result = await generateFirstImpression(profileId, testDb);
    expect(result).toContain("LLM calls");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns a not-found stub when the profile is missing", async () => {
    killSwitches.llm_calls_enabled = true;
    const result = await generateFirstImpression("nonexistent-id", testDb);
    expect(result).toContain("Profile not found");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns cached first_impression without re-calling Anthropic", async () => {
    killSwitches.llm_calls_enabled = true;
    const profileId = await insertProfile({
      first_impression: "An already-generated line that should be returned as-is.",
    });
    const result = await generateFirstImpression(profileId, testDb);
    expect(result).toBe(
      "An already-generated line that should be returned as-is.",
    );
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("calls Anthropic, persists first_impression, and returns the text", async () => {
    killSwitches.llm_calls_enabled = true;
    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "A sharp, irreducible two-sentence read on the brand.",
        },
      ],
    });
    const profileId = await insertProfile();
    const result = await generateFirstImpression(profileId, testDb);

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(result).toBe(
      "A sharp, irreducible two-sentence read on the brand.",
    );

    const [row] = await testDb
      .select({ first_impression: brand_dna_profiles.first_impression })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1);
    expect(row.first_impression).toBe(
      "A sharp, irreducible two-sentence read on the brand.",
    );
  });
});

// ── generateProsePortrait ────────────────────────────────────────────────────

describe("generateProsePortrait", () => {
  afterEach(() => resetKillSwitchesToDefaults());

  it("returns a stub string when llm_calls_enabled is false", async () => {
    const profileId = await insertProfile();
    const result = await generateProsePortrait(profileId, testDb);
    expect(result).toContain("LLM calls");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns cached prose_portrait without re-calling Anthropic", async () => {
    killSwitches.llm_calls_enabled = true;
    const profileId = await insertProfile({
      first_impression: "Already written.",
      prose_portrait: "Two paragraphs already committed to the profile.",
    });
    const result = await generateProsePortrait(profileId, testDb);
    expect(result).toBe(
      "Two paragraphs already committed to the profile.",
    );
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("calls Anthropic and persists prose_portrait", async () => {
    killSwitches.llm_calls_enabled = true;
    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "A coherent 500-word portrait standing in for the real thing.",
        },
      ],
    });
    const profileId = await insertProfile({
      first_impression: "A clean first impression.",
    });

    const result = await generateProsePortrait(profileId, testDb);
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(result).toContain("coherent");

    const [row] = await testDb
      .select({ prose_portrait: brand_dna_profiles.prose_portrait })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1);
    expect(row.prose_portrait).toContain("coherent");
  });
});

// ── markProfileComplete ──────────────────────────────────────────────────────

describe("markProfileComplete", () => {
  const originalBypass = process.env.BRAND_DNA_GATE_BYPASS;
  beforeEach(() => {
    process.env.BRAND_DNA_GATE_BYPASS = "true";
  });
  afterEach(() => {
    if (originalBypass === undefined) delete process.env.BRAND_DNA_GATE_BYPASS;
    else process.env.BRAND_DNA_GATE_BYPASS = originalBypass;
  });

  it("flips status to complete and sets completed_at_ms", async () => {
    const profileId = await insertProfile({ status: "in_progress" });

    await markProfileComplete(profileId);

    const [row] = await testDb
      .select({
        status: brand_dna_profiles.status,
        completed_at_ms: brand_dna_profiles.completed_at_ms,
      })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1);

    expect(row.status).toBe("complete");
    expect(row.completed_at_ms).toBeGreaterThan(0);
  });

  it("is a no-op if the profile is already complete", async () => {
    const profileId = await insertProfile({ status: "complete" });

    await testDb
      .update(brand_dna_profiles)
      .set({ completed_at_ms: 123 })
      .where(eq(brand_dna_profiles.id, profileId));

    await markProfileComplete(profileId);

    const [row] = await testDb
      .select({ completed_at_ms: brand_dna_profiles.completed_at_ms })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1);
    expect(row.completed_at_ms).toBe(123);
  });

  it("silently returns when the profile does not exist", async () => {
    await expect(markProfileComplete("nonexistent-id")).resolves.toBeUndefined();
  });
});

// ── Registry wiring ──────────────────────────────────────────────────────────

describe("registry wiring", () => {
  it("registers `brand-dna-reveal` as a Tier 2 choreography", () => {
    expect(TIER_2_KEYS).toContain("brand-dna-reveal");
    expect(tier2["brand-dna-reveal"]).toBeDefined();
    expect(tier2["brand-dna-reveal"].variants).toBeDefined();
    expect(tier2["brand-dna-reveal"].reduced).toBeDefined();
  });

  it("registers `brand_dna_reveal` as the 8th sound key", () => {
    expect(SOUND_KEYS).toContain("brand_dna_reveal");
    expect(SOUND_KEYS.length).toBe(8);
    expect(soundRegistry.brand_dna_reveal).toBeDefined();
    expect(soundRegistry.brand_dna_reveal.src).toContain(
      "brand_dna_reveal",
    );
  });
});
