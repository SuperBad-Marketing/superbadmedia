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

vi.mock("@/lib/integrations/vendors/serpapi", () => ({
  SERPAPI_API_BASE: "https://serpapi.com",
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Import after mocks ──────────────────────────────────────────────

import { searchGoogleAdsTransparency } from "@/lib/lead-gen/sources/google-ads-transparency";

const DEFAULT_PARAMS: DiscoverySearchParams = {
  category: "cafes",
  location: "Melbourne, Australia",
  radius_km: 25,
  brief: "cafes with good marketing potential",
  max_candidates: 8,
};

// Source stubbed — SerpAPI does not support google_ads_transparencycenter.
describe.skip("searchGoogleAdsTransparency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
  });

  it("returns empty with error when no credential", async () => {
    mockGetCredential.mockResolvedValue(null);

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("credential not found");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("maps advertiser_results to DiscoveredCandidate shape", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        advertiser_results: [
          {
            advertiser_name: "Melbourne Dental Group",
            advertiser_id: "AR_123456",
            domain: "melbournedental.com.au",
            ads_count: 8,
            region: "AU",
          },
          {
            advertiser_name: "City Fitness Hub",
            advertiser_id: "AR_789012",
            domain: "https://www.cityfitness.com.au/",
            ads_count: 3,
            region: "AU",
          },
        ],
      }),
    });

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(2);
    expect(result.error).toBeUndefined();

    const first = result.candidates[0];
    expect(first.company_name).toBe("Melbourne Dental Group");
    expect(first.domain).toBe("melbournedental.com.au");
    expect(first.source).toBe("google_ads_transparency");
    expect(first.partial_profile.google_ads?.active_creative_count).toBe(8);
    expect(first.partial_profile.google_ads?.has_active_campaigns).toBe(true);

    const second = result.candidates[1];
    expect(second.domain).toBe("cityfitness.com.au"); // URL normalised
  });

  it("deduplicates by advertiser_id", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        advertiser_results: [
          { advertiser_name: "Acme", advertiser_id: "AR_111" },
          { advertiser_name: "Acme (duplicate)", advertiser_id: "AR_111" },
          { advertiser_name: "Beta", advertiser_id: "AR_222" },
        ],
      }),
    });

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].company_name).toBe("Acme");
    expect(result.candidates[1].company_name).toBe("Beta");
  });

  it("falls back to ads_results when advertiser_results absent", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ads_results: [
          {
            advertiser_name: "Fallback Biz",
            advertiser_id: "AR_333",
            ads_count: 2,
          },
        ],
      }),
    });

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].company_name).toBe("Fallback Biz");
  });

  it("handles API errors gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ error: "Rate limit exceeded" }),
    });

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("Rate limit exceeded");
  });

  it("handles HTTP error responses gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("429");
  });

  it("handles network errors gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockRejectedValue(new Error("Connection reset"));

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("Connection reset");
  });

  it("normalises domain from various formats", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        advertiser_results: [
          {
            advertiser_name: "A",
            advertiser_id: "1",
            domain: "https://www.example.com/path",
          },
          {
            advertiser_name: "B",
            advertiser_id: "2",
            domain: "bare-domain.com.au",
          },
          {
            advertiser_name: "C",
            advertiser_id: "3",
            // No domain
          },
        ],
      }),
    });

    const result = await searchGoogleAdsTransparency(DEFAULT_PARAMS);
    expect(result.candidates[0].domain).toBe("example.com");
    expect(result.candidates[1].domain).toBe("bare-domain.com.au");
    expect(result.candidates[2].domain).toBeNull();
  });

  it("uses category as search text, region AU", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ advertiser_results: [] }),
    });

    await searchGoogleAdsTransparency(DEFAULT_PARAMS);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("engine=google_ads_transparencycenter");
    expect(calledUrl).toContain("text=cafes");
    expect(calledUrl).toContain("region=AU");
  });

  it("logs external call to external_call_log", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ advertiser_results: [] }),
    });

    await searchGoogleAdsTransparency(DEFAULT_PARAMS);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    const logged = mockInsertValues.mock.calls[0][0];
    expect(logged.job).toBe("serpapi.google_ads_transparency");
  });
});
