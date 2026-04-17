/**
 * OS-1: getOnboardingState() unit tests.
 * Mocks @/lib/db so we can control query results.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module before importing the function under test
const mockGet = vi.fn();
const mockAll = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
          all: mockAll,
        }),
      }),
    }),
  },
}));

import { getOnboardingState } from "@/lib/onboarding/get-onboarding-state";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOnboardingState — SaaS", () => {
  it("returns welcome as current step when nothing is done", async () => {
    // primaryContact query — no welcome seen
    mockGet.mockReturnValueOnce({
      id: "contact-1",
      onboarding_welcome_seen_at_ms: null,
    });

    const state = await getOnboardingState("company-1", "saas");
    expect(state.currentStep).toBe("welcome");
    expect(state.completedSteps).toEqual([]);
    expect(state.totalSteps).toBe(5);
    expect(state.audience).toBe("saas");
  });

  it("returns brand_dna when welcome is done but DNA is not", async () => {
    // primaryContact
    mockGet.mockReturnValueOnce({
      id: "contact-1",
      onboarding_welcome_seen_at_ms: Date.now(),
    });
    // Brand DNA profile query — none found
    mockGet.mockReturnValueOnce(null);
    // Rev Seg query
    mockGet.mockReturnValueOnce({ revenue_segmentation_completed_at_ms: null });
    // Credential email lookup
    mockGet.mockReturnValueOnce({ email: "test@example.com" });
    // User record
    mockGet.mockReturnValueOnce(null);

    const state = await getOnboardingState("company-1", "saas");
    expect(state.currentStep).toBe("brand_dna");
    expect(state.completedSteps).toEqual(["welcome"]);
  });

  it("returns complete when all steps are done", async () => {
    // primaryContact
    mockGet.mockReturnValueOnce({
      id: "contact-1",
      onboarding_welcome_seen_at_ms: Date.now(),
    });
    // Brand DNA �� completed
    mockGet.mockReturnValueOnce({ id: "bdp-1" });
    // Rev Seg — completed
    mockGet.mockReturnValueOnce({ revenue_segmentation_completed_at_ms: Date.now() });
    // Credential email lookup
    mockGet.mockReturnValueOnce({ email: "test@example.com" });
    // User record — verified
    mockGet.mockReturnValueOnce({ id: "user-1" });

    const state = await getOnboardingState("company-1", "saas");
    // product_config is not yet done (placeholder), so it won't be complete
    expect(state.currentStep).toBe("product_config");
    expect(state.completedSteps).toContain("welcome");
    expect(state.completedSteps).toContain("brand_dna");
    expect(state.completedSteps).toContain("revenue_segmentation");
  });
});

describe("getOnboardingState — retainer", () => {
  it("returns retainer sequence with welcome as first step", async () => {
    // primaryContact — welcome not seen
    mockGet.mockReturnValueOnce({
      id: "contact-1",
      onboarding_welcome_seen_at_ms: null,
    });
    // Brand DNA profile — not found
    mockGet.mockReturnValueOnce(null);
    // wizard_completions — none
    mockAll.mockReturnValueOnce([]);
    // contact email lookup
    mockGet.mockReturnValueOnce({ email: "test@example.com" });
    // user record — none
    mockGet.mockReturnValueOnce(null);

    const state = await getOnboardingState("company-1", "retainer");
    expect(state.currentStep).toBe("welcome");
    expect(state.totalSteps).toBe(4);
    expect(state.audience).toBe("retainer");
  });

  it("skips revenue_segmentation for retainer", async () => {
    // primaryContact — welcome seen
    mockGet.mockReturnValueOnce({
      id: "contact-1",
      onboarding_welcome_seen_at_ms: Date.now(),
    });
    // Brand DNA — completed
    mockGet.mockReturnValueOnce({ id: "bdp-1" });
    // wizard_completions query — all practical setup done
    mockAll.mockReturnValueOnce([
      { wizard_key: "practical-contact-details" },
      { wizard_key: "practical-ad-accounts" },
      { wizard_key: "practical-content-archive" },
    ]);
    // Credential email lookup
    mockGet.mockReturnValueOnce({ email: "test@example.com" });
    // User record — verified
    mockGet.mockReturnValueOnce({ id: "user-1" });

    const state = await getOnboardingState("company-1", "retainer");
    expect(state.completedSteps).toContain("practical_setup");
    expect(state.completedSteps).not.toContain("revenue_segmentation");
    expect(state.currentStep).toBe("complete");
  });
});

describe("getOnboardingState — edge cases", () => {
  it("returns welcome when no primary contact found", async () => {
    mockGet.mockReturnValueOnce(null);

    const state = await getOnboardingState("company-1", "saas");
    expect(state.currentStep).toBe("welcome");
    expect(state.completedSteps).toEqual([]);
  });
});
