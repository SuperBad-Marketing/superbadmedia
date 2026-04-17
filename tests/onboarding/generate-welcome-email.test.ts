/**
 * OS-1: generateWelcomeEmail() unit tests.
 * Mocks LLM + drift check.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { llm_calls_enabled: true },
}));

const mockInvokeLlmText = vi.fn();
vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: (...args: unknown[]) => mockInvokeLlmText(...args),
}));

const mockDriftCheck = vi.fn();
vi.mock("@/lib/ai/drift-check", () => ({
  checkBrandVoiceDrift: (...args: unknown[]) => mockDriftCheck(...args),
}));

import { generateWelcomeEmail } from "@/lib/onboarding/generate-welcome-email";

const baseBrandDna = {
  voiceDescription: "dry, observational, self-deprecating",
  toneMarkers: ["warm", "direct"],
  avoidWords: ["synergy"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateWelcomeEmail", () => {
  it("returns null when llm_calls_enabled is false", async () => {
    // Override kill switch for this test
    const { killSwitches } = await import("@/lib/kill-switches");
    const original = killSwitches.llm_calls_enabled;
    (killSwitches as Record<string, boolean>).llm_calls_enabled = false;

    const result = await generateWelcomeEmail({
      audience: "retainer",
      customerName: "Jane",
      companyName: "Acme",
      portalLink: "https://example.com/portal/abc",
      superbadBrandDna: baseBrandDna,
    });

    expect(result).toBeNull();
    expect(mockInvokeLlmText).not.toHaveBeenCalled();

    // Restore
    (killSwitches as Record<string, boolean>).llm_calls_enabled = original;
  });

  it("generates retainer welcome email with valid JSON", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        subject: "Welcome, Jane",
        body_html: "<p>Good to have you.</p>",
      }),
    );
    mockDriftCheck.mockResolvedValueOnce({ pass: true, score: 0.9 });

    const result = await generateWelcomeEmail({
      audience: "retainer",
      customerName: "Jane",
      companyName: "Acme",
      portalLink: "https://example.com/portal/abc",
      dealContext: "Long sales conversation about brand direction",
      superbadBrandDna: baseBrandDna,
    });

    expect(result).toBeTruthy();
    expect(result!.subject).toBe("Welcome, Jane");
    expect(result!.bodyHtml).toBe("<p>Good to have you.</p>");
    expect(result!.driftPass).toBe(true);
    expect(result!.driftScore).toBe(0.9);
    expect(mockInvokeLlmText).toHaveBeenCalledWith(
      expect.objectContaining({ job: "onboarding-welcome-email" }),
    );
  });

  it("generates SaaS welcome email with product name", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        subject: "Welcome to ContentEngine",
        body_html: "<p>You're in.</p>",
      }),
    );
    mockDriftCheck.mockResolvedValueOnce({ pass: true, score: 0.85 });

    const result = await generateWelcomeEmail({
      audience: "saas",
      customerName: "Bob",
      companyName: "Bob's Burgers",
      portalLink: "https://example.com/portal/xyz",
      productName: "ContentEngine",
      location: "Melbourne",
      industry: "hospitality_food",
      superbadBrandDna: baseBrandDna,
    });

    expect(result).toBeTruthy();
    expect(result!.subject).toContain("ContentEngine");
  });

  it("returns null on invalid LLM JSON", async () => {
    mockInvokeLlmText.mockResolvedValueOnce("I can't generate that");

    const result = await generateWelcomeEmail({
      audience: "saas",
      customerName: "Test",
      companyName: "TestCo",
      portalLink: "https://example.com/portal/abc",
      superbadBrandDna: baseBrandDna,
    });

    expect(result).toBeNull();
  });

  it("reports drift check failure without blocking", async () => {
    mockInvokeLlmText.mockResolvedValueOnce(
      JSON.stringify({
        subject: "Hey there",
        body_html: "<p>Leverage our synergies!</p>",
      }),
    );
    mockDriftCheck.mockResolvedValueOnce({ pass: false, score: 0.3 });

    const result = await generateWelcomeEmail({
      audience: "retainer",
      customerName: "Jane",
      companyName: "Acme",
      portalLink: "https://example.com/portal/abc",
      superbadBrandDna: baseBrandDna,
    });

    expect(result).toBeTruthy();
    expect(result!.driftPass).toBe(false);
    expect(result!.driftScore).toBe(0.3);
  });
});
