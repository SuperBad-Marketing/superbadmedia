/**
 * CE-12 — Content Engine onboarding wizard tests.
 *
 * Covers: seed keyword derivation, config initialisation, completion handler,
 * wizard definition registration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock activity log
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock scheduled task bootstrap
vi.mock("@/lib/scheduled-tasks/handlers/content-generate-draft", () => ({
  ensureContentGenerationEnqueued: vi.fn().mockResolvedValue(undefined),
}));

// ── deriveSeedKeywords ──────────────────────────────────────────────────────

describe("deriveSeedKeywords", () => {
  it("returns empty array when no company found", async () => {
    const { deriveSeedKeywords } = await import(
      "@/lib/content-engine/onboarding"
    );

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue(null),
            }),
          }),
        }),
      }),
    };

    const result = await deriveSeedKeywords("company-1", {
      db: mockDb as never,
    });
    expect(result.keywords).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it("derives keywords from vertical and location", async () => {
    const { deriveSeedKeywords } = await import(
      "@/lib/content-engine/onboarding"
    );

    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation(async (fn: (rows: unknown[]) => unknown) => {
                callCount++;
                if (callCount === 1) {
                  // Company query
                  return fn([
                    {
                      industry_vertical: "photography",
                      industry_vertical_other: null,
                      location: "Melbourne",
                      name: "Test Co",
                    },
                  ]);
                }
                // Brand DNA query
                return fn([]);
              }),
            }),
          }),
        }),
      }),
    };

    const result = await deriveSeedKeywords("company-1", {
      db: mockDb as never,
    });

    expect(result.keywords).toContain("photography");
    expect(result.keywords).toContain("photography melbourne");
    expect(result.keywords).toContain("melbourne");
  });

  it("derives keywords from Brand DNA signal tags", async () => {
    const { deriveSeedKeywords } = await import(
      "@/lib/content-engine/onboarding"
    );

    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation(async (fn: (rows: unknown[]) => unknown) => {
                callCount++;
                if (callCount === 1) {
                  // Company query — no vertical
                  return fn([
                    {
                      industry_vertical: null,
                      industry_vertical_other: null,
                      location: null,
                      name: "Test Co",
                    },
                  ]);
                }
                // Brand DNA query
                return fn([
                  {
                    signal_tags: JSON.stringify({
                      aesthetic: { minimalist: 5, bold_typography: 3 },
                      communication: { direct: 4, concise: 2 },
                    }),
                  },
                ]);
              }),
            }),
          }),
        }),
      }),
    };

    const result = await deriveSeedKeywords("company-1", {
      db: mockDb as never,
    });

    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.keywords).toContain("minimalist");
    expect(result.keywords).toContain("direct");
  });

  it("handles malformed signal_tags gracefully", async () => {
    const { deriveSeedKeywords } = await import(
      "@/lib/content-engine/onboarding"
    );

    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation(async (fn: (rows: unknown[]) => unknown) => {
                callCount++;
                if (callCount === 1) {
                  return fn([
                    {
                      industry_vertical: "cafes",
                      industry_vertical_other: null,
                      location: null,
                      name: "Test Co",
                    },
                  ]);
                }
                return fn([{ signal_tags: "not-valid-json{{{" }]);
              }),
            }),
          }),
        }),
      }),
    };

    const result = await deriveSeedKeywords("company-1", {
      db: mockDb as never,
    });

    // Should still get the vertical keyword
    expect(result.keywords).toContain("cafes");
  });
});

// ── ensureContentEngineConfig ───────────────────────────────────────────────

describe("ensureContentEngineConfig", () => {
  it("returns existing config without creating a new one", async () => {
    const { ensureContentEngineConfig } = await import(
      "@/lib/content-engine/onboarding"
    );

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue({ id: "existing-config-id" }),
            }),
          }),
        }),
      }),
      insert: vi.fn(),
    };

    const result = await ensureContentEngineConfig("company-1", {
      db: mockDb as never,
    });

    expect(result.id).toBe("existing-config-id");
    expect(result.isNew).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates new config when none exists", async () => {
    const { ensureContentEngineConfig } = await import(
      "@/lib/content-engine/onboarding"
    );

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue(null),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };

    const result = await ensureContentEngineConfig("company-1", {
      db: mockDb as never,
    });

    expect(result.isNew).toBe(true);
    expect(result.id).toBeTruthy();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalled();
  });
});

// ── completeContentEngineOnboarding ─────────────────────────────────────────

describe("completeContentEngineOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when no config row exists", async () => {
    const { completeContentEngineOnboarding } = await import(
      "@/lib/content-engine/onboarding"
    );

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockResolvedValue(null),
            }),
          }),
        }),
      }),
    };

    const result = await completeContentEngineOnboarding(
      "company-1",
      {
        domainVerified: true,
        seedKeywordsConfirmed: ["seo"],
        sendWindowDay: "tuesday",
        sendWindowTime: "10:00",
        sendWindowTz: "Australia/Melbourne",
        csvImported: false,
        embedFormTokenGenerated: true,
        completedAt: Date.now(),
      },
      { db: mockDb as never },
    );

    expect(result).toEqual({
      ok: false,
      reason: "No content engine config found for this company.",
    });
  });
});

// ── Wizard definition registration ──────────────────────────────────────────

describe("content-engine-onboarding wizard definition", () => {
  it("registers with the correct key", async () => {
    // Reset registry
    const { __resetWizardRegistryForTests } = await import(
      "@/lib/wizards/registry"
    );
    __resetWizardRegistryForTests();

    // Import to trigger registration side-effect
    await import("@/lib/wizards/defs/content-engine-onboarding");

    const { getWizard } = await import("@/lib/wizards/registry");
    const wizard = getWizard("content-engine-onboarding");

    expect(wizard).toBeDefined();
    expect(wizard!.key).toBe("content-engine-onboarding");
    expect(wizard!.audience).toBe("client");
    expect(wizard!.renderMode).toBe("slideover");
    expect(wizard!.steps).toHaveLength(3);
  });

  it("has correct step types in order", async () => {
    const { contentEngineOnboardingWizard } = await import(
      "@/lib/wizards/defs/content-engine-onboarding"
    );

    const steps = contentEngineOnboardingWizard.steps;
    expect(steps[0]!.type).toBe("dns-verify");
    expect(steps[0]!.key).toBe("domain-verification");
    expect(steps[1]!.type).toBe("review-and-confirm");
    expect(steps[1]!.key).toBe("seed-keyword-review");
    expect(steps[2]!.type).toBe("form");
    expect(steps[2]!.key).toBe("newsletter-preferences");
  });

  it("completion contract rejects without domain verification", async () => {
    const { contentEngineOnboardingWizard } = await import(
      "@/lib/wizards/defs/content-engine-onboarding"
    );

    const result = await contentEngineOnboardingWizard.completionContract.verify({
      domainVerified: false,
      seedKeywordsConfirmed: ["seo"],
      sendWindowDay: "tuesday",
      sendWindowTime: "10:00",
      sendWindowTz: "Australia/Melbourne",
      csvImported: false,
      embedFormTokenGenerated: false,
      completedAt: Date.now(),
    });

    expect(result.ok).toBe(false);
  });

  it("completion contract rejects without seed keywords", async () => {
    const { contentEngineOnboardingWizard } = await import(
      "@/lib/wizards/defs/content-engine-onboarding"
    );

    const result = await contentEngineOnboardingWizard.completionContract.verify({
      domainVerified: true,
      seedKeywordsConfirmed: [],
      sendWindowDay: "tuesday",
      sendWindowTime: "10:00",
      sendWindowTz: "Australia/Melbourne",
      csvImported: false,
      embedFormTokenGenerated: false,
      completedAt: Date.now(),
    });

    expect(result.ok).toBe(false);
  });

  it("completion contract accepts valid payload", async () => {
    const { contentEngineOnboardingWizard } = await import(
      "@/lib/wizards/defs/content-engine-onboarding"
    );

    const result = await contentEngineOnboardingWizard.completionContract.verify({
      domainVerified: true,
      seedKeywordsConfirmed: ["seo", "melbourne photography"],
      sendWindowDay: "tuesday",
      sendWindowTime: "10:00",
      sendWindowTz: "Australia/Melbourne",
      csvImported: false,
      embedFormTokenGenerated: true,
      completedAt: Date.now(),
    });

    expect(result).toEqual({ ok: true });
  });
});
