/**
 * SW-7 — `graph-api-admin` wizard definition tests.
 * Mirrors `stripe-admin-wizard.test.ts` / `resend-wizard.test.ts` with the
 * oauth-consent composition. Asserts definition shape (steps composed from
 * STEP_TYPE_REGISTRY types), completionContract requirements, vendorManifest
 * wiring, registry membership via the defs barrel, and that a bogus token
 * is rejected by the live `/me` ping.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

// Import via the barrel to assert all three critical-flight wizards register
// from the one entrypoint.
await import("@/lib/wizards/defs");
const { graphApiAdminWizard } = await import(
  "@/lib/wizards/defs/graph-api-admin"
);
const { getWizard, listWizardKeys } = await import(
  "@/lib/wizards/registry"
);
const { graphApiManifest } = await import(
  "@/lib/integrations/vendors/graph-api"
);

describe("graph-api-admin wizard", () => {
  it("composes oauth-consent + review-and-confirm + celebration", () => {
    const types = graphApiAdminWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "oauth-consent",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("wires completionContract to the graph-api vendor manifest", () => {
    expect(graphApiAdminWizard.vendorManifest).toBe(graphApiManifest);
    expect(
      graphApiAdminWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    expect(graphApiAdminWizard.completionContract.required).toEqual([
      "accessToken",
      "verifiedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(graphApiAdminWizard.audience).toBe("admin");
    expect(graphApiAdminWizard.renderMode).toBe("dedicated-route");
    expect(graphApiAdminWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `graph-api-admin` via the defs barrel", () => {
    expect(getWizard("graph-api-admin")).toBe(graphApiAdminWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("graph-api-admin");
    expect(keys).toContain("stripe-admin");
    expect(keys).toContain("resend");
  });

  it("verify() rejects an obviously bad token with a branded reason", async () => {
    const result = await graphApiAdminWizard.completionContract.verify({
      accessToken: "not.a.real.token",
      verifiedAt: 0,
      confirmedAt: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Microsoft/);
    }
  });
});
