/**
 * SW-5 — critical-flight route resolution tests.
 *
 * Full Server Component rendering requires an auth session + db + settings
 * seed that aren't hermetic at unit-test scope. These tests assert the
 * resolution primitive the route depends on: the wizard registry
 * side-effect imports on stripe-admin, returns the definition by key, and
 * yields undefined for unknown keys (which the route maps to notFound()).
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = "a".repeat(64);
});

const { getWizard } = await import("@/lib/wizards/registry");
// Trigger the registration side-effect the route relies on.
await import("@/lib/wizards/defs/stripe-admin");

describe("critical-flight route resolution", () => {
  it("resolves getWizard('stripe-admin') after the def module loads", () => {
    const def = getWizard("stripe-admin");
    expect(def).toBeDefined();
    expect(def?.key).toBe("stripe-admin");
    expect(def?.audience).toBe("admin");
  });

  it("returns undefined for an unknown key (route maps → notFound)", () => {
    expect(getWizard("does-not-exist")).toBeUndefined();
  });
});
