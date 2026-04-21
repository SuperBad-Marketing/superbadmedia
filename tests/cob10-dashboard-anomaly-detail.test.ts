import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => {
  const rows: unknown[] = [];
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn(() => ({
              orderBy: vi.fn(() => Promise.resolve(rows)),
            })),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(rows)),
            })),
            limit: vi.fn(() => Promise.resolve(rows)),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(rows)),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
    },
    __setRows: (r: unknown[]) => {
      rows.length = 0;
      rows.push(...r);
    },
  };
});

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      const map: Record<string, string> = {
        "observatory.monthly_threshold_1_aud": "250",
        "observatory.monthly_threshold_2_aud": "500",
        "observatory.monthly_threshold_3_aud": "1000",
      };
      return map[key] ?? null;
    }),
  },
}));

vi.mock("@/lib/observatory/job-registry", () => ({
  getJobEntry: vi.fn((key: string) => ({
    vendor: "anthropic",
    bands: {
      per_call_ceiling_aud: 0.15,
      daily_ceiling_aud: 50,
      learned_band_multiplier: 3,
      rate_override: null,
    },
    description: `Job ${key}`,
    jobDisabledUntil: null,
  })),
  REGISTERED_JOB_KEYS: ["outreach-writer", "brand-dna-generate-prose-portrait"],
  getJobBands: vi.fn(),
  getEffectiveBands: vi.fn(),
  isJobRegistered: vi.fn(() => true),
  getJobVendor: vi.fn(() => "anthropic"),
  getJobDisabledUntil: vi.fn(() => null),
  getRegisteredJobsByVendor: vi.fn(() => []),
  JOB_REGISTRY: {},
}));

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn(async () => ({ user: { id: "admin-1", role: "admin" } })),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(async () => ({
    id: "log-1",
    kind: "cost_anomaly_acknowledged",
    body: "test",
    created_at_ms: Date.now(),
  })),
}));

// ---------------------------------------------------------------------------
// Tests — query layer
// ---------------------------------------------------------------------------

describe("Observatory dashboard queries", () => {
  describe("getKillSwitchedJobs", () => {
    it("returns empty array when no jobs are disabled", async () => {
      const { getKillSwitchedJobs } = await import(
        "@/lib/observatory/queries/dashboard"
      );
      const result = getKillSwitchedJobs();
      expect(result).toEqual([]);
    });
  });

  describe("getMtdSummary", () => {
    it("returns structured MTD data with thresholds", async () => {
      const { getMtdSummary } = await import(
        "@/lib/observatory/queries/dashboard"
      );
      const result = await getMtdSummary();
      expect(result).toHaveProperty("total_aud");
      expect(result).toHaveProperty("projection_aud");
      expect(result).toHaveProperty("days_elapsed");
      expect(result).toHaveProperty("days_in_month");
      expect(result.thresholds).toEqual([250, 500, 1000]);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — anomaly detail query
// ---------------------------------------------------------------------------

describe("Anomaly detail query", () => {
  it("returns null for missing anomaly", async () => {
    const { getAnomalyDetail } = await import(
      "@/lib/observatory/queries/anomaly-detail"
    );
    const result = await getAnomalyDetail("nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — API route auth guards
// ---------------------------------------------------------------------------

describe("Dashboard API route", () => {
  it("returns 401 for non-admin", async () => {
    const { auth } = await import("@/lib/auth/session");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const mod = await import(
      "@/app/api/admin/observatory/dashboard/route"
    );
    const response = await mod.GET();
    expect(response.status).toBe(401);
  });
});

describe("Anomaly API route", () => {
  it("returns 400 for missing id", async () => {
    const mod = await import("@/app/api/admin/observatory/anomaly/route");
    const url = new URL("http://localhost/api/admin/observatory/anomaly");
    const request = new Request(url.toString(), { method: "GET" });
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(request);
    const response = await mod.GET(req);
    expect(response.status).toBe(400);
  });

  it("returns 400 for POST without action", async () => {
    const mod = await import("@/app/api/admin/observatory/anomaly/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://localhost/api/admin/observatory/anomaly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "test-1" }),
      }),
    );
    const response = await mod.POST(req);
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests — component smoke tests (type-level)
// ---------------------------------------------------------------------------

describe("Observatory component exports", () => {
  it("PlatformStatusPanel exports correctly", async () => {
    const mod = await import(
      "@/components/lite/observatory/platform-status-panel"
    );
    expect(mod.PlatformStatusPanel).toBeDefined();
  });

  it("AnomaliesPanel exports correctly", async () => {
    const mod = await import(
      "@/components/lite/observatory/anomalies-panel"
    );
    expect(mod.AnomaliesPanel).toBeDefined();
  });

  it("TopJobsPanel exports correctly", async () => {
    const mod = await import(
      "@/components/lite/observatory/top-jobs-panel"
    );
    expect(mod.TopJobsPanel).toBeDefined();
  });

  it("KillSwitchBar exports correctly", async () => {
    const mod = await import(
      "@/components/lite/observatory/kill-switch-bar"
    );
    expect(mod.KillSwitchBar).toBeDefined();
  });

  it("DiagnosisCard exports correctly", async () => {
    const mod = await import(
      "@/components/lite/observatory/diagnosis-card"
    );
    expect(mod.DiagnosisCard).toBeDefined();
  });

  it("RawDataTable exports correctly", async () => {
    const mod = await import(
      "@/components/lite/observatory/raw-data-table"
    );
    expect(mod.RawDataTable).toBeDefined();
  });

  it("AnomalyActions exports correctly", async () => {
    const mod = await import(
      "@/components/lite/observatory/anomaly-actions"
    );
    expect(mod.AnomalyActions).toBeDefined();
  });
});
