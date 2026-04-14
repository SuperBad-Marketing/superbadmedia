/**
 * SW-2 — `celebration` step-type tests.
 * Verifies it plays the Tier 2 `wizard-complete` choreography (consumes the
 * registered slot, doesn't inline its own variants) and renders outro copy
 * + observatory summary + done CTA.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { celebrationStep } from "@/components/lite/wizard-steps/celebration-step";
import { tier2, TIER_2_KEYS } from "@/lib/motion/choreographies";
import { STEP_TYPE_REGISTRY } from "@/components/lite/wizard-steps";

describe("celebrationStep", () => {
  it("is registered in STEP_TYPE_REGISTRY under `celebration`", () => {
    expect(STEP_TYPE_REGISTRY.celebration).toBe(celebrationStep);
  });

  it("references the A4-registered `wizard-complete` Tier 2 slot", () => {
    expect(TIER_2_KEYS).toContain("wizard-complete");
    expect(tier2["wizard-complete"]).toBeDefined();
  });

  it("renders outro copy + observatory summary + done CTA", () => {
    const Comp = celebrationStep.Component;
    const html = renderToStaticMarkup(
      <Comp
        stepKey="done"
        state={{
          outroCopy: "You&apos;re wired up.",
          observatorySummary: "Bands registered: send, deliver, bounce.",
        }}
        onChange={() => {}}
        onNext={() => {}}
        audience="admin"
        config={{ onDone: () => {} }}
      />,
    );
    expect(html).toContain('data-wizard-step="celebration"');
    expect(html).toContain('data-choreography="wizard-complete"');
    expect(html).toContain("Bands registered");
    expect(html).toContain("Done");
  });

  it("validate always passes — reaching celebration means the wizard succeeded", () => {
    expect(
      celebrationStep.validate({
        outroCopy: "",
        observatorySummary: null,
      }),
    ).toEqual({ ok: true });
  });
});
