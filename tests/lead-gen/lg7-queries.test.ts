import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });

  return {
    db: {
      select: mockSelect,
    },
  };
});

vi.mock("@/lib/lead-gen/warmup", () => ({
  enforceWarmupCap: vi.fn().mockResolvedValue({
    cap: 5,
    used: 2,
    remaining: 3,
    can_send: true,
    current_week: 1,
    is_graduated: false,
    days_until_next_ramp: 5,
    scheduled_sequence_touches_today: 0,
  }),
}));

describe("Lead Gen query modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQueueHeaderData", () => {
    it("returns null lastRun when no runs exist", async () => {
      const { getQueueHeaderData } = await import(
        "@/lib/lead-gen/queries/header"
      );
      const data = await getQueueHeaderData();
      expect(data.lastRun).toBeNull();
      expect(data.warmup.currentWeek).toBe(1);
      expect(data.warmup.cap).toBe(5);
      expect(data.warmup.used).toBe(2);
    });
  });

  describe("getWarmupProgress", () => {
    it("maps enforceWarmupCap output to WarmupProgress shape", async () => {
      const { getWarmupProgress } = await import(
        "@/lib/lead-gen/queries/metrics"
      );
      const progress = await getWarmupProgress();
      expect(progress).toEqual({
        cap: 5,
        used: 2,
        remaining: 3,
        currentWeek: 1,
        isGraduated: false,
        daysUntilNextRamp: 5,
      });
    });
  });
});

describe("Lead Gen DNC actions", () => {
  it("rejects invalid email", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "admin-1", role: "admin" },
      }),
    }));

    const { addDncEmailAction } = await import(
      "@/app/lite/admin/lead-gen/actions"
    );
    const result = await addDncEmailAction("not-an-email");
    expect(result).toEqual({ ok: false, error: "Invalid email." });
  });

  it("rejects invalid domain", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "admin-1", role: "admin" },
      }),
    }));

    const { addDncDomainAction } = await import(
      "@/app/lite/admin/lead-gen/actions"
    );
    const result = await addDncDomainAction("user@invalid");
    expect(result).toEqual({ ok: false, error: "Invalid domain." });
  });
});

describe("Lead Gen activity log kinds", () => {
  it("includes all LG-7 activity log kinds", async () => {
    const { ACTIVITY_LOG_KINDS } = await import(
      "@/lib/db/schema/activity-log"
    );
    const requiredKinds = [
      "outreach_draft_approved",
      "outreach_draft_rejected",
      "dnc_email_added",
      "dnc_email_removed",
      "dnc_domain_added",
      "dnc_domain_removed",
    ];
    for (const kind of requiredKinds) {
      expect(ACTIVITY_LOG_KINDS).toContain(kind);
    }
  });
});

describe("Admin nav includes Lead Gen", () => {
  it("has a lead-gen nav item", async () => {
    const { ADMIN_NAV_PRIMARY } = await import(
      "@/components/lite/admin-shell-nav"
    );
    const leadGenItem = ADMIN_NAV_PRIMARY.find(
      (item) => item.id === "lead-gen",
    );
    expect(leadGenItem).toBeDefined();
    expect(leadGenItem!.status).toBe("live");
    expect(leadGenItem!.href).toBe("/lite/admin/lead-gen");
    expect(leadGenItem!.matchPrefix).toBe("/lite/admin/lead-gen");
  });
});
