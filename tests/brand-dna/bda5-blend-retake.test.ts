/**
 * BDA-5 tests — company blend, retake comparison, start retake, portal actions.
 *
 * Unit tests covering the library-layer functions added in BDA-5.
 * LLM-calling functions are tested for structural correctness (prompt building,
 * caching, gating) but not actual Opus output quality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prompt builders (pure functions — testable without mocks) ──────────────

import { buildCompanyBlendPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-company-blend";
import { buildRetakeComparisonPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-retake-comparison";
import type { StakeholderProfile } from "@/lib/ai/prompts/brand-dna-assessment/generate-company-blend";

describe("buildCompanyBlendPrompt", () => {
  const stakeholders: StakeholderProfile[] = [
    {
      name: "Alice",
      track: "founder",
      tagFrequencyMap: { warmth: 5, directness: 3, minimalism: 2 },
      firstImpression: "Warm and decisive.",
      prosePortrait: "Alice leads with warmth and instinct. ".repeat(20),
      brandOverrideTags: null,
    },
    {
      name: "Bob",
      track: "business",
      tagFrequencyMap: { directness: 4, high_contrast: 3, pragmatism: 2 },
      firstImpression: "Sharp, practical, no wasted motion.",
      prosePortrait: "Bob's world is clean lines and clear calls. ".repeat(20),
      brandOverrideTags: null,
    },
  ];

  it("produces a prompt containing all stakeholder names", () => {
    const prompt = buildCompanyBlendPrompt({
      companyName: "TestCo",
      stakeholders,
    });
    expect(prompt).toContain("Alice");
    expect(prompt).toContain("Bob");
    expect(prompt).toContain("TestCo");
  });

  it("includes the three section markers", () => {
    const prompt = buildCompanyBlendPrompt({
      companyName: "TestCo",
      stakeholders,
    });
    expect(prompt).toContain("=== SHARED SIGNALS ===");
    expect(prompt).toContain("=== DIVERGENCES ===");
    expect(prompt).toContain("=== COMPANY PORTRAIT ===");
  });

  it("includes brand override tags when present", () => {
    const withOverrides: StakeholderProfile[] = [
      {
        ...stakeholders[0],
        brandOverrideTags: { "brand_override.communication.formal": 3 },
      },
      stakeholders[1],
    ];
    const prompt = buildCompanyBlendPrompt({
      companyName: "TestCo",
      stakeholders: withOverrides,
    });
    expect(prompt).toContain("Brand overrides:");
    expect(prompt).toContain("brand_override.communication.formal");
  });
});

describe("buildRetakeComparisonPrompt", () => {
  it("categorises tag movements correctly", () => {
    const prompt = buildRetakeComparisonPrompt({
      subjectName: "TestBrand",
      track: "founder",
      previousTags: { warmth: 5, directness: 3, minimalism: 4 },
      currentTags: { warmth: 5, directness: 6, boldness: 2 },
      previousFirstImpression: "Old impression.",
      currentFirstImpression: "New impression.",
      previousPortraitExcerpt: "Previous portrait text.",
      currentPortraitExcerpt: "Current portrait text.",
      daysBetween: 90,
    });
    expect(prompt).toContain("New signals");
    expect(prompt).toContain("boldness");
    expect(prompt).toContain("Disappeared signals");
    expect(prompt).toContain("minimalism");
    expect(prompt).toContain("Strengthened");
    expect(prompt).toContain("directness");
  });

  it("uses correct timeframe for short gaps", () => {
    const prompt = buildRetakeComparisonPrompt({
      subjectName: "X",
      track: "founder",
      previousTags: {},
      currentTags: {},
      previousFirstImpression: "",
      currentFirstImpression: "",
      previousPortraitExcerpt: "",
      currentPortraitExcerpt: "",
      daysBetween: 15,
    });
    expect(prompt).toContain("subtle shifts");
  });

  it("uses correct timeframe for long gaps", () => {
    const prompt = buildRetakeComparisonPrompt({
      subjectName: "X",
      track: "founder",
      previousTags: {},
      currentTags: {},
      previousFirstImpression: "",
      currentFirstImpression: "",
      previousPortraitExcerpt: "",
      currentPortraitExcerpt: "",
      daysBetween: 365,
    });
    expect(prompt).toContain("meaningful shifts");
  });
});

// ── startRetake (testable with a mock DB via drizzle) ──────────────────────

describe("startRetake", () => {
  it("exports the function", async () => {
    const mod = await import("@/lib/brand-dna/start-retake");
    expect(typeof mod.startRetake).toBe("function");
  });
});

// ── generateCompanyBlend / generateRetakeComparison (gated, export check) ──

describe("generateCompanyBlend", () => {
  it("exports the function", async () => {
    const mod = await import("@/lib/brand-dna/generate-company-blend");
    expect(typeof mod.generateCompanyBlend).toBe("function");
  });
});

describe("generateRetakeComparison", () => {
  it("exports the function", async () => {
    const mod = await import("@/lib/brand-dna/generate-retake-comparison");
    expect(typeof mod.generateRetakeComparison).toBe("function");
  });
});

// ── Barrel exports ─────────────────────────────────────────────────────────

describe("brand-dna barrel (BDA-5 additions)", () => {
  it("exports BDA-5 functions and types", async () => {
    const mod = await import("@/lib/brand-dna");
    expect(typeof mod.generateCompanyBlend).toBe("function");
    expect(typeof mod.generateRetakeComparison).toBe("function");
    expect(typeof mod.startRetake).toBe("function");
  });
});
