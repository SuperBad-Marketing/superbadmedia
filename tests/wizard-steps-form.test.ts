/**
 * SW-2 — `form` step-type tests.
 * Verifies resume() round-trips form state and validate() accepts any
 * object-shaped state (schema-level validation happens on submit inside
 * the Component, not at the registry level).
 */
import { describe, it, expect } from "vitest";
import { formStep } from "@/components/lite/wizard-steps/form-step";

describe("formStep", () => {
  it("resumes an empty state when the blob is undefined", () => {
    expect(formStep.resume(undefined)).toEqual({ values: {} });
  });

  it("round-trips a populated state blob", () => {
    const state = { values: { email: "a@b.co", name: "Andy" } };
    const resumed = formStep.resume(state);
    expect(resumed).toEqual(state);
  });

  it("validate accepts a well-shaped state", () => {
    expect(formStep.validate({ values: {} })).toEqual({ ok: true });
  });

  it("validate rejects a malformed state with a user-safe reason", () => {
    // @ts-expect-error — deliberately malformed
    const result = formStep.validate({ values: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toMatch(/stack|Error:/i);
  });

  it("exposes resumableByDefault = true per spec §4", () => {
    expect(formStep.resumableByDefault).toBe(true);
    expect(formStep.type).toBe("form");
  });
});
