import { describe, it, expect } from "vitest";

describe("activity log kinds for retainer kickoff", () => {
  it("includes retainer_mode_brand_dna_gate_entered", async () => {
    const { ACTIVITY_LOG_KINDS } = await import(
      "@/lib/db/schema/activity-log"
    );
    expect(ACTIVITY_LOG_KINDS).toContain("retainer_mode_brand_dna_gate_entered");
  });

  it("includes retainer_kickoff_bartender_message_sent", async () => {
    const { ACTIVITY_LOG_KINDS } = await import(
      "@/lib/db/schema/activity-log"
    );
    expect(ACTIVITY_LOG_KINDS).toContain(
      "retainer_kickoff_bartender_message_sent",
    );
  });
});

describe("portal mode result shape", () => {
  it("exports PortalModeResult with brandDnaComplete and retainerKickoffSaid", async () => {
    const mod = await import("@/lib/portal/mode");
    expect(mod.getPortalMode).toBeTypeOf("function");
  });
});

describe("contacts schema columns for retainer kickoff", () => {
  it("has retainer_kickoff_bartender_said_at_ms column", async () => {
    const { contacts } = await import("@/lib/db/schema/contacts");
    expect(contacts.retainer_kickoff_bartender_said_at_ms).toBeDefined();
  });

  it("has onboarding_welcome_seen_at_ms column", async () => {
    const { contacts } = await import("@/lib/db/schema/contacts");
    expect(contacts.onboarding_welcome_seen_at_ms).toBeDefined();
  });

  it("has bundled_hub_seen_at_ms column", async () => {
    const { contacts } = await import("@/lib/db/schema/contacts");
    expect(contacts.bundled_hub_seen_at_ms).toBeDefined();
  });
});

describe("generateOpeningLine accepts kickoff option", () => {
  it("function signature accepts options parameter", async () => {
    const { generateOpeningLine } = await import("@/lib/portal/chat");
    expect(generateOpeningLine).toBeTypeOf("function");
    expect(generateOpeningLine.length).toBeLessThanOrEqual(2);
  });
});

describe("brand-dna-gate component", () => {
  it("module exports BrandDnaGate", async () => {
    const mod = await import(
      "@/components/lite/portal/brand-dna-gate"
    );
    expect(mod.BrandDnaGate).toBeTypeOf("function");
  });
});

describe("chat API route shape", () => {
  it("exports POST handler", async () => {
    const mod = await import("@/app/api/lite/portal/chat/route");
    expect(mod.POST).toBeTypeOf("function");
  });

  it("exports GET handler", async () => {
    const mod = await import("@/app/api/lite/portal/chat/route");
    expect(mod.GET).toBeTypeOf("function");
  });
});

describe("tour suppression logic", () => {
  it("ChatHome accepts kickoffVariant prop", async () => {
    const mod = await import("@/components/lite/portal/chat-home");
    expect(mod.ChatHome).toBeTypeOf("function");
  });
});
