/**
 * SW-12 — `twilio` wizard definition tests.
 * Mirrors `pixieset-admin-wizard.test.ts`, with two-field Zod validation
 * + a live Basic-auth ping for the verify() check.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

// Import via the barrel to assert the fourth non-critical admin wizard
// registers alongside the rest of the family from the one entrypoint.
await import("@/lib/wizards/defs");
const {
  twilioWizard,
  twilioCredentialsSchema,
  maskTwilioSid,
  maskTwilioToken,
} = await import("@/lib/wizards/defs/twilio");
const { getWizard, listWizardKeys } = await import("@/lib/wizards/registry");
const { twilioManifest } = await import("@/lib/integrations/vendors/twilio");

describe("twilio wizard", () => {
  it("composes form + review-and-confirm + celebration", () => {
    const types = twilioWizard.steps.map((s) => s.type);
    expect(types).toEqual(["form", "review-and-confirm", "celebration"]);
  });

  it("wires completionContract to the twilio vendor manifest", () => {
    expect(twilioWizard.vendorManifest).toBe(twilioManifest);
    expect(
      twilioWizard.completionContract.artefacts.integrationConnections,
    ).toBe(true);
    expect(twilioWizard.completionContract.required).toEqual([
      "accountSid",
      "authToken",
      "verifiedAt",
      "confirmedAt",
    ]);
  });

  it("renders as a dedicated route for admins with no per-wizard capstone", () => {
    expect(twilioWizard.audience).toBe("admin");
    expect(twilioWizard.renderMode).toBe("dedicated-route");
    expect(twilioWizard.voiceTreatment.capstone).toBeUndefined();
  });

  it("is registered via the defs barrel alongside every prior wizard", () => {
    expect(getWizard("twilio")).toBe(twilioWizard);
    const keys = listWizardKeys();
    expect(keys).toContain("twilio");
    expect(keys).toContain("stripe-admin");
    expect(keys).toContain("resend");
    expect(keys).toContain("graph-api-admin");
    expect(keys).toContain("pixieset-admin");
    expect(keys).toContain("meta-ads");
    expect(keys).toContain("google-ads");
  });

  it("credential schema accepts canonical SID + token and rejects malformed input", () => {
    const goodSid = `AC${"a".repeat(32)}`;
    const goodToken = "b".repeat(32);
    expect(
      twilioCredentialsSchema.safeParse({
        accountSid: goodSid,
        authToken: goodToken,
      }).success,
    ).toBe(true);
    expect(
      twilioCredentialsSchema.safeParse({
        accountSid: "ACnope",
        authToken: goodToken,
      }).success,
    ).toBe(false);
    expect(
      twilioCredentialsSchema.safeParse({
        accountSid: `XX${"a".repeat(32)}`,
        authToken: goodToken,
      }).success,
    ).toBe(false);
    expect(
      twilioCredentialsSchema.safeParse({
        accountSid: goodSid,
        authToken: "shortsecret",
      }).success,
    ).toBe(false);
    expect(maskTwilioSid(goodSid)).toBe(`ACaa…aaaa`);
    expect(maskTwilioToken(goodToken)).toBe(`…bbbb`);
  });

  it("verify() rejects bad credentials via live Twilio account ping", async () => {
    const result = await twilioWizard.completionContract.verify({
      accountSid: `AC${"0".repeat(32)}`,
      authToken: "0".repeat(32),
      verifiedAt: 0,
      confirmedAt: 0,
    });
    expect(result.ok).toBe(false);
  }, 15000);
});
