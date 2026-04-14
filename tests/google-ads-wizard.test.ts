/**
 * SW-11 — `google-ads` wizard definition tests.
 * Mirrors `meta-ads-wizard.test.ts` — oauth-consent arc, live-ping verify(),
 * registry membership via the defs barrel.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

await import("@/lib/wizards/defs");
const { googleAdsWizard } = await import("@/lib/wizards/defs/google-ads");
const { getWizard, listWizardKeys } = await import("@/lib/wizards/registry");
const { googleAdsManifest } = await import(
  "@/lib/integrations/vendors/google-ads"
);

describe("google-ads wizard", () => {
  it("composes oauth-consent + review-and-confirm + celebration", () => {
    const types = googleAdsWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "oauth-consent",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("wires completionContract to the google-ads vendor manifest", () => {
    expect(googleAdsWizard.vendorManifest).toBe(googleAdsManifest);
    expect(
      googleAdsWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    expect(googleAdsWizard.completionContract.required).toEqual([
      "accessToken",
      "verifiedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(googleAdsWizard.audience).toBe("admin");
    expect(googleAdsWizard.renderMode).toBe("dedicated-route");
    expect(googleAdsWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `google-ads` via the defs barrel alongside the rest", () => {
    expect(getWizard("google-ads")).toBe(googleAdsWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("google-ads");
    expect(keys).toContain("meta-ads");
    expect(keys).toContain("pixieset-admin");
    expect(keys).toContain("stripe-admin");
    expect(keys).toContain("resend");
    expect(keys).toContain("graph-api-admin");
  });

  it("verify() rejects an obviously bad token with a branded reason", async () => {
    const result = await googleAdsWizard.completionContract.verify({
      accessToken: "not.a.real.token",
      verifiedAt: 0,
      confirmedAt: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Google/);
    }
  });
});
