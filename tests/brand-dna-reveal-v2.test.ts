import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate };
  },
}));

let testDb: ReturnType<typeof drizzle>;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-brand-dna-reveal-v2.db");
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
  mockMessagesCreate.mockReset();
});

afterEach(() => {
  resetKillSwitchesToDefaults();
});

const {
  BRAND_DNA_TRIAL_SHOOT_URL,
  BRAND_DNA_WORKSHOP_URL,
  enforceRevealV2Pathway,
  findFormalContractionVariants,
  generateBrandDnaRevealV2,
  getBrandDnaRevealV2Fallback,
  getRevealV2ConfidenceLine,
  inferBrandDnaAssessmentDepth,
  validateBrandDnaRevealV2,
} = await import("@/lib/brand-dna/reveal-v2");
const { killSwitches, resetKillSwitchesToDefaults } = await import(
  "@/lib/kill-switches"
);

function makeReveal(
  depth: "quick_read" | "full_diagnostic" = "quick_read",
) {
  return JSON.parse(
    JSON.stringify(
      getBrandDnaRevealV2Fallback({
        assessmentDepth: depth,
        answerCount: depth === "full_diagnostic" ? 57 : 33,
        differentiator:
          "a specific working method that makes the outcome easier to judge",
      }),
    ),
  ) as ReturnType<typeof getBrandDnaRevealV2Fallback>;
}

async function insertProfile(
  overrides: Partial<typeof brand_dna_profiles.$inferInsert> = {},
): Promise<string> {
  const id = overrides.id ?? randomUUID();
  const now = Date.now();
  await testDb.insert(brand_dna_profiles).values({
    id,
    subject_type: "client",
    is_current: true,
    is_superbad_self: false,
    status: "in_progress",
    subject_display_name: "North Street Studio",
    track: "business",
    signal_tags: JSON.stringify({
      quiet_confidence: 3,
      premium_positioning: 2,
      proof: 2,
      risk_caution: 1,
    }),
    section_insights: JSON.stringify([
      "The business keeps showing a high standard before it names the point.",
      "The public proof is useful, but it could be easier to find.",
    ]),
    first_impression: "A useful first read is already cached.",
    prose_portrait:
      "This cached portrait gives the generator enough prior material to reuse without making the reveal start like a chart.",
    reflection_text: "The founder wants clearer public proof.",
    business_context: JSON.stringify({
      businessDoes: "A small studio helping local operators look sharper online.",
      customers: "Owner-led service businesses.",
      differentiator:
        "a specific working method that makes the outcome easier to judge",
    }),
    created_at_ms: now,
    updated_at_ms: now,
    ...overrides,
  });
  return id;
}

async function insertAnswers(profileId: string, count: number): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    await testDb.insert(brand_dna_answers).values({
      id: randomUUID(),
      profile_id: profileId,
      question_id: `v2_q_${i}`,
      section: (i % 5) + 1,
      selected_option: "a",
      tags_awarded: JSON.stringify(["quiet_confidence", "proof"]),
      answered_at_ms: now + i,
    });
  }
}

describe("Reveal V2 assessment depth and confidence", () => {
  it("infers quick_read for 33 answers", () => {
    expect(inferBrandDnaAssessmentDepth(33)).toBe("quick_read");
  });

  it("infers quick_read for 40 answers", () => {
    expect(inferBrandDnaAssessmentDepth(40)).toBe("quick_read");
  });

  it("infers full_diagnostic for 41 answers", () => {
    expect(inferBrandDnaAssessmentDepth(41)).toBe("full_diagnostic");
  });

  it("returns the exact Quick Read confidence line", () => {
    expect(getRevealV2ConfidenceLine("quick_read")).toBe(
      "Quick Read · 33 answers · provisional, but useful",
    );
  });

  it("uses the answer count in the Full Diagnostic confidence line", () => {
    expect(getRevealV2ConfidenceLine("full_diagnostic", 57)).toBe(
      "Full Diagnostic · 57 answers · deeper read",
    );
  });
});

describe("Reveal V2 validation", () => {
  it("accepts a valid Reveal V2 object", () => {
    expect(validateBrandDnaRevealV2(makeReveal()).success).toBe(true);
  });

  it("rejects missing friendRead.openingLine", () => {
    const reveal = makeReveal() as Record<string, unknown>;
    delete (reveal.friendRead as Record<string, unknown>).openingLine;
    const result = validateBrandDnaRevealV2(reveal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join("\n")).toContain("friendRead.openingLine");
    }
  });

  it("rejects banned phrases", () => {
    const reveal = makeReveal();
    reveal.friendRead.recognition =
      "Your answers indicate that the public version is asking people to work too hard.";
    const result = validateBrandDnaRevealV2(reveal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join("\n")).toContain("your answers indicate");
    }
  });

  it("rejects raw tag names in user-facing fields", () => {
    const reveal = makeReveal();
    reveal.receipt.signalSummaries[0] =
      "quiet_confidence keeps showing up where proof should be easier to see.";
    const result = validateBrandDnaRevealV2(reveal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join("\n")).toContain("quiet_confidence");
    }
  });

  it("flags formal variants that should use contractions", () => {
    expect(findFormalContractionVariants("You are making people guess.")).toContain(
      "you are -> you're",
    );
  });
});

describe("Reveal V2 CTA enforcement", () => {
  it("overwrites an incorrect Trial Shoot URL", () => {
    const reveal = makeReveal();
    reveal.pathway.primaryCtaHref = "https://example.com/trial";
    const enforced = enforceRevealV2Pathway(reveal, {
      assessmentDepth: "quick_read",
      differentiator: "a specific working method that is easy to explain",
    });
    expect(enforced.pathway.primaryCtaHref).toBe(BRAND_DNA_TRIAL_SHOOT_URL);
  });

  it("overwrites an incorrect Workshop URL", () => {
    const reveal = makeReveal();
    reveal.pathway.trialShootFitScore = 30;
    reveal.pathway.workshopFitScore = 80;
    reveal.pathway.primaryCtaHref = "https://example.com/workshop";
    const enforced = enforceRevealV2Pathway(reveal, {
      assessmentDepth: "full_diagnostic",
      differentiator: "a specific working method that is easy to explain",
    });
    expect(enforced.pathway.primaryCtaHref).toBe(BRAND_DNA_WORKSHOP_URL);
  });

  it("chooses workshop when scores are close and the differentiator is weak", () => {
    const reveal = makeReveal();
    reveal.pathway.trialShootFitScore = 52;
    reveal.pathway.workshopFitScore = 50;
    const enforced = enforceRevealV2Pathway(reveal, {
      assessmentDepth: "quick_read",
      differentiator: "quality service",
    });
    expect(enforced.pathway.recommended).toBe("workshop");
  });

  it("chooses trial_shoot for Quick Read when scores are close and the differentiator is not weak", () => {
    const reveal = makeReveal();
    reveal.pathway.trialShootFitScore = 50;
    reveal.pathway.workshopFitScore = 52;
    const enforced = enforceRevealV2Pathway(reveal, {
      assessmentDepth: "quick_read",
      differentiator:
        "a specific working method that makes outcomes easier to inspect",
    });
    expect(enforced.pathway.recommended).toBe("trial_shoot");
  });
});

describe("generateBrandDnaRevealV2", () => {
  it("returns a valid cached reveal_v2_json without calling the LLM", async () => {
    killSwitches.llm_calls_enabled = true;
    const cached = makeReveal();
    const profileId = await insertProfile({
      reveal_v2_json: JSON.stringify(cached),
    });
    await insertAnswers(profileId, 33);

    const result = await generateBrandDnaRevealV2(profileId, undefined, testDb);

    expect(result.friendRead.openingLine).toBe(cached.friendRead.openingLine);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("regenerates when cached reveal_v2_json is invalid", async () => {
    killSwitches.llm_calls_enabled = true;
    const generated = makeReveal();
    const profileId = await insertProfile({
      reveal_v2_json: JSON.stringify({ not: "valid" }),
    });
    await insertAnswers(profileId, 33);
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(generated) }],
    });

    const result = await generateBrandDnaRevealV2(profileId, undefined, testDb);

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(result.friendRead.openingLine).toBe(generated.friendRead.openingLine);

    const [row] = await testDb
      .select({ reveal_v2_json: brand_dna_profiles.reveal_v2_json })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1);
    expect(row.reveal_v2_json).toContain("brand_dna_reveal_v2");
  });

  it("returns fallback copy when LLM calls are disabled", async () => {
    killSwitches.llm_calls_enabled = false;
    const profileId = await insertProfile();
    await insertAnswers(profileId, 33);

    const result = await generateBrandDnaRevealV2(profileId, undefined, testDb);

    expect(result.friendRead.openingLine).toBe(
      "You’re probably better in real life than the brand is showing.",
    );
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});

describe("/rundown Reveal V2 UI contract", () => {
  it("keeps Reveal V2 sections in the required order", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/lite/brand-dna/reveal-v2.tsx",
      ),
      "utf8",
    );
    const labels = [
      "Context line",
      "First thing I’d say",
      "What this says about the brand",
      "Where this helps",
      "Where it might be biting you",
      "How customers may be reading it",
      "The receipt",
      "What I’d fix first",
      "Best next move",
    ];
    let previous = -1;
    for (const label of labels) {
      const next = source.indexOf(label);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
    expect(source).toContain("Why we’re saying this");
  });
});
