/**
 * SW-10 — `meta-ads` wizard definition tests.
 * Mirrors `graph-api-admin-wizard.test.ts` — oauth-consent arc, live-ping
 * verify(), registry membership via the defs barrel.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

// Import via the barrel to assert the second non-critical admin wizard
// registers alongside the critical trio + pixieset-admin from the one
// entrypoint.
await import("@/lib/wizards/defs");
const { metaAdsWizard } = await import("@/lib/wizards/defs/meta-ads");
const { getWizard, listWizardKeys } = await import("@/lib/wizards/registry");
const { metaAdsManifest } = await import(
  "@/lib/integrations/vendors/meta-ads"
);

describe("meta-ads wizard", () => {
  it("composes oauth-consent + review-and-confirm + celebration", () => {
    const types = metaAdsWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "oauth-consent",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("wires completionContract to the meta-ads vendor manifest", () => {
    expect(metaAdsWizard.vendorManifest).toBe(metaAdsManifest);
    expect(
      metaAdsWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    expect(metaAdsWizard.completionContract.required).toEqual([
      "accessToken",
      "verifiedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(metaAdsWizard.audience).toBe("admin");
    expect(metaAdsWizard.renderMode).toBe("dedicated-route");
    expect(metaAdsWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `meta-ads` via the defs barrel alongside the rest", () => {
    expect(getWizard("meta-ads")).toBe(metaAdsWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("meta-ads");
    expect(keys).toContain("pixieset-admin");
    expect(keys).toContain("stripe-admin");
    expect(keys).toContain("resend");
    expect(keys).toContain("graph-api-admin");
  });

  it("verify() rejects an obviously bad token with a branded reason", async () => {
    const result = await metaAdsWizard.completionContract.verify({
      accessToken: "not.a.real.token",
      verifiedAt: 0,
      confirmedAt: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Meta/);
    }
  });
});
