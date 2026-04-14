/**
 * SW-2 — `review-and-confirm` step-type tests.
 */
import { describe, it, expect } from "vitest";
import { reviewConfirmStep } from "@/components/lite/wizard-steps/review-confirm-step";

describe("reviewConfirmStep", () => {
  it("resumes summary + confirmed flag", () => {
    const state = {
      summary: [{ label: "Email", value: "a@b.co" }],
      confirmed: false,
    };
    expect(reviewConfirmStep.resume(state)).toEqual(state);
  });

  it("validate rejects unconfirmed state", () => {
    const result = reviewConfirmStep.validate({ summary: [], confirmed: false });
    expect(result.ok).toBe(false);
  });

  it("validate passes confirmed state", () => {
    expect(
      reviewConfirmStep.validate({ summary: [], confirmed: true }),
    ).toEqual({ ok: true });
  });
});
