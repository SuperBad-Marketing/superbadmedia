/**
 * SB-2a — saas-product-setup wizard definition shape.
 * Mirrors pixieset-admin-wizard.test.ts. No DB, no mocks beyond vault key.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

await import("@/lib/wizards/defs");
const {
  saasProductSetupWizard,
  saasProductNameSlugSchema,
  validateDimensions,
  suggestSlugFromName,
  suggestDimensionKey,
  SAAS_DIMENSION_KEY_REGEX,
  SAAS_PRODUCT_SLUG_REGEX,
  MIN_DIMENSIONS,
  MAX_DIMENSIONS,
} = await import("@/lib/wizards/defs/saas-product-setup");
const { getWizard, listWizardKeys } = await import("@/lib/wizards/registry");

describe("saas-product-setup wizard definition", () => {
  it("registers 7 steps in the documented order", () => {
    const keys = saasProductSetupWizard.steps.map((s) => s.key);
    expect(keys).toEqual([
      "name-and-slug",
      "usage-dimensions",
      "tiers",
      "pricing",
      "demo-config",
      "review",
      "celebrate",
    ]);
    const types = saasProductSetupWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "form",
      "custom",
      "custom",
      "custom",
      "custom",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("is an admin slideover without a vendor manifest or capstone", () => {
    expect(saasProductSetupWizard.audience).toBe("admin");
    expect(saasProductSetupWizard.renderMode).toBe("slideover");
    expect(saasProductSetupWizard.vendorManifest).toBeUndefined();
    expect(saasProductSetupWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("registers under key `saas-product-setup` via the defs barrel", () => {
    expect(getWizard("saas-product-setup")).toBe(saasProductSetupWizard);
    expect(listWizardKeys()).toContain("saas-product-setup");
  });

  it("completion contract requires the publish-time payload shape", () => {
    expect(saasProductSetupWizard.completionContract.required).toEqual([
      "productId",
      "name",
      "slug",
      "dimensions",
      "publishedAt",
    ]);
    expect(
      saasProductSetupWizard.completionContract.artefacts.activityLog,
    ).toBe("saas_product_created");
  });

  it("verify() returns not-ok until SB-2b lands", async () => {
    const r = await saasProductSetupWizard.completionContract.verify({
      productId: "x",
      name: "x",
      slug: "x",
      description: null,
      dimensions: [],
      publishedAt: 0,
    });
    expect(r.ok).toBe(false);
  });

  it("name-and-slug schema rejects short/invalid inputs", () => {
    expect(
      saasProductNameSlugSchema.safeParse({
        name: "A",
        description: "",
        slug: "ok",
      }).success,
    ).toBe(false);
    expect(
      saasProductNameSlugSchema.safeParse({
        name: "Hello",
        description: "",
        slug: "Bad Slug",
      }).success,
    ).toBe(false);
    expect(
      saasProductNameSlugSchema.safeParse({
        name: "Hello Product",
        description: "",
        slug: "hello-product",
      }).success,
    ).toBe(true);
  });

  it("validateDimensions enforces 1–3 rows + valid keys + uniqueness", () => {
    expect(validateDimensions([]).ok).toBe(false);
    expect(
      validateDimensions([
        { tempId: "a", key: "a", displayName: "A" },
        { tempId: "b", key: "b", displayName: "B" },
        { tempId: "c", key: "c", displayName: "C" },
        { tempId: "d", key: "d", displayName: "D" },
      ]).ok,
    ).toBe(false);
    expect(
      validateDimensions([
        { tempId: "a", key: "2bad", displayName: "A" },
      ]).ok,
    ).toBe(false);
    expect(
      validateDimensions([
        { tempId: "a", key: "same", displayName: "A" },
        { tempId: "b", key: "same", displayName: "B" },
      ]).ok,
    ).toBe(false);
    expect(
      validateDimensions([
        { tempId: "a", key: "api_calls", displayName: "API calls" },
      ]).ok,
    ).toBe(true);
    expect(MIN_DIMENSIONS).toBe(1);
    expect(MAX_DIMENSIONS).toBe(3);
  });

  it("slug and dimension suggestions normalise input", () => {
    expect(suggestSlugFromName("My New Thing!")).toBe("my-new-thing");
    expect(suggestDimensionKey("Active Campaigns")).toBe("active_campaigns");
    expect(SAAS_PRODUCT_SLUG_REGEX.test("good-slug")).toBe(true);
    expect(SAAS_DIMENSION_KEY_REGEX.test("good_key")).toBe(true);
    expect(SAAS_DIMENSION_KEY_REGEX.test("2bad")).toBe(false);
  });
});
