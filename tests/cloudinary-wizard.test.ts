import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

await import("@/lib/wizards/defs");
const {
  cloudinaryWizard,
  cloudinaryCredentialsSchema,
} = await import("@/lib/wizards/defs/cloudinary");
const { getWizard, listWizardKeys } = await import("@/lib/wizards/registry");
const { cloudinaryManifest } = await import(
  "@/lib/integrations/vendors/cloudinary"
);

describe("cloudinary wizard", () => {
  it("composes form + review-and-confirm + celebration", () => {
    const types = cloudinaryWizard.steps.map((s) => s.type);
    expect(types).toEqual(["form", "review-and-confirm", "celebration"]);
  });

  it("wires completionContract to the cloudinary vendor manifest", () => {
    expect(cloudinaryWizard.vendorManifest).toBe(cloudinaryManifest);
    expect(
      cloudinaryWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    expect(cloudinaryWizard.completionContract.required).toEqual([
      "cloudName",
      "apiKey",
      "apiSecret",
      "verifiedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no capstone", () => {
    expect(cloudinaryWizard.audience).toBe("admin");
    expect(cloudinaryWizard.renderMode).toBe("dedicated-route");
    expect(cloudinaryWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `cloudinary` via the defs barrel", () => {
    expect(getWizard("cloudinary")).toBe(cloudinaryWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("cloudinary");
    expect(keys).toContain("stripe-admin");
    expect(keys).toContain("resend");
    expect(keys).toContain("graph-api-admin");
  });

  it("credentials schema accepts valid cloud name + numeric API key + secret", () => {
    expect(
      cloudinaryCredentialsSchema.safeParse({
        cloudName: "my-cloud",
        apiKey: "123456789012345",
        apiSecret: "abc123XYZ-_secret",
      }).success,
    ).toBe(true);
  });

  it("credentials schema rejects non-numeric API key", () => {
    expect(
      cloudinaryCredentialsSchema.safeParse({
        cloudName: "my-cloud",
        apiKey: "not-a-number",
        apiSecret: "secret",
      }).success,
    ).toBe(false);
  });

  it("credentials schema rejects empty cloud name", () => {
    expect(
      cloudinaryCredentialsSchema.safeParse({
        cloudName: "",
        apiKey: "123456789012345",
        apiSecret: "secret",
      }).success,
    ).toBe(false);
  });

  it("credentials schema rejects empty API secret", () => {
    expect(
      cloudinaryCredentialsSchema.safeParse({
        cloudName: "my-cloud",
        apiKey: "123456789012345",
        apiSecret: "",
      }).success,
    ).toBe(false);
  });

  it("vendor manifest declares three jobs with correct bands", () => {
    expect(cloudinaryManifest.vendorKey).toBe("cloudinary");
    expect(cloudinaryManifest.jobs).toHaveLength(3);
    const names = cloudinaryManifest.jobs.map((j) => j.name);
    expect(names).toContain("cloudinary.upload");
    expect(names).toContain("cloudinary.list_folder");
    expect(names).toContain("cloudinary.generate_archive");
  });

  it("vendor manifest uses a dedicated kill-switch key", () => {
    expect(cloudinaryManifest.killSwitchKey).toBe(
      "integrations.cloudinary.enabled",
    );
  });
});

describe("cloudinary_gallery_folder column on deals", () => {
  it("exists in the deals schema", async () => {
    const { deals } = await import("@/lib/db/schema/deals");
    expect(deals.cloudinary_gallery_folder).toBeDefined();
  });
});
