import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "mock" }),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { outreach_send_enabled: true, llm_calls_enabled: true },
}));

vi.mock("@/lib/channels/email/quiet-window", () => ({
  isWithinQuietWindow: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: "msg_123" }),
}));

vi.mock("@/lib/lead-gen/dnc", () => ({
  isBlockedFromOutreach: vi
    .fn()
    .mockResolvedValue({ blocked: false, reason: null }),
}));

vi.mock("@/lib/lead-gen/warmup", () => ({
  enforceWarmupCap: vi.fn().mockResolvedValue({
    cap: 30,
    used: 5,
    remaining: 25,
    can_send: true,
    current_week: 5,
    is_graduated: true,
    days_until_next_ramp: null,
    scheduled_sequence_touches_today: 0,
  }),
  recordWarmupSend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/lead-gen/autonomy", () => ({
  getAutonomyRow: vi.fn().mockResolvedValue({
    track: "saas",
    mode: "manual",
    clean_approval_streak: 0,
    graduation_threshold: 10,
    probation_sends_remaining: null,
    probation_threshold: 5,
    rolling_window_size: 20,
    maintenance_floor_pct: 80,
    circuit_broken_at: null,
    circuit_broken_reason: null,
    last_graduated_at: null,
    last_demoted_at: null,
  }),
  transitionAutonomyState: vi.fn().mockResolvedValue({
    previousMode: "manual",
    newMode: "manual",
    streak: 0,
    transitioned: false,
  }),
  getAutoSendDelayMs: vi.fn().mockResolvedValue(15 * 60 * 1000),
}));

vi.mock("@/lib/lead-gen/draft-generator", () => ({
  generateDraft: vi.fn().mockResolvedValue({
    ok: true,
    draft: {
      draftId: "draft_follow_up_1",
      subject: "Follow up",
      bodyMarkdown: "Hey, following up.",
      modelUsed: "claude-opus-4-6",
      promptVersion: "lg5-v1",
      generationMs: 500,
      driftCheckScore: 90,
      driftCheckRegenerated: false,
      driftCheckFlagged: false,
    },
  }),
}));

vi.mock("@/lib/crm/create-deal-from-lead", () => ({
  createDealFromLead: vi.fn().mockReturnValue({
    company: { id: "comp_1", name: "Test Co" },
    contact: { id: "contact_1", name: "Jane", email: "jane@test.com" },
    deal: { id: "deal_new_1" },
    companyReused: false,
    contactReused: false,
  }),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(""),
  },
}));

describe("sequence-engine", () => {
  describe("getNextTouchDueMs", () => {
    it("returns 4 days after touch 1 (for touch 2)", async () => {
      const { getNextTouchDueMs } = await import(
        "@/lib/lead-gen/sequence-engine"
      );
      const base = Date.now();
      const result = getNextTouchDueMs(base, 1);
      expect(result).toBe(base + 4 * 24 * 60 * 60 * 1000);
    });

    it("returns 7 days after touch 2 (for touch 3)", async () => {
      const { getNextTouchDueMs } = await import(
        "@/lib/lead-gen/sequence-engine"
      );
      const base = Date.now();
      const result = getNextTouchDueMs(base, 2);
      expect(result).toBe(base + 7 * 24 * 60 * 60 * 1000);
    });

    it("returns 10 days after touch 3+ (for touch 4+)", async () => {
      const { getNextTouchDueMs } = await import(
        "@/lib/lead-gen/sequence-engine"
      );
      const base = Date.now();
      expect(getNextTouchDueMs(base, 3)).toBe(
        base + 10 * 24 * 60 * 60 * 1000,
      );
      expect(getNextTouchDueMs(base, 10)).toBe(
        base + 10 * 24 * 60 * 60 * 1000,
      );
    });
  });

  describe("runSequenceScheduler", () => {
    it("returns zero counts when kill switch is off", async () => {
      const { killSwitches } = await import("@/lib/kill-switches");
      (killSwitches as Record<string, boolean>).outreach_send_enabled = false;

      const { runSequenceScheduler } = await import(
        "@/lib/lead-gen/sequence-engine"
      );
      const result = await runSequenceScheduler();
      expect(result.processed).toBe(0);
      expect(result.draftsGenerated).toBe(0);

      (killSwitches as Record<string, boolean>).outreach_send_enabled = true;
    });
  });
});

describe("engagement-evaluator", () => {
  describe("classifyEngagementTier", () => {
    it("returns tier 1 for clicks", async () => {
      const { classifyEngagementTier } = await import(
        "@/lib/lead-gen/engagement-evaluator"
      );
      expect(
        classifyEngagementTier({
          click_count: 2,
          open_count: 3,
          first_open_dwell_sec: 120,
        }),
      ).toBe(1);
    });

    it("returns tier 2 for full opens (dwell >= 60s)", async () => {
      const { classifyEngagementTier } = await import(
        "@/lib/lead-gen/engagement-evaluator"
      );
      expect(
        classifyEngagementTier({
          click_count: 0,
          open_count: 1,
          first_open_dwell_sec: 60,
        }),
      ).toBe(2);
    });

    it("returns tier 2 for multiple opens regardless of dwell", async () => {
      const { classifyEngagementTier } = await import(
        "@/lib/lead-gen/engagement-evaluator"
      );
      expect(
        classifyEngagementTier({
          click_count: 0,
          open_count: 3,
          first_open_dwell_sec: 10,
        }),
      ).toBe(2);
    });

    it("returns tier 3 for sub-60s single open", async () => {
      const { classifyEngagementTier } = await import(
        "@/lib/lead-gen/engagement-evaluator"
      );
      expect(
        classifyEngagementTier({
          click_count: 0,
          open_count: 1,
          first_open_dwell_sec: 30,
        }),
      ).toBe(3);
    });

    it("returns tier 3 for single open with null dwell", async () => {
      const { classifyEngagementTier } = await import(
        "@/lib/lead-gen/engagement-evaluator"
      );
      expect(
        classifyEngagementTier({
          click_count: 0,
          open_count: 1,
          first_open_dwell_sec: null,
        }),
      ).toBe(3);
    });

    it("returns tier 4 for no engagement", async () => {
      const { classifyEngagementTier } = await import(
        "@/lib/lead-gen/engagement-evaluator"
      );
      expect(
        classifyEngagementTier({
          click_count: 0,
          open_count: 0,
          first_open_dwell_sec: null,
        }),
      ).toBe(4);
    });

    it("click always trumps opens", async () => {
      const { classifyEngagementTier } = await import(
        "@/lib/lead-gen/engagement-evaluator"
      );
      expect(
        classifyEngagementTier({
          click_count: 1,
          open_count: 0,
          first_open_dwell_sec: null,
        }),
      ).toBe(1);
    });
  });
});

describe("scheduled-task-handlers", () => {
  it("exports all three handler functions", async () => {
    const { LEAD_GEN_SEQUENCE_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/lead-gen-sequence"
    );
    expect(LEAD_GEN_SEQUENCE_HANDLERS).toHaveProperty("sequence_scheduler");
    expect(LEAD_GEN_SEQUENCE_HANDLERS).toHaveProperty(
      "engagement_tier_evaluator",
    );
    expect(LEAD_GEN_SEQUENCE_HANDLERS).toHaveProperty("auto_send_execute");
    expect(typeof LEAD_GEN_SEQUENCE_HANDLERS.sequence_scheduler).toBe(
      "function",
    );
    expect(typeof LEAD_GEN_SEQUENCE_HANDLERS.engagement_tier_evaluator).toBe(
      "function",
    );
    expect(typeof LEAD_GEN_SEQUENCE_HANDLERS.auto_send_execute).toBe(
      "function",
    );
  });
});

describe("handler-registry", () => {
  it("includes all LG-9 handlers in the registry", async () => {
    const { HANDLER_REGISTRY } = await import(
      "@/lib/scheduled-tasks/handlers/index"
    );
    expect(HANDLER_REGISTRY).toHaveProperty("sequence_scheduler");
    expect(HANDLER_REGISTRY).toHaveProperty("engagement_tier_evaluator");
    expect(HANDLER_REGISTRY).toHaveProperty("auto_send_execute");
  });
});

describe("barrel exports", () => {
  it("exports LG-9 functions from barrel", async () => {
    const barrel = await import("@/lib/lead-gen/index");
    expect(typeof barrel.runSequenceScheduler).toBe("function");
    expect(typeof barrel.executeSend).toBe("function");
    expect(typeof barrel.getNextTouchDueMs).toBe("function");
    expect(typeof barrel.evaluateEngagementTiers).toBe("function");
    expect(typeof barrel.classifyEngagementTier).toBe("function");
  });
});

describe("getAutoSendDelayMs", () => {
  it("reads from settings and converts to milliseconds", async () => {
    const { getAutoSendDelayMs } = await import("@/lib/lead-gen/autonomy");
    const delayMs = await getAutoSendDelayMs();
    expect(delayMs).toBe(15 * 60 * 1000);
  });
});
