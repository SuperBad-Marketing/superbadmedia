/**
 * Brand DNA card UI + alignment gate + save/resume — BDA-2 tests.
 *
 * Coverage:
 *   - QUESTION_BANK structure (count, section distribution, option shape)
 *   - generateSectionInsight (kill-switch bypass, Anthropic mock, caching)
 *   - submitAlignmentGate (creates profile, sets track, redirects)
 *   - submitAnswer (inserts answer, updates signal_tags, correct redirect)
 *   - submitReflection (saves reflection_text, handles skip)
 *
 * Uses an isolated SQLite DB. Server Actions are tested by mocking @/lib/db
 * with a lazy getter so the test DB (created in beforeAll) is used.
 * Anthropic SDK is mocked with vi.hoisted + inline class per drift-check pattern.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";

// ── Hoist mocks before any module import ─────────────────────────────────────

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate };
  },
}));

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-test-bda2-001", role: "admin", brand_dna_complete: false },
  }),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// next/navigation's redirect() throws { message: "NEXT_REDIRECT", digest: "NEXT_REDIRECT;replace;<url>;307;" }
// We do NOT mock next/navigation — tests check the real error shape via .digest.
/** Helper: assert that a promise rejects with Next.js's redirect error pointing at `url`. */
async function expectRedirectTo(
  fn: () => Promise<unknown>,
  urlPart: string,
): Promise<void> {
  await expect(fn()).rejects.toMatchObject({
    message: "NEXT_REDIRECT",
    digest: expect.stringContaining(urlPart),
  });
}

/** Helper: assert that a promise rejects with any redirect (don't check URL). */
async function expectAnyRedirect(fn: () => Promise<unknown>): Promise<void> {
  await expect(fn()).rejects.toMatchObject({ message: "NEXT_REDIRECT" });
}

// ── @/lib/db mock — lazy getter points at testDb once initialised ─────────────
// The let variable is module-scoped and written in beforeAll before any test runs.
let testDb: ReturnType<typeof drizzle>;

vi.mock("@/lib/db", () => ({
  // Accessor property: evaluated on first access (after beforeAll sets testDb)
  get db() {
    return testDb;
  },
}));

// ── Test DB setup ─────────────────────────────────────────────────────────────

const TEST_DB = path.join(process.cwd(), "tests/.test-brand-dna-card.db");
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
  // clearAllMocks clears call history but not implementations.
  // The auth mock implementation is preserved from the vi.mock factory.
  mockMessagesCreate.mockClear();
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: "text", text: "A sharp insight about the brand signals." }],
  });
});

// ── Lazy imports (after mocks are hoisted) ────────────────────────────────────

const { QUESTION_BANK, getQuestionsForSection, SECTION_TITLES } = await import(
  "@/lib/brand-dna/question-bank"
);
const { generateSectionInsight } = await import(
  "@/lib/brand-dna/generate-insight"
);
const { killSwitches, resetKillSwitchesToDefaults } = await import(
  "@/lib/kill-switches"
);

// ── QUESTION_BANK structure ───────────────────────────────────────────────────

describe("QUESTION_BANK structure", () => {
  it("exports exactly 15 questions (3 per section × 5 sections)", () => {
    expect(QUESTION_BANK).toHaveLength(15);
  });

  it("has exactly 3 questions in each section", () => {
    for (const s of [1, 2, 3, 4, 5] as const) {
      expect(getQuestionsForSection(s)).toHaveLength(3);
    }
  });

  it("every question has exactly four options (a, b, c, d)", () => {
    for (const q of QUESTION_BANK) {
      expect(Object.keys(q.options).sort()).toEqual(["a", "b", "c", "d"]);
    }
  });

  it("every option has at least one tag", () => {
    for (const q of QUESTION_BANK) {
      for (const opt of Object.values(q.options)) {
        expect((opt as { tags: string[] }).tags.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("SECTION_TITLES covers sections 1–5", () => {
    expect(Object.keys(SECTION_TITLES)).toHaveLength(5);
    for (const s of [1, 2, 3, 4, 5] as const) {
      expect(SECTION_TITLES[s]).toBeTruthy();
    }
  });
});

// ── generateSectionInsight ────────────────────────────────────────────────────

describe("generateSectionInsight", () => {
  afterEach(() => {
    resetKillSwitchesToDefaults();
  });

  it("returns stub string when llm_calls_enabled is false", async () => {
    expect(killSwitches.llm_calls_enabled).toBe(false);

    const result = await generateSectionInsight("any-profile", 1, testDb);
    expect(result).toContain("section 1");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns 'Profile not found' stub when profile does not exist", async () => {
    killSwitches.llm_calls_enabled = true;
    const result = await generateSectionInsight("nonexistent-profile-id", 1, testDb);
    expect(result).toContain("Profile not found");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("calls Anthropic and stores insight in section_insights when enabled", async () => {
    killSwitches.llm_calls_enabled = true;

    const profileId = randomUUID();
    const now = Date.now();
    await testDb.insert(brand_dna_profiles).values({
      id: profileId,
      subject_type: "superbad_self",
      is_superbad_self: true,
      is_current: true,
      status: "in_progress",
      subject_display_name: "Andy",
      created_at_ms: now,
      updated_at_ms: now,
    });

    await testDb.insert(brand_dna_answers).values({
      id: randomUUID(),
      profile_id: profileId,
      question_id: "s1_001",
      section: 1,
      selected_option: "b",
      tags_awarded: JSON.stringify(["authentic", "warmth"]),
      answered_at_ms: now,
    });

    const result = await generateSectionInsight(profileId, 1, testDb);

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(result).toBe("A sharp insight about the brand signals.");

    const rows = await testDb
      .select({ section_insights: brand_dna_profiles.section_insights })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1);

    const insights = JSON.parse(rows[0].section_insights!) as string[];
    expect(insights[0]).toBe("A sharp insight about the brand signals.");
  });

  it("returns cached insight without re-calling Anthropic", async () => {
    killSwitches.llm_calls_enabled = true;

    const profileId = randomUUID();
    const now = Date.now();
    await testDb.insert(brand_dna_profiles).values({
      id: profileId,
      subject_type: "superbad_self",
      is_superbad_self: true,
      is_current: true,
      status: "in_progress",
      section_insights: JSON.stringify(["Cached insight from section 1."]),
      created_at_ms: now,
      updated_at_ms: now,
    });

    const result = await generateSectionInsight(profileId, 1, testDb);

    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(result).toBe("Cached insight from section 1.");
  });
});

// ── submitAlignmentGate ───────────────────────────────────────────────────────

describe("submitAlignmentGate", () => {
  beforeEach(() => {
    killSwitches.brand_dna_assessment_enabled = true;
  });

  afterEach(() => {
    resetKillSwitchesToDefaults();
  });

  it("creates a superbad_self profile with the selected track", async () => {
    const { submitAlignmentGate } = await import(
      "@/app/lite/brand-dna/actions"
    );

    const fd = new FormData();
    fd.set("track", "founder");

    // redirect() throws Next.js NEXT_REDIRECT error
    await expectAnyRedirect(() => submitAlignmentGate(fd));

    const profiles = await testDb
      .select({
        track: brand_dna_profiles.track,
        status: brand_dna_profiles.status,
        subject_type: brand_dna_profiles.subject_type,
      })
      .from(brand_dna_profiles)
      .where(
        and(
          eq(brand_dna_profiles.subject_type, "superbad_self"),
          eq(brand_dna_profiles.is_current, true),
        ),
      );

    const created = profiles.find((p) => p.track === "founder");
    expect(created).toBeTruthy();
    expect(created?.status).toBe("in_progress");
  });

  it("redirects to /lite/brand-dna/section/1 on valid track", async () => {
    const { submitAlignmentGate } = await import(
      "@/app/lite/brand-dna/actions"
    );

    const fd = new FormData();
    fd.set("track", "business");

    await expectRedirectTo(
      () => submitAlignmentGate(fd),
      "/lite/brand-dna/section/1",
    );
  });

  it("redirects to error page for invalid track value", async () => {
    const { submitAlignmentGate } = await import(
      "@/app/lite/brand-dna/actions"
    );

    const fd = new FormData();
    fd.set("track", "not_a_real_track");

    await expectRedirectTo(
      () => submitAlignmentGate(fd),
      "error=invalid_track",
    );
  });

  it("redirects to /lite/onboarding when kill-switch is off and bypass is unset", async () => {
    killSwitches.brand_dna_assessment_enabled = false;
    const saved = process.env.BRAND_DNA_GATE_BYPASS;
    process.env.BRAND_DNA_GATE_BYPASS = "";

    const { submitAlignmentGate } = await import(
      "@/app/lite/brand-dna/actions"
    );

    const fd = new FormData();
    fd.set("track", "founder");

    await expectRedirectTo(() => submitAlignmentGate(fd), "/lite/onboarding");

    process.env.BRAND_DNA_GATE_BYPASS = saved ?? "";
  });
});

// ── submitAnswer ──────────────────────────────────────────────────────────────

describe("submitAnswer", () => {
  let answerProfileId: string;

  beforeAll(async () => {
    answerProfileId = randomUUID();
    const now = Date.now();
    await testDb.insert(brand_dna_profiles).values({
      id: answerProfileId,
      subject_type: "client",
      is_current: true,
      status: "in_progress",
      track: "business",
      created_at_ms: now,
      updated_at_ms: now,
    });
  });

  beforeEach(() => {
    killSwitches.brand_dna_assessment_enabled = true;
  });

  afterEach(() => {
    resetKillSwitchesToDefaults();
  });

  it("inserts an answer row in brand_dna_answers", async () => {
    const { submitAnswer } = await import("@/app/lite/brand-dna/actions");

    const fd = new FormData();
    fd.set("profileId", answerProfileId);
    fd.set("questionId", "s3_001");
    fd.set("section", "3");
    fd.set("selectedOption", "a");
    fd.set("tagsAwarded", JSON.stringify(["authority", "results"]));

    await expectAnyRedirect(() => submitAnswer(fd));

    const rows = await testDb
      .select()
      .from(brand_dna_answers)
      .where(
        and(
          eq(brand_dna_answers.profile_id, answerProfileId),
          eq(brand_dna_answers.question_id, "s3_001"),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].selected_option).toBe("a");
    expect(rows[0].section).toBe(3);
  });

  it("updates signal_tags with awarded tags", async () => {
    const { submitAnswer } = await import("@/app/lite/brand-dna/actions");

    const fd = new FormData();
    fd.set("profileId", answerProfileId);
    fd.set("questionId", "s3_002");
    fd.set("section", "3");
    fd.set("selectedOption", "c");
    fd.set("tagsAwarded", JSON.stringify(["honest", "accountable"]));

    await expectAnyRedirect(() => submitAnswer(fd));

    const rows = await testDb
      .select({ signal_tags: brand_dna_profiles.signal_tags })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, answerProfileId))
      .limit(1);

    const tags = JSON.parse(rows[0].signal_tags!) as Record<string, number>;
    expect(tags["honest"]).toBeGreaterThanOrEqual(1);
    expect(tags["accountable"]).toBeGreaterThanOrEqual(1);
  });

  it("redirects to insight page once section 3 is fully answered", async () => {
    const { submitAnswer } = await import("@/app/lite/brand-dna/actions");

    // Submit the 3rd question in section 3 (s3_003)
    const fd = new FormData();
    fd.set("profileId", answerProfileId);
    fd.set("questionId", "s3_003");
    fd.set("section", "3");
    fd.set("selectedOption", "b");
    fd.set("tagsAwarded", JSON.stringify(["expertise"]));

    await expectRedirectTo(
      () => submitAnswer(fd),
      `/lite/brand-dna/section/3/insight?profileId=${answerProfileId}`,
    );
  });

  it("redirects to reflection page after section 5 is fully answered", async () => {
    const sec5ProfileId = randomUUID();
    const now = Date.now();
    await testDb.insert(brand_dna_profiles).values({
      id: sec5ProfileId,
      subject_type: "client",
      is_current: true,
      status: "in_progress",
      created_at_ms: now,
      updated_at_ms: now,
    });

    // Pre-insert 2 of 3 section-5 answers
    for (const qid of ["s5_001", "s5_002"]) {
      await testDb.insert(brand_dna_answers).values({
        id: randomUUID(),
        profile_id: sec5ProfileId,
        question_id: qid,
        section: 5,
        selected_option: "a",
        tags_awarded: JSON.stringify(["exceed"]),
        answered_at_ms: now,
      });
    }

    const { submitAnswer } = await import("@/app/lite/brand-dna/actions");

    // Submit 3rd question → section 5 complete → reflection
    const fd = new FormData();
    fd.set("profileId", sec5ProfileId);
    fd.set("questionId", "s5_003");
    fd.set("section", "5");
    fd.set("selectedOption", "a");
    fd.set("tagsAwarded", JSON.stringify(["authority"]));

    await expectRedirectTo(
      () => submitAnswer(fd),
      `/lite/brand-dna/section/5/reflection?profileId=${sec5ProfileId}`,
    );
  });

  it("is idempotent — does not insert duplicate answers for the same question", async () => {
    const idemProfileId = randomUUID();
    const now = Date.now();
    await testDb.insert(brand_dna_profiles).values({
      id: idemProfileId,
      subject_type: "client",
      is_current: true,
      status: "in_progress",
      created_at_ms: now,
      updated_at_ms: now,
    });

    const { submitAnswer } = await import("@/app/lite/brand-dna/actions");

    const fd = () => {
      const f = new FormData();
      f.set("profileId", idemProfileId);
      f.set("questionId", "s4_001");
      f.set("section", "4");
      f.set("selectedOption", "a");
      f.set("tagsAwarded", JSON.stringify(["integrity"]));
      return f;
    };

    await expectAnyRedirect(() => submitAnswer(fd()));
    await expectAnyRedirect(() => submitAnswer(fd())); // second submit — idempotent

    const rows = await testDb
      .select()
      .from(brand_dna_answers)
      .where(
        and(
          eq(brand_dna_answers.profile_id, idemProfileId),
          eq(brand_dna_answers.question_id, "s4_001"),
        ),
      );
    expect(rows).toHaveLength(1); // still only one row
  });
});

// ── submitReflection ──────────────────────────────────────────────────────────

describe("submitReflection", () => {
  let reflProfileId: string;

  beforeAll(async () => {
    reflProfileId = randomUUID();
    const now = Date.now();
    await testDb.insert(brand_dna_profiles).values({
      id: reflProfileId,
      subject_type: "superbad_self",
      is_superbad_self: true,
      is_current: true,
      status: "in_progress",
      created_at_ms: now,
      updated_at_ms: now,
    });
  });

  beforeEach(() => {
    killSwitches.brand_dna_assessment_enabled = true;
  });

  afterEach(() => {
    resetKillSwitchesToDefaults();
  });

  it("saves reflection_text to the profile when provided", async () => {
    const { submitReflection } = await import(
      "@/app/lite/brand-dna/actions"
    );

    const fd = new FormData();
    fd.set("profileId", reflProfileId);
    fd.set("reflection", "This brought up a lot about authenticity.");

    await expectAnyRedirect(() => submitReflection(fd));

    const rows = await testDb
      .select({ reflection_text: brand_dna_profiles.reflection_text })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, reflProfileId))
      .limit(1);

    expect(rows[0].reflection_text).toBe(
      "This brought up a lot about authenticity.",
    );
  });

  it("does not save reflection_text when input is whitespace-only (skip)", async () => {
    const skipId = randomUUID();
    const now = Date.now();
    await testDb.insert(brand_dna_profiles).values({
      id: skipId,
      subject_type: "client",
      is_current: true,
      status: "in_progress",
      created_at_ms: now,
      updated_at_ms: now,
    });

    const { submitReflection } = await import(
      "@/app/lite/brand-dna/actions"
    );

    const fd = new FormData();
    fd.set("profileId", skipId);
    fd.set("reflection", "   "); // whitespace-only = skip

    await expectAnyRedirect(() => submitReflection(fd));

    const rows = await testDb
      .select({ reflection_text: brand_dna_profiles.reflection_text })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, skipId))
      .limit(1);

    expect(rows[0].reflection_text).toBeNull();
  });
});
