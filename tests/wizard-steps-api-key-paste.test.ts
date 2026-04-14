/**
 * SW-2 — `api-key-paste` step-type tests.
 * Verifies the resume/validate contract and the masked-on-save rule.
 */
import { describe, it, expect } from "vitest";
import { apiKeyPasteStep } from "@/components/lite/wizard-steps/api-key-paste-step";

describe("apiKeyPasteStep", () => {
  it("resumes to empty defaults when blob is missing", () => {
    expect(apiKeyPasteStep.resume(null)).toEqual({
      key: "",
      verified: false,
      maskedSuffix: null,
      error: null,
    });
  });

  it("round-trips a verified key with mask", () => {
    const state = {
      key: "sk_live_1234567890",
      verified: true,
      maskedSuffix: "••••7890",
      error: null,
    };
    expect(apiKeyPasteStep.resume(state)).toEqual(state);
  });

  it("validate rejects an un-tested key with branded copy", () => {
    const result = apiKeyPasteStep.validate({
      key: "sk_live_123",
      verified: false,
      maskedSuffix: null,
      error: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toMatch(/Error:|at .+\(/);
  });

  it("validate passes when verified", () => {
    expect(
      apiKeyPasteStep.validate({
        key: "sk_live_123",
        verified: true,
        maskedSuffix: "••••_123",
        error: null,
      }),
    ).toEqual({ ok: true });
  });

  it("exposes the contract shape SW-3 depends on", () => {
    expect(apiKeyPasteStep.type).toBe("api-key-paste");
    expect(apiKeyPasteStep.resumableByDefault).toBe(true);
    expect(typeof apiKeyPasteStep.Component).toBe("function");
  });
});
