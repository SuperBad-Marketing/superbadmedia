import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiscoverySearchParams } from "@/lib/lead-gen/types";

// ── Mocks ───────────────────────────────────────────────────────────

const mockGetCredential = vi.fn();
vi.mock("@/lib/integrations/getCredential", () => ({
  getCredential: (...args: unknown[]) => mockGetCredential(...args),
}));

const mockInsertValues = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
  },
}));

vi.mock("@/lib/db/schema/external-call-log", () => ({
  external_call_log: {},
}));

vi.mock("@/lib/integrations/vendors/meta", () => ({
  META_GRAPH_API_VERSION: "v21.0",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Import after mocks ──────────────────────────────────────────────

import { searchMetaAdLibrary } from "@/lib/lead-gen/sources/meta-ad-library";

const DEFAULT_PARAMS: DiscoverySearchParams = {
  category: "cafes",
  location: "Melbourne, Australia",
  radius_km: 25,
  brief: "cafes with good marketing potential",
  max_candidates: 8,
};

// Source disabled until Meta app review grants ads_read permission.
describe.skip("searchMetaAdLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
  });

  it("returns empty with error when no credential", async () => {
    mockGetCredential.mockResolvedValue(null);

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("credential not found");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("maps API results to DiscoveredCandidate shape", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            page_id: "123",
            page_name: "Best Brew Café",
            ad_delivery_start_time: "2026-01-15",
            ad_creative_link_captions: ["bestbrew.com.au"],
            estimated_audience_size: { lower_bound: 10000, upper_bound: 50000 },
          },
          {
            page_id: "456",
            page_name: "Little Bean Coffee",
            ad_creative_link_captions: ["littlebean.com.au/menu"],
          },
        ],
      }),
    });

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(2);
    expect(result.error).toBeUndefined();

    const first = result.candidates[0];
    expect(first.company_name).toBe("Best Brew Café");
    expect(first.domain).toBe("bestbrew.com.au");
    expect(first.source).toBe("meta_ad_library");
    expect(first.partial_profile.meta_ads?.has_active_creatives).toBe(true);
    expect(first.partial_profile.meta_ads?.estimated_spend_bracket).toBe(
      "medium",
    );

    const second = result.candidates[1];
    expect(second.domain).toBe("littlebean.com.au");
    expect(second.partial_profile.meta_ads?.estimated_spend_bracket).toBe(
      "unknown",
    );
  });

  it("deduplicates by page_id within results", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { page_id: "123", page_name: "Acme", ad_creative_link_captions: [] },
          { page_id: "123", page_name: "Acme", ad_creative_link_captions: [] },
          { page_id: "456", page_name: "Beta", ad_creative_link_captions: [] },
        ],
      }),
    });

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(2);
  });

  it("classifies spend brackets correctly", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            page_id: "1",
            page_name: "Low",
            ad_creative_link_captions: [],
            estimated_audience_size: { lower_bound: 100, upper_bound: 2000 },
          },
          {
            page_id: "2",
            page_name: "Medium",
            ad_creative_link_captions: [],
            estimated_audience_size: { lower_bound: 5000, upper_bound: 40000 },
          },
          {
            page_id: "3",
            page_name: "High",
            ad_creative_link_captions: [],
            estimated_audience_size: {
              lower_bound: 60000,
              upper_bound: 200000,
            },
          },
        ],
      }),
    });

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);
    expect(result.candidates[0].partial_profile.meta_ads?.estimated_spend_bracket).toBe("low");
    expect(result.candidates[1].partial_profile.meta_ads?.estimated_spend_bracket).toBe("medium");
    expect(result.candidates[2].partial_profile.meta_ads?.estimated_spend_bracket).toBe("high");
  });

  it("handles API error responses gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        error: { message: "Invalid token", type: "OAuthException", code: 190 },
      }),
    });

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("Invalid token");
  });

  it("handles HTTP error responses gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server Error",
    });

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("500");
  });

  it("handles network errors gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockRejectedValue(new Error("Network timeout"));

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("Network timeout");
  });

  it("extracts domain from creative link captions", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            page_id: "1",
            page_name: "Test Biz",
            ad_creative_link_captions: [
              "https://www.testbiz.com.au/landing",
            ],
          },
        ],
      }),
    });

    const result = await searchMetaAdLibrary(DEFAULT_PARAMS);
    expect(result.candidates[0].domain).toBe("testbiz.com.au");
  });

  it("logs external call to external_call_log", async () => {
    mockGetCredential.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await searchMetaAdLibrary(DEFAULT_PARAMS);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    const logged = mockInsertValues.mock.calls[0][0];
    expect(logged.job).toBe("meta.ad_library.search");
    expect(logged.actor_type).toBe("internal");
  });
});
