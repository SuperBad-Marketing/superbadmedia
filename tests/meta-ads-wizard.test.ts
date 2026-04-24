/**
 * SW-10 — `meta` wizard definition tests (renamed from meta-ads).
 * Mirrors `graph-api-admin-wizard.test.ts` — oauth-consent arc, live-ping
 * verify(), registry membership via the defs barrel.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

// Import via the barrel to assert the meta wizard registers alongside
// the critical trio + cloudinary from the one entrypoint.
await import("@/lib/wizards/defs");
const { metaWizard } = await import("@/lib/wizards/defs/meta");
const { getWizard, listWizardKeys } = await import("@/lib/wizards/registry");
const { metaManifest } = await import("@/lib/integrations/vendors/meta");

describe("meta wizard", () => {
  it("composes oauth-consent + review-and-confirm + celebration", () => {
    const types = metaWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "oauth-consent",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("wires completionContract to the meta vendor manifest", () => {
    expect(metaWizard.vendorManifest).toBe(metaManifest);
    expect(
      metaWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    expect(metaWizard.completionContract.required).toEqual([
      "accessToken",
      "verifiedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(metaWizard.audience).toBe("admin");
    expect(metaWizard.renderMode).toBe("dedicated-route");
    expect(metaWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `meta` via the defs barrel alongside the rest", () => {
    expect(getWizard("meta")).toBe(metaWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("meta");
    expect(keys).toContain("cloudinary");
    expect(keys).toContain("stripe-admin");
    expect(keys).toContain("resend");
    expect(keys).toContain("graph-api-admin");
  });

  it("verify() rejects an obviously bad token with a branded reason", async () => {
    const result = await metaWizard.completionContract.verify({
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
