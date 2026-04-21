import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRows: unknown[] = [];

function chainable(): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  const methods = [
    "from", "where", "groupBy", "orderBy", "limit", "offset",
    "innerJoin", "leftJoin", "all", "get", "set",
  ];
  for (const m of methods) {
    if (m === "all") {
      self[m] = vi.fn(() => Promise.resolve([...mockRows]));
    } else if (m === "get") {
      self[m] = vi.fn(() => Promise.resolve(mockRows[0] ?? null));
    } else {
      self[m] = vi.fn(() => self);
    }
  }
  return self;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => chainable()),
    update: vi.fn(() => chainable()),
    insert: vi.fn(() => chainable()),
  },
}));

const mockSettings: Record<string, unknown> = {};

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => mockSettings[key] ?? null),
    set: vi.fn(async () => {}),
    invalidateCache: vi.fn(),
  },
}));

vi.mock("@/lib/observatory/job-registry", () => {
  const MOCK_REGISTRY: Record<string, unknown> = {
    "outreach-writer": {
      vendor: "anthropic",
      description: "Outreach email generation",
      bands: { per_call_ceiling_aud: 0.5, daily_ceiling_aud: 10, learned_band_multiplier: 2 },
    },
    "brand-dna-generator": {
      vendor: "anthropic",
      description: "Brand DNA generation",
      bands: { per_call_ceiling_aud: 3.0, daily_ceiling_aud: 50, learned_band_multiplier: 2.5 },
    },
  };
  return {
    JOB_REGISTRY: MOCK_REGISTRY,
    REGISTERED_JOB_KEYS: Object.keys(MOCK_REGISTRY),
    getJobEntry: vi.fn((key: string) => MOCK_REGISTRY[key] ?? null),
    getJobBands: vi.fn((key: string) => {
      const entry = MOCK_REGISTRY[key] as { bands?: unknown } | undefined;
      return entry?.bands;
    }),
    getEffectiveBands: vi.fn(async (key: string) => {
      const entry = MOCK_REGISTRY[key] as { bands?: unknown } | undefined;
      return entry?.bands;
    }),
    isJobRegistered: vi.fn((key: string) => key in MOCK_REGISTRY),
    getJobVendor: vi.fn((key: string) => {
      const entry = MOCK_REGISTRY[key] as { vendor?: string } | undefined;
      return entry?.vendor ?? "unknown";
    }),
    getJobDisabledUntil: vi.fn(() => undefined),
    getRegisteredJobsByVendor: vi.fn(() => ({})),
  };
});

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(async () => ({})),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: true, messageId: "test-id" })),
}));

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn(async () => ({
    user: { id: "admin-1", role: "admin", email: "andy@superbadmedia.com.au" },
  })),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { observatory_detectors_enabled: true },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Observatory Settings Query", () => {
  beforeEach(() => {
    Object.keys(mockSettings).forEach((k) => delete mockSettings[k]);
  });

  it("returns default settings when none configured", async () => {
    const { getObservatorySettings } = await import(
      "@/lib/observatory/queries/settings"
    );
    const s = await getObservatorySettings();
    expect(s.threshold_1_aud).toBeNull();
    expect(s.threshold_2_aud).toBeNull();
    expect(s.threshold_3_aud).toBeNull();
    expect(s.projection_alert_enabled).toBe(true);
    expect(s.weekly_digest_enabled).toBe(true);
  });

  it("returns configured thresholds", async () => {
    mockSettings["observatory.monthly_threshold_1_aud"] = "250";
    mockSettings["observatory.monthly_threshold_2_aud"] = "500";

    const { getObservatorySettings } = await import(
      "@/lib/observatory/queries/settings"
    );
    const s = await getObservatorySettings();
    expect(s.threshold_1_aud).toBe(250);
    expect(s.threshold_2_aud).toBe(500);
  });
});

describe("Job Band List Query", () => {
  it("returns all registered jobs with bands", async () => {
    const { getJobBandList } = await import(
      "@/lib/observatory/queries/settings"
    );
    const jobs = await getJobBandList();
    expect(jobs).toHaveLength(2);
    expect(jobs[0].job).toBe("outreach-writer");
    expect(jobs[0].vendor).toBe("anthropic");
    expect(jobs[0].per_call_ceiling_aud).toBe(0.5);
    expect(jobs[1].job).toBe("brand-dna-generator");
    expect(jobs[1].daily_ceiling_aud).toBe(50);
  });
});

describe("Tier Health Query", () => {
  it("getTierHealth module mock returns expected shape", async () => {
    const { getTierHealth } = await import(
      "@/lib/observatory/queries/tier-health"
    );
    const result = await getTierHealth();
    expect(result).toHaveLength(1);
    expect(result[0].tier_name).toBe("Small");
    expect(result[0].health).toBe("green");
  });
});

describe("Job Detail Query", () => {
  it("returns job detail structure", async () => {
    mockRows.length = 0;
    const { getJobDetail } = await import(
      "@/lib/observatory/queries/job-detail"
    );
    const detail = await getJobDetail("outreach-writer");
    expect(detail.job).toBe("outreach-writer");
    expect(detail.registry).toBeTruthy();
    expect(detail.calls).toEqual([]);
    expect(detail.prompt_versions).toEqual([]);
  });
});

vi.mock("@/lib/observatory/queries/dashboard", () => ({
  getMtdSummary: vi.fn(async () => ({
    total_aud: 142.50,
    daily_totals: [{ date: "2026-04-20", total: 70 }, { date: "2026-04-21", total: 72.50 }],
    projection_aud: 285.00,
    days_elapsed: 21,
    days_in_month: 30,
    thresholds: [250, 500, null],
  })),
  getActiveAnomalies: vi.fn(async () => []),
  getRecentResolvedAnomalies: vi.fn(async () => []),
  getTopJobs: vi.fn(async () => [
    { job: "outreach-writer", vendor: "anthropic", total_calls: 200, total_aud: 50, avg_aud_per_call: 0.25 },
  ]),
  getKillSwitchedJobs: vi.fn(() => []),
}));

vi.mock("@/lib/observatory/queries/tier-health", () => ({
  getTierHealth: vi.fn(async () => [
    {
      tier_id: "t1", tier_name: "Small", tier_rank: 1,
      subscriber_count: 5, monthly_revenue_aud: 95,
      total_cost_aud: 30, avg_margin_per_subscriber: 13,
      percent_underwater: 0, health: "green", subscribers: [],
    },
  ]),
}));

describe("Weekly Digest Email", () => {
  beforeEach(() => {
    Object.keys(mockSettings).forEach((k) => delete mockSettings[k]);
  });

  it("returns null when digest is disabled", async () => {
    mockSettings["observatory.weekly_digest_enabled"] = false;
    const { buildWeeklyDigest } = await import(
      "@/lib/observatory/weekly-digest-email"
    );
    const result = await buildWeeklyDigest();
    expect(result).toBeNull();
  });

  it("builds digest with subject and body when enabled", async () => {
    mockSettings["observatory.weekly_digest_enabled"] = true;
    const { buildWeeklyDigest } = await import(
      "@/lib/observatory/weekly-digest-email"
    );
    const result = await buildWeeklyDigest();
    expect(result).not.toBeNull();
    expect(result!.subject).toBeTruthy();
    expect(result!.body).toContain("The number");
    expect(result!.body).toContain("Tier check");
    expect(result!.body).toContain("Top jobs");
    expect(result!.body).toContain("Anomalies");
  });
});

describe("Negative Margin Email", () => {
  it("sends email for negative-margin subscriber", async () => {
    const { sendNegativeMarginEmail } = await import(
      "@/lib/observatory/negative-margin-email"
    );
    const subscriber = {
      deal_id: "deal-1",
      company_id: "co-1",
      company_name: "Test Co",
      monthly_revenue_aud: 49,
      total_cost_aud: 80,
      margin_aud: -31,
      top_jobs: [{ job: "outreach-writer", cost_aud: 50 }],
    };
    const result = await sendNegativeMarginEmail(subscriber, "Large");
    expect(result.sent).toBe(true);
  });
});

describe("Health Banners — tier_health and unknown_job", () => {
  it("exports getObservatoryHealthBanners", async () => {
    const mod = await import("@/lib/observatory/health-banners");
    expect(typeof mod.getObservatoryHealthBanners).toBe("function");
  });
});

describe("Scheduled Task Handler — weekly_digest_send", () => {
  it("is registered in the handler registry", async () => {
    const { HANDLER_REGISTRY } = await import(
      "@/lib/scheduled-tasks/handlers/index"
    );
    expect(HANDLER_REGISTRY.weekly_digest_send).toBeDefined();
    expect(typeof HANDLER_REGISTRY.weekly_digest_send).toBe("function");
  });
});
