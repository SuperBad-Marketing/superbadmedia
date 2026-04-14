/**
 * SW-6 — `resend` wizard definition tests.
 * Mirrors `stripe-admin-wizard.test.ts` minus the webhook-probe leg.
 * Asserts definition shape (steps composed from STEP_TYPE_REGISTRY types),
 * completionContract requirements, vendorManifest wiring, and registry
 * membership.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

// Import via the barrel to exercise the SW-6 closure of
// `sw5_wizard_defs_barrel_owed` — asserting both wizards register from the
// one entrypoint.
await import("@/lib/wizards/defs");
const { resendWizard } = await import("@/lib/wizards/defs/resend");
const { getWizard, listWizardKeys } = await import(
  "@/lib/wizards/registry"
);
const { resendManifest } = await import(
  "@/lib/integrations/vendors/resend"
);

describe("resend wizard", () => {
  it("composes api-key-paste + review-and-confirm + celebration (no webhook-probe)", () => {
    const types = resendWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "api-key-paste",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("wires completionContract to the resend vendor manifest", () => {
    expect(resendWizard.vendorManifest).toBe(resendManifest);
    expect(resendWizard.completionContract.artefacts.integrationConnections).toBe(
      true,
    );
    expect(resendWizard.completionContract.required).toEqual([
      "apiKey",
      "verifiedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(resendWizard.audience).toBe("admin");
    expect(resendWizard.renderMode).toBe("dedicated-route");
    expect(resendWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `resend` via the defs barrel", () => {
    expect(getWizard("resend")).toBe(resendWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("resend");
    expect(keys).toContain("stripe-admin");
  });

  it("verify() rejects an obviously bad key with a branded reason", async () => {
    const result = await resendWizard.completionContract.verify({
      apiKey: "re_not_a_real_key_at_all",
      verifiedAt: 0,
      confirmedAt: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Resend/);
    }
  });
});
