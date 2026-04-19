import { describe, it, expect } from "vitest";

describe("bundle-reveal choreography", () => {
  it("exists in the Tier 2 registry", async () => {
    const { TIER_2_KEYS, tier2 } = await import(
      "@/lib/motion/choreographies"
    );

    expect(TIER_2_KEYS).toContain("bundle-reveal");
    expect(tier2["bundle-reveal"]).toBeDefined();
    expect(tier2["bundle-reveal"].durationMs).toBe(600);
  });

  it("has container stagger for tile entrance", async () => {
    const { tier2 } = await import("@/lib/motion/choreographies");
    const entry = tier2["bundle-reveal"];

    expect(entry.container).toBeDefined();
    expect(entry.container?.transition).toHaveProperty("staggerChildren");
  });

  it("has reduced-motion fallback", async () => {
    const { tier2 } = await import("@/lib/motion/choreographies");
    const entry = tier2["bundle-reveal"];

    expect(entry.reduced).toBeDefined();
    expect(entry.reduced.variants.initial).toHaveProperty("opacity", 0);
    expect(entry.reduced.variants.animate).toHaveProperty("opacity", 1);
  });
});

describe("activity log kinds", () => {
  it("includes bundle hub kinds", async () => {
    const { ACTIVITY_LOG_KINDS } = await import(
      "@/lib/db/schema/activity-log"
    );

    expect(ACTIVITY_LOG_KINDS).toContain("bundled_hub_shown");
    expect(ACTIVITY_LOG_KINDS).toContain("bundled_hub_dismissed");
  });
});

describe("portal sections", () => {
  it("includes plan section accessible in pre-retainer mode", async () => {
    const { PORTAL_SECTIONS } = await import("@/lib/portal/mode");
    const plan = PORTAL_SECTIONS.find(
      (s: { key: string }) => s.key === "plan",
    );

    expect(plan).toBeDefined();
    expect(plan?.preRetainer).toBe(true);
    expect(plan?.label).toBe("Your Plan");
  });
});

describe("contacts schema", () => {
  it("has bundled_hub_seen_at_ms column", async () => {
    const { contacts } = await import("@/lib/db/schema/contacts");
    expect(contacts.bundled_hub_seen_at_ms).toBeDefined();
  });
});

describe("BundleHubState type", () => {
  it("exports getBundleHubState and dismissBundleHub", async () => {
    const mod = await import("@/lib/portal/bundle-hub");
    expect(typeof mod.getBundleHubState).toBe("function");
    expect(typeof mod.dismissBundleHub).toBe("function");
  });
});
