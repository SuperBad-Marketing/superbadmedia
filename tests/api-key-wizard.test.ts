/**
 * SW-13 — generic `api-key` wizard definition tests.
 *
 * First wizard def serving N vendors from a single module. Asserts step
 * composition, per-vendor profile wiring (manifest + verify dispatch),
 * registry barrel integrity (now 8 wizards), vendor-string validation,
 * and one live-verify rejection against OpenAI with zeroed credentials
 * to prove the vendor dispatch round-trips to the real API.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

// Import via the barrel — same discipline as every prior wizard test.
await import("@/lib/wizards/defs");
const {
  apiKeyWizard,
  API_KEY_VENDOR_PROFILES,
  getApiKeyVendorProfile,
  isApiKeyVendor,
} = await import("@/lib/wizards/defs/api-key");
const { getWizard, listWizardKeys } = await import("@/lib/wizards/registry");
const { openaiManifest } = await import("@/lib/integrations/vendors/openai");
const { anthropicManifest } = await import(
  "@/lib/integrations/vendors/anthropic"
);
const { serpapiManifest } = await import(
  "@/lib/integrations/vendors/serpapi"
);
const { remotionManifest } = await import(
  "@/lib/integrations/vendors/remotion"
);

describe("api-key wizard", () => {
  it("composes api-key-paste + review-and-confirm + celebration", () => {
    const types = apiKeyWizard.steps.map((s) => s.type);
    expect(types).toEqual([
      "api-key-paste",
      "review-and-confirm",
      "celebration",
    ]);
  });

  it("declares the generic completion contract with vendor as a required key", () => {
    expect(apiKeyWizard.completionContract.required).toEqual([
      "vendor",
      "apiKey",
      "verifiedAt",
      "confirmedAt",
    ]);
    expect(
      apiKeyWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    // vendorManifest is intentionally undefined — per-vendor manifests are
    // selected at completion time from payload.vendor.
    expect(apiKeyWizard.vendorManifest).toBeUndefined();
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(apiKeyWizard.audience).toBe("admin");
    expect(apiKeyWizard.renderMode).toBe("dedicated-route");
    expect(apiKeyWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered under key `api-key` alongside the seven prior wizards (eight total)", () => {
    expect(getWizard("api-key")).toBe(apiKeyWizard);
    const keys = listWizardKeys();
    for (const k of [
      "stripe-admin",
      "resend",
      "graph-api-admin",
      "pixieset-admin",
      "meta-ads",
      "google-ads",
      "twilio",
      "api-key",
    ]) {
      expect(keys).toContain(k);
    }
  });

  it("wires every vendor profile to its own vendor manifest", () => {
    expect(API_KEY_VENDOR_PROFILES.openai.manifest).toBe(openaiManifest);
    expect(API_KEY_VENDOR_PROFILES.anthropic.manifest).toBe(anthropicManifest);
    expect(API_KEY_VENDOR_PROFILES.serpapi.manifest).toBe(serpapiManifest);
    expect(API_KEY_VENDOR_PROFILES.remotion.manifest).toBe(remotionManifest);
  });

  it("isApiKeyVendor accepts the four known vendors and rejects others", () => {
    expect(isApiKeyVendor("openai")).toBe(true);
    expect(isApiKeyVendor("anthropic")).toBe(true);
    expect(isApiKeyVendor("serpapi")).toBe(true);
    expect(isApiKeyVendor("remotion")).toBe(true);
    expect(isApiKeyVendor("stripe")).toBe(false);
    expect(isApiKeyVendor("")).toBe(false);
    expect(isApiKeyVendor(undefined)).toBe(false);
    expect(isApiKeyVendor(null)).toBe(false);
  });

  it("remotion profile verifies format only (no network)", async () => {
    const short = await getApiKeyVendorProfile("remotion").verify("too-short");
    expect(short.ok).toBe(false);
    const good = await getApiKeyVendorProfile("remotion").verify(
      "a".repeat(40),
    );
    expect(good.ok).toBe(true);
  });

  it("completionContract.verify dispatches on payload.vendor and rejects unknown vendors", async () => {
    const bogus = await apiKeyWizard.completionContract.verify({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vendor: "nope" as any,
      apiKey: "irrelevant",
      verifiedAt: 0,
      confirmedAt: 0,
    });
    expect(bogus.ok).toBe(false);
  });

  it("verify() rejects bad OpenAI key via live /v1/models ping", async () => {
    const result = await apiKeyWizard.completionContract.verify({
      vendor: "openai",
      apiKey: "sk-invalid-000000000000000000000000000000",
      verifiedAt: 0,
      confirmedAt: 0,
    });
    expect(result.ok).toBe(false);
  }, 15000);
});
