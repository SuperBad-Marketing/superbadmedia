import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mockInsert,
    })),
  },
}));

vi.mock("@/lib/db/schema/external-call-log", () => ({
  external_call_log: {},
}));

// Mocked fetch — controlled per test
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Imports (after mocks) ───────────────────────────────────────────

import { searchMetaAdLibrary } from "@/lib/lead-gen/sources/meta-ad-library";
import { searchGoogleMaps } from "@/lib/lead-gen/sources/google-maps";
import { searchGoogleAdsTransparency } from "@/lib/lead-gen/sources/google-ads-transparency";
import type {
  DiscoverySearchInput,
  ViabilityProfile,
} from "@/lib/lead-gen/types";

// ── Helpers ─────────────────────────────────────────────────────────

function makeInput(overrides: Partial<DiscoverySearchInput> = {}): DiscoverySearchInput {
  return {
    locationCentre: "Melbourne, Australia",
    locationRadiusKm: 25,
    category: "cafes",
    maxResults: 5,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number): Response {
  return new Response("Internal Server Error", { status });
}

// ── ViabilityProfile type structure ─────────────────────────────────

describe("ViabilityProfile type completeness", () => {
  it("can construct a full ViabilityProfile with all optional fields", () => {
    const profile: ViabilityProfile = {
      meta_ads: {
        active_ad_count: 5,
        estimated_spend_bracket: "medium",
        has_active_creatives: true,
      },
      google_ads: {
        active_creative_count: 3,
        has_active_campaigns: true,
      },
      website: {
        domain_age_years: 4,
        pagespeed_performance_score: 85,
        has_about_page: true,
        has_pricing_page: false,
        team_size_signal: "small",
        stated_pricing_tier: "mid",
      },
      instagram: {
        follower_count: 1200,
        post_count: 80,
        posts_last_30d: 6,
      },
      youtube: {
        subscriber_count: 500,
        video_count: 30,
        uploads_last_90d: 4,
      },
      maps: {
        category: "Cafe",
        rating: 4.5,
        review_count: 230,
        photo_count: 45,
        last_photo_date: "2026-03-01",
      },
      fetch_errors: { instagram: "rate limited" },
    };
    expect(profile.meta_ads?.estimated_spend_bracket).toBe("medium");
    expect(profile.maps?.rating).toBe(4.5);
    expect(profile.fetch_errors?.instagram).toBe("rate limited");
  });

  it("accepts a fully empty ViabilityProfile", () => {
    const profile: ViabilityProfile = {};
    expect(profile.meta_ads).toBeUndefined();
    expect(profile.google_ads).toBeUndefined();
  });
});

// ── Meta Ad Library adapter ──────────────────────────────────────────

describe("searchMetaAdLibrary", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockClear();
  });

  it("returns candidates with meta_ads profile on happy path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            page_name: "Café Nero Melbourne",
            page_id: "123",
            spend: { lower_bound: "200", upper_bound: "500", currency: "AUD" },
          },
          {
            page_name: "Fitzroy Coffee Co",
            page_id: "456",
            spend: { lower_bound: "50", upper_bound: "100", currency: "AUD" },
          },
        ],
      }),
    );

    const result = await searchMetaAdLibrary(makeInput(), "test-token");

    expect(result.source).toBe("meta_ad_library");
    expect(result.candidates).toHaveLength(2);
    expect(result.fetchError).toBeUndefined();

    const first = result.candidates[0];
    expect(first.businessName).toBe("Café Nero Melbourne");
    expect(first.source).toBe("meta_ad_library");
    expect(first.partialProfile.meta_ads).toBeDefined();
    expect(first.partialProfile.meta_ads?.has_active_creatives).toBe(true);
    expect(first.partialProfile.meta_ads?.estimated_spend_bracket).toBe("medium");

    const second = result.candidates[1];
    expect(second.partialProfile.meta_ads?.estimated_spend_bracket).toBe("low");
  });

  it("respects maxResults cap", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: Array.from({ length: 10 }, (_, i) => ({
          page_name: `Business ${i}`,
          page_id: `${i}`,
        })),
      }),
    );

    const result = await searchMetaAdLibrary(makeInput({ maxResults: 3 }), "test-token");
    expect(result.candidates).toHaveLength(3);
  });

  it("returns empty candidates and sets fetchError on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));

    const result = await searchMetaAdLibrary(makeInput(), "test-token");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/HTTP 500/);
  });

  it("returns empty candidates and sets fetchError on API error in body", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Invalid token" } }),
    );

    const result = await searchMetaAdLibrary(makeInput(), "bad-token");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/Invalid token/);
  });

  it("returns empty candidates on network error without throwing", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await searchMetaAdLibrary(makeInput(), "test-token");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/ECONNREFUSED/);
  });

  it("returns empty candidates on empty data array", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const result = await searchMetaAdLibrary(makeInput(), "test-token");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toBeUndefined();
  });

  it("logs to external_call_log after each call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

    await searchMetaAdLibrary(makeInput(), "test-token");

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("deduplicates candidates with the same page_name", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { page_name: "Same Business", page_id: "1" },
          { page_name: "Same Business", page_id: "2" },
          { page_name: "Different Business", page_id: "3" },
        ],
      }),
    );

    const result = await searchMetaAdLibrary(makeInput(), "test-token");
    expect(result.candidates).toHaveLength(2);
    const names = result.candidates.map((c) => c.businessName);
    expect(names).toContain("Same Business");
    expect(names).toContain("Different Business");
  });
});

// ── Google Maps adapter ──────────────────────────────────────────────

describe("searchGoogleMaps", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockClear();
  });

  it("returns candidates with maps profile on happy path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        local_results: [
          {
            title: "Brother Espresso",
            website: "https://www.brotherespresso.com.au",
            phone: "+61 3 9999 0000",
            address: "123 Smith St, Fitzroy",
            rating: 4.7,
            reviews: 420,
            type: "Cafe",
            photos_count: 55,
          },
          {
            title: "Proud Mary",
            website: "https://www.proudmarycoffee.com.au",
            address: "172 Oxford St, Collingwood",
            rating: 4.8,
            reviews: 890,
            type: "Cafe",
            photos_count: 120,
          },
        ],
      }),
    );

    const result = await searchGoogleMaps(makeInput(), "test-serp-key");

    expect(result.source).toBe("google_maps");
    expect(result.candidates).toHaveLength(2);
    expect(result.fetchError).toBeUndefined();

    const first = result.candidates[0];
    expect(first.businessName).toBe("Brother Espresso");
    expect(first.source).toBe("google_maps");
    expect(first.domain).toBe("brotherespresso.com.au");
    expect(first.phone).toBe("+61 3 9999 0000");
    expect(first.partialProfile.maps).toBeDefined();
    expect(first.partialProfile.maps?.rating).toBe(4.7);
    expect(first.partialProfile.maps?.review_count).toBe(420);
    expect(first.partialProfile.maps?.photo_count).toBe(55);
    expect(first.partialProfile.maps?.category).toBe("Cafe");
  });

  it("sets maps.last_photo_date from user_reviews when available", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        local_results: [
          {
            title: "Test Cafe",
            rating: 4.0,
            reviews: 10,
            photos_count: 5,
            user_reviews: [
              { rating: 5, date: "2026-03-15" },
              { rating: 4, date: "2026-02-01" },
            ],
          },
        ],
      }),
    );

    const result = await searchGoogleMaps(makeInput({ maxResults: 1 }), "test-serp-key");
    expect(result.candidates[0].partialProfile.maps?.last_photo_date).toBe("2026-03-15");
  });

  it("returns empty candidates and sets fetchError on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403));

    const result = await searchGoogleMaps(makeInput(), "test-serp-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/HTTP 403/);
  });

  it("returns empty candidates on API error in body", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "Invalid API key" }),
    );

    const result = await searchGoogleMaps(makeInput(), "bad-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/Invalid API key/);
  });

  it("returns empty candidates on network error without throwing", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    const result = await searchGoogleMaps(makeInput(), "test-serp-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/timeout/);
  });

  it("returns empty candidates on empty local_results", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ local_results: [] }));

    const result = await searchGoogleMaps(makeInput(), "test-serp-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toBeUndefined();
  });

  it("logs to external_call_log after each call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ local_results: [] }));

    await searchGoogleMaps(makeInput(), "test-serp-key");

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("respects maxResults cap", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        local_results: Array.from({ length: 10 }, (_, i) => ({
          title: `Place ${i}`,
          rating: 4.0,
          reviews: 10,
          photos_count: 2,
        })),
      }),
    );

    const result = await searchGoogleMaps(makeInput({ maxResults: 2 }), "test-serp-key");
    expect(result.candidates).toHaveLength(2);
  });
});

// ── Google Ads Transparency adapter ─────────────────────────────────

describe("searchGoogleAdsTransparency", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockInsert.mockClear();
  });

  it("returns candidates with google_ads profile on happy path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ads_transparency_results: [
          {
            advertiser_name: "Acme Marketing Pty Ltd",
            advertiser_id: "AR-001",
            location: "Melbourne, VIC",
            domains: ["https://acmemarketing.com.au"],
            number_of_ads: 12,
          },
          {
            advertiser_name: "Local Dental Group",
            advertiser_id: "AR-002",
            domains: ["https://www.localdentalgroup.com.au"],
            number_of_ads: 3,
          },
        ],
      }),
    );

    const result = await searchGoogleAdsTransparency(makeInput(), "test-serp-key");

    expect(result.source).toBe("google_ads_transparency");
    expect(result.candidates).toHaveLength(2);
    expect(result.fetchError).toBeUndefined();

    const first = result.candidates[0];
    expect(first.businessName).toBe("Acme Marketing Pty Ltd");
    expect(first.source).toBe("google_ads_transparency");
    expect(first.domain).toBe("acmemarketing.com.au");
    expect(first.location).toBe("Melbourne, VIC");
    expect(first.partialProfile.google_ads).toBeDefined();
    expect(first.partialProfile.google_ads?.active_creative_count).toBe(12);
    expect(first.partialProfile.google_ads?.has_active_campaigns).toBe(true);

    const second = result.candidates[1];
    expect(second.domain).toBe("localdentalgroup.com.au");
    expect(second.partialProfile.google_ads?.active_creative_count).toBe(3);
  });

  it("marks has_active_campaigns false when number_of_ads is 0", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ads_transparency_results: [
          {
            advertiser_name: "Inactive Advertiser",
            number_of_ads: 0,
          },
        ],
      }),
    );

    const result = await searchGoogleAdsTransparency(makeInput({ maxResults: 1 }), "test-serp-key");
    expect(result.candidates[0].partialProfile.google_ads?.has_active_campaigns).toBe(false);
  });

  it("returns empty candidates and sets fetchError on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(503));

    const result = await searchGoogleAdsTransparency(makeInput(), "test-serp-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/HTTP 503/);
  });

  it("returns empty candidates on API error in body", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "Quota exceeded" }),
    );

    const result = await searchGoogleAdsTransparency(makeInput(), "bad-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/Quota exceeded/);
  });

  it("returns empty candidates on network error without throwing", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await searchGoogleAdsTransparency(makeInput(), "test-serp-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toMatch(/ENOENT/);
  });

  it("returns empty candidates on empty results without throwing", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ads_transparency_results: [] }));

    const result = await searchGoogleAdsTransparency(makeInput(), "test-serp-key");

    expect(result.candidates).toHaveLength(0);
    expect(result.fetchError).toBeUndefined();
  });

  it("logs to external_call_log after each call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ads_transparency_results: [] }));

    await searchGoogleAdsTransparency(makeInput(), "test-serp-key");

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("deduplicates candidates with the same advertiser_name", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ads_transparency_results: [
          { advertiser_name: "Duplicate Co", number_of_ads: 5 },
          { advertiser_name: "Duplicate Co", number_of_ads: 3 },
          { advertiser_name: "Unique Biz", number_of_ads: 1 },
        ],
      }),
    );

    const result = await searchGoogleAdsTransparency(makeInput(), "test-serp-key");
    expect(result.candidates).toHaveLength(2);
    const names = result.candidates.map((c) => c.businessName);
    expect(names).toContain("Duplicate Co");
    expect(names).toContain("Unique Biz");
  });

  it("respects maxResults cap", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ads_transparency_results: Array.from({ length: 10 }, (_, i) => ({
          advertiser_name: `Advertiser ${i}`,
          number_of_ads: 1,
        })),
      }),
    );

    const result = await searchGoogleAdsTransparency(makeInput({ maxResults: 4 }), "test-serp-key");
    expect(result.candidates).toHaveLength(4);
  });
});
