/**
 * SW-9 — `pixieset-admin` wizard definition tests.
 * Mirrors `resend-wizard.test.ts` / `graph-api-admin-wizard.test.ts`, with
 * the paste-URL form composition and a trivially-passing verify() (per
 * P0 spike outcome B — no live API).
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

// Import via the barrel to assert the first non-critical admin wizard
// registers alongside the critical-flight trio from the one entrypoint.
await import("@/lib/wizards/defs");
const {
  pixiesetAdminWizard,
  pixiesetGalleryUrlSchema,
  extractPixiesetSlug,
} = await import("@/lib/wizards/defs/pixieset-admin");
const { getWizard, listWizardKeys } = await import(
  "@/lib/wizards/registry"
);
const { pixiesetManifest } = await import(
  "@/lib/integrations/vendors/pixieset"
);

describe("pixieset-admin wizard", () => {
  it("composes form + review-and-confirm + celebration (no verify-ping step)", () => {
    const types = pixiesetAdminWizard.steps.map((s) => s.type);
    expect(types).toEqual(["form", "review-and-confirm", "celebration"]);
  });

  it("wires completionContract to the pixieset vendor manifest", () => {
    expect(pixiesetAdminWizard.vendorManifest).toBe(pixiesetManifest);
    expect(
      pixiesetAdminWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    expect(pixiesetAdminWizard.completionContract.required).toEqual([
      "galleryUrl",
      "slug",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(pixiesetAdminWizard.audience).toBe("admin");
    expect(pixiesetAdminWizard.renderMode).toBe("dedicated-route");
    expect(pixiesetAdminWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `pixieset-admin` via the defs barrel alongside the critical trio", () => {
    expect(getWizard("pixieset-admin")).toBe(pixiesetAdminWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("pixieset-admin");
    expect(keys).toContain("stripe-admin");
    expect(keys).toContain("resend");
    expect(keys).toContain("graph-api-admin");
  });

  it("verify() trivially returns ok — no live API per P0 outcome B", async () => {
    const result = await pixiesetAdminWizard.completionContract.verify({
      galleryUrl: "https://anyslug.pixieset.com/a/",
      slug: "anyslug",
      confirmedAt: 0,
    });
    expect(result.ok).toBe(true);
  });

  it("gallery URL schema accepts canonical pixieset hosts and rejects everything else", () => {
    expect(
      pixiesetGalleryUrlSchema.safeParse({
        url: "https://andys-studio.pixieset.com/trial-shoot/",
      }).success,
    ).toBe(true);
    expect(
      pixiesetGalleryUrlSchema.safeParse({
        url: "http://andys-studio.pixieset.com/trial-shoot/",
      }).success,
    ).toBe(false);
    expect(
      pixiesetGalleryUrlSchema.safeParse({
        url: "https://pixieset.com/something",
      }).success,
    ).toBe(false);
    expect(
      pixiesetGalleryUrlSchema.safeParse({
        url: "https://evil.example/andys.pixieset.com",
      }).success,
    ).toBe(false);
    expect(
      pixiesetGalleryUrlSchema.safeParse({ url: "" }).success,
    ).toBe(false);
    expect(extractPixiesetSlug("https://andys-studio.pixieset.com/x/")).toBe(
      "andys-studio",
    );
    expect(extractPixiesetSlug("nope")).toBe("");
  });
});
