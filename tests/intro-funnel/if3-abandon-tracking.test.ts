import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));
vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { llm_calls_enabled: true, outreach_send_enabled: true },
}));
vi.mock("@/lib/channels/sms/send", () => ({
  sendSms: vi.fn().mockResolvedValue({ sent: true }),
}));
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));
vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn().mockResolvedValue(
    JSON.stringify({ subject: "Test subject", body: "Test body" }),
  ),
}));
vi.mock("@/lib/ai/drift-check", () => ({
  checkBrandVoiceDrift: vi.fn().mockResolvedValue({ pass: true, score: 0.9 }),
}));
vi.mock("@/lib/quote-builder/superbad-brand-profile", () => ({
  getSuperbadBrandProfile: vi.fn().mockResolvedValue({
    voiceDescription: "Dry",
    toneMarkers: ["dry"],
  }),
}));
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn().mockResolvedValue(null),
}));

import { runAbandonCheck, ensureAbandonCheckEnqueued } from "@/lib/intro-funnel/abandon-tracking";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

describe("runAbandonCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero processed when no eligible submissions", async () => {
    const result = await runAbandonCheck();
    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe("ensureAbandonCheckEnqueued", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues an intro_funnel_abandon_check task", async () => {
    await ensureAbandonCheckEnqueued();
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "intro_funnel_abandon_check",
        idempotencyKey: "intro_funnel_abandon_check_hourly",
      }),
    );
  });
});
