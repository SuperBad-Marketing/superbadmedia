/**
 * SW-3 — Stripe vendor manifest shape tests.
 *
 * Validates the shipped seed manifest against the VendorManifest contract
 * and confirms its kill-switch key resolves to a real registered flag.
 */
import { describe, it, expect } from "vitest";
import { stripeManifest } from "@/lib/integrations/vendors/stripe";
import type { VendorManifest } from "@/lib/wizards/types";
import { KILL_SWITCH_KEYS } from "@/lib/kill-switches";

describe("stripeManifest", () => {
  it("conforms to VendorManifest (type-level check via assignment)", () => {
    const m: VendorManifest = stripeManifest;
    expect(m.vendorKey).toBe("stripe-admin");
    expect(m.actorConvention).toBe("internal");
  });

  it("declares at least one job band", () => {
    expect(stripeManifest.jobs.length).toBeGreaterThan(0);
    for (const j of stripeManifest.jobs) {
      expect(typeof j.name).toBe("string");
      expect(j.name.startsWith("stripe.")).toBe(true);
      expect(j.defaultBand.p95).toBeGreaterThan(0);
      expect(j.defaultBand.p99).toBeGreaterThanOrEqual(j.defaultBand.p95);
      expect(j.unit).toBe("ms");
    }
  });

  it("kill-switch key is a registered kill-switch", () => {
    expect(KILL_SWITCH_KEYS).toContain(stripeManifest.killSwitchKey);
  });

  it("has a human description", () => {
    expect(stripeManifest.humanDescription.length).toBeGreaterThan(10);
  });
});
