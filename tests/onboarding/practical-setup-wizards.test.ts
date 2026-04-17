/**
 * OS-2: Practical setup wizard definitions — registration + contract tests.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  __resetWizardRegistryForTests,
  getWizard,
  listWizardKeys,
} from "@/lib/wizards/registry";

// Reset first so we start clean, then import definitions to trigger self-registration
beforeAll(async () => {
  __resetWizardRegistryForTests();
  // Dynamic import so side-effect registration fires after reset
  await import("@/lib/wizards/defs/practical-setup");
});

describe("practical setup wizard registration", () => {
  it("registers all three practical setup wizard keys", () => {
    const keys = listWizardKeys();
    expect(keys).toContain("practical-contact-details");
    expect(keys).toContain("practical-ad-accounts");
    expect(keys).toContain("practical-content-archive");
  });

  it("practical-contact-details has client audience + slideover", () => {
    const def = getWizard("practical-contact-details");
    expect(def).toBeDefined();
    expect(def!.audience).toBe("client");
    expect(def!.renderMode).toBe("slideover");
  });

  it("practical-ad-accounts has client audience + slideover", () => {
    const def = getWizard("practical-ad-accounts");
    expect(def).toBeDefined();
    expect(def!.audience).toBe("client");
    expect(def!.renderMode).toBe("slideover");
  });

  it("practical-content-archive has client audience + slideover", () => {
    const def = getWizard("practical-content-archive");
    expect(def).toBeDefined();
    expect(def!.audience).toBe("client");
    expect(def!.renderMode).toBe("slideover");
  });

  it("practical-contact-details has 2 steps (form + review)", () => {
    const def = getWizard("practical-contact-details");
    expect(def!.steps).toHaveLength(2);
    expect(def!.steps[0].type).toBe("form");
    expect(def!.steps[1].type).toBe("review-and-confirm");
  });

  it("practical-ad-accounts has 3 steps (meta + google + review)", () => {
    const def = getWizard("practical-ad-accounts");
    expect(def!.steps).toHaveLength(3);
    expect(def!.steps[0].label).toBe("Meta Business Manager");
    expect(def!.steps[1].label).toBe("Google Ads");
    expect(def!.steps[2].type).toBe("review-and-confirm");
  });

  it("practical-content-archive has 2 steps (form + review)", () => {
    const def = getWizard("practical-content-archive");
    expect(def!.steps).toHaveLength(2);
    expect(def!.steps[0].type).toBe("form");
    expect(def!.steps[1].type).toBe("review-and-confirm");
  });

  it("completion contracts require confirmedAt", () => {
    for (const key of [
      "practical-contact-details",
      "practical-ad-accounts",
      "practical-content-archive",
    ]) {
      const def = getWizard(key);
      expect(def!.completionContract.required).toContain("confirmedAt");
    }
  });

  it("contact-details contract rejects empty contacts array", async () => {
    const def = getWizard("practical-contact-details");
    const result = await def!.completionContract.verify({
      contacts: [],
      confirmedAt: Date.now(),
    });
    expect(result.ok).toBe(false);
  });

  it("contact-details contract accepts valid contacts", async () => {
    const def = getWizard("practical-contact-details");
    const result = await def!.completionContract.verify({
      contacts: [{ name: "Alice", email: "alice@co.com" }],
      confirmedAt: Date.now(),
    });
    expect(result.ok).toBe(true);
  });

  it("ad-accounts contract accepts empty payload (both optional)", async () => {
    const def = getWizard("practical-ad-accounts");
    const result = await def!.completionContract.verify({
      confirmedAt: Date.now(),
    });
    expect(result.ok).toBe(true);
  });

  it("content-archive contract accepts empty payload (links optional)", async () => {
    const def = getWizard("practical-content-archive");
    const result = await def!.completionContract.verify({
      confirmedAt: Date.now(),
    });
    expect(result.ok).toBe(true);
  });
});
