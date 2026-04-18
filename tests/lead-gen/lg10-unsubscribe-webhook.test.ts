import { describe, it, expect, vi, beforeEach } from "vitest";

// Unsubscribe token tests
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/settings", () => ({ default: { get: vi.fn(() => "") } }));
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(() => ({ sent: true, messageId: "msg_test" })),
}));
vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { outreach_send_enabled: true },
}));

describe("unsubscribe token", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-key-for-unsubscribe-tokens";
  });

  it("creates and verifies a valid token", async () => {
    const { createUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/lead-gen/unsubscribe-token"
    );

    const token = createUnsubscribeToken({
      email: "test@example.com",
      candidate_id: "cand_123",
      issued_at: Date.now(),
    });

    expect(token).toContain(".");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);

    const result = verifyUnsubscribeToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.email).toBe("test@example.com");
      expect(result.payload.candidate_id).toBe("cand_123");
    }
  });

  it("rejects a tampered token", async () => {
    const { createUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/lead-gen/unsubscribe-token"
    );

    const token = createUnsubscribeToken({
      email: "test@example.com",
      issued_at: Date.now(),
    });

    const tampered = token.slice(0, -1) + "X";
    const result = verifyUnsubscribeToken(tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const { verifyUnsubscribeToken } = await import(
      "@/lib/lead-gen/unsubscribe-token"
    );

    const result = verifyUnsubscribeToken("not-a-real-token");
    expect(result.valid).toBe(false);
  });

  it("creates a full unsubscribe URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://lite.superbadmedia.com.au";
    const { createUnsubscribeUrl } = await import(
      "@/lib/lead-gen/unsubscribe-token"
    );

    const url = createUnsubscribeUrl({
      email: "test@example.com",
      issued_at: Date.now(),
    });

    expect(url).toContain("https://lite.superbadmedia.com.au/api/unsubscribe?token=");
  });
});

describe("webhook handler types", () => {
  it("email.opened and email.clicked are in RESEND_EVENT_TYPES", async () => {
    const { RESEND_EVENT_TYPES } = await import(
      "@/lib/resend/webhook-handlers/types"
    );

    expect(RESEND_EVENT_TYPES).toContain("email.opened");
    expect(RESEND_EVENT_TYPES).toContain("email.clicked");
  });
});

describe("engagement evaluator tier classification", () => {
  it("tier 1 for click", async () => {
    const { classifyEngagementTier } = await import(
      "@/lib/lead-gen/engagement-evaluator"
    );
    expect(
      classifyEngagementTier({ click_count: 1, open_count: 0, first_open_dwell_sec: null }),
    ).toBe(1);
  });

  it("tier 4 for no engagement", async () => {
    const { classifyEngagementTier } = await import(
      "@/lib/lead-gen/engagement-evaluator"
    );
    expect(
      classifyEngagementTier({ click_count: 0, open_count: 0, first_open_dwell_sec: null }),
    ).toBe(4);
  });
});

describe("scheduled task type registration", () => {
  it("stale_nudge_generator is a registered task type", async () => {
    const { SCHEDULED_TASK_TYPES } = await import(
      "@/lib/db/schema/scheduled-tasks"
    );
    expect(SCHEDULED_TASK_TYPES).toContain("stale_nudge_generator");
  });
});

describe("handler registry includes LG-10 handlers", () => {
  it("LEAD_GEN_SEQUENCE_HANDLERS has stale_nudge_generator", async () => {
    const { LEAD_GEN_SEQUENCE_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/lead-gen-sequence"
    );
    expect(LEAD_GEN_SEQUENCE_HANDLERS).toHaveProperty("stale_nudge_generator");
    expect(typeof LEAD_GEN_SEQUENCE_HANDLERS.stale_nudge_generator).toBe("function");
  });
});

describe("barrel exports", () => {
  it("LG-10 exports are accessible", async () => {
    const leadGen = await import("@/lib/lead-gen");
    expect(leadGen.createUnsubscribeToken).toBeDefined();
    expect(leadGen.verifyUnsubscribeToken).toBeDefined();
    expect(leadGen.createUnsubscribeUrl).toBeDefined();
    expect(leadGen.generateStaleNudges).toBeDefined();
  });
});
