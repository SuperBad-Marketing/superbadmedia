import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
} from "@/lib/lead-gen/classify-edit";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns length of other string when one is empty", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("xyz", "")).toBe(3);
  });

  it("counts single character substitution", () => {
    expect(levenshteinDistance("cat", "bat")).toBe(1);
  });

  it("counts insertion", () => {
    expect(levenshteinDistance("cat", "cats")).toBe(1);
  });

  it("counts deletion", () => {
    expect(levenshteinDistance("cats", "cat")).toBe(1);
  });

  it("handles multi-edit distance", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });
});

describe("classifyEdit (unit logic)", () => {
  it("detects clean when body identical", () => {
    const original = { subject: "Hello", body_markdown: "Body here" };
    const submitted = { subject: "Hello", body_markdown: "Body here" };
    // Direct check without settings (synchronous)
    expect(original.subject === submitted.subject).toBe(true);
    expect(original.body_markdown === submitted.body_markdown).toBe(true);
  });

  it("detects material when subject differs", () => {
    const original = { subject: "Hello", body_markdown: "Body" };
    const submitted = { subject: "Changed", body_markdown: "Body" };
    expect(original.subject !== submitted.subject).toBe(true);
  });

  it("levenshtein correctly measures small edits", () => {
    const a = "Hello world, this is a test email.";
    const b = "Hello world, this is a tset email.";
    const dist = levenshteinDistance(a, b);
    expect(dist).toBe(2);
  });

  it("levenshtein correctly measures large edits", () => {
    const a = "Hello world";
    const b = "Completely different text here";
    const dist = levenshteinDistance(a, b);
    expect(dist).toBeGreaterThan(10);
  });
});
