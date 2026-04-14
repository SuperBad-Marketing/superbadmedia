/**
 * Wizard registry tests (SW-1).
 *
 * Verifies WizardDefinition shape type-checks, registerWizard inserts +
 * getWizard retrieves, and duplicate-key registration throws.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerWizard,
  getWizard,
  listWizardKeys,
  __resetWizardRegistryForTests,
} from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

type FakePayload = { apiKey: string; verifiedAt: number };

function makeDef(key: string): WizardDefinition<FakePayload> {
  return {
    key,
    audience: "admin",
    renderMode: "slideover",
    steps: [
      { key: "enter-key", type: "api-key-paste", label: "Paste key", resumable: true },
      { key: "done", type: "celebration", label: "Done", resumable: false },
    ],
    completionContract: {
      required: ["apiKey", "verifiedAt"],
      verify: async (p) =>
        p.apiKey.length > 0 ? { ok: true } : { ok: false, reason: "missing key" },
      artefacts: { integrationConnections: true },
    },
    voiceTreatment: {
      introCopy: "Let's hook up the thing.",
      outroCopy: "Hooked.",
      tabTitlePool: {
        setup: ["Setup…"],
        connecting: ["Connecting…"],
        confirming: ["Confirming…"],
        connected: ["Connected."],
        stuck: ["Stuck?"],
      },
    },
  };
}

describe("wizard registry", () => {
  beforeEach(() => {
    __resetWizardRegistryForTests();
  });

  it("registers a wizard and retrieves it by key", () => {
    const def = makeDef("fake-vendor");
    registerWizard(def);
    const got = getWizard("fake-vendor");
    expect(got).toBeDefined();
    expect(got!.key).toBe("fake-vendor");
    expect(got!.audience).toBe("admin");
  });

  it("returns undefined for an unknown key", () => {
    expect(getWizard("not-registered")).toBeUndefined();
  });

  it("throws on duplicate key registration", () => {
    const def = makeDef("dup-key");
    registerWizard(def);
    expect(() => registerWizard(def)).toThrow(/duplicate registration/);
  });

  it("lists every registered key, sorted", () => {
    registerWizard(makeDef("zeta"));
    registerWizard(makeDef("alpha"));
    registerWizard(makeDef("mike"));
    expect(listWizardKeys()).toEqual(["alpha", "mike", "zeta"]);
  });

  it("type-checks a CompletionContract<TPayload> generic end-to-end", async () => {
    const def = makeDef("typecheck");
    const result = await def.completionContract.verify({
      apiKey: "sk_test",
      verifiedAt: Date.now(),
    });
    expect(result).toEqual({ ok: true });

    const failed = await def.completionContract.verify({
      apiKey: "",
      verifiedAt: Date.now(),
    });
    expect(failed).toEqual({ ok: false, reason: "missing key" });
  });
});
