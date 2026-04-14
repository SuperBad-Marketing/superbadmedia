/**
 * SW-2 — state-blob resume round-trip for 3 representative step-types.
 * Locks in that `resume(serialize(state)) === state` via JSON, which is how
 * wizard_progress.step_state is persisted (TEXT column, JSON-encoded).
 */
import { describe, it, expect } from "vitest";
import { formStep } from "@/components/lite/wizard-steps/form-step";
import { apiKeyPasteStep } from "@/components/lite/wizard-steps/api-key-paste-step";
import { contentPickerStep } from "@/components/lite/wizard-steps/content-picker-step";

function roundTrip<T>(step: { resume: (raw: unknown) => T }, state: T): T {
  return step.resume(JSON.parse(JSON.stringify(state)));
}

describe("step-type resume round-trips", () => {
  it("form — preserves values verbatim", () => {
    const state = { values: { email: "x@y.co", name: "a" } };
    expect(roundTrip(formStep, state)).toEqual(state);
  });

  it("api-key-paste — preserves verified flag + masked suffix", () => {
    const state = {
      key: "sk_test_abc123",
      verified: true,
      maskedSuffix: "••••c123",
      error: null,
    };
    expect(roundTrip(apiKeyPasteStep, state)).toEqual(state);
  });

  it("content-picker — preserves items + selection", () => {
    const state = {
      items: [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B", description: "second" },
      ],
      selectedId: "b",
    };
    expect(roundTrip(contentPickerStep, state)).toEqual(state);
  });
});
