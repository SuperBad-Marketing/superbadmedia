/**
 * SW-5 — `stripe-admin` wizard definition tests.
 * Asserts definition shape (steps composed from STEP_TYPE_REGISTRY types),
 * completionContract requirements, vendorManifest wiring, and registry
 * membership.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

const { stripeAdminWizard } = await import(
  "@/lib/wizards/defs/stripe-admin"
);
const { getWizard, listWizardKeys } = await import(
  "@/lib/wizards/registry"
);
const { stripeManifest } = await import(
  "@/lib/integrations/vendors/stripe"
);

describe("stripe-admin wizard", () => {
  it("composes api-key-paste + webhook-probe + review-and-confirm + celebration", () => {
    const types = stripeAdminWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "api-key-paste",
      "webhook-probe",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("wires completionContract to the stripe vendor manifest", () => {
    expect(stripeAdminWizard.vendorManifest).toBe(stripeManifest);
    expect(stripeAdminWizard.completionContract.artefacts.integrationConnections).toBe(
      true,
    );
    expect(stripeAdminWizard.completionContract.required).toEqual([
      "apiKey",
      "verifiedAt",
      "webhookReceivedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(stripeAdminWizard.audience).toBe("admin");
    expect(stripeAdminWizard.renderMode).toBe("dedicated-route");
    expect(stripeAdminWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `stripe-admin` on module import", () => {
    expect(getWizard("stripe-admin")).toBe(stripeAdminWizard);
    expect(listWizardKeys()).toContain("stripe-admin");
  });

  it("verify() rejects an obviously bad key with a branded reason", async () => {
    const result = await stripeAdminWizard.completionContract.verify({
      apiKey: "sk_test_totally_not_a_real_key",
      verifiedAt: 0,
      webhookReceivedAt: 0,
      confirmedAt: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Stripe/);
    }
  });
});
