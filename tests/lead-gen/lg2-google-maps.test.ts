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

import { searchGoogleMaps } from "@/lib/lead-gen/sources/google-maps";

const DEFAULT_PARAMS: DiscoverySearchParams = {
  category: "cafes",
  location: "Melbourne, Australia",
  radius_km: 25,
  location_lat: -37.8136,
  location_lng: 144.9631,
  country_code: "AU",
  brief: "cafes with good marketing potential",
  max_candidates: 8,
};

describe("searchGoogleMaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
  });

  it("returns empty with error when no credential", async () => {
    mockGetCredential.mockResolvedValue(null);

    const result = await searchGoogleMaps(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("credential not found");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("maps API results to DiscoveredCandidate shape", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        local_results: [
          {
            position: 1,
            title: "Seven Seeds Coffee",
            place_id: "ChIJ_abc123",
            address: "114 Berkeley St, Carlton VIC 3053",
            rating: 4.6,
            reviews: 892,
            type: "Coffee shop",
            website: "https://www.sevenseeds.com.au",
            photos_count: 45,
          },
          {
            position: 2,
            title: "Corner Barber",
            place_id: "ChIJ_def456",
            address: "22 Smith St, Fitzroy VIC 3065",
            rating: 4.9,
            reviews: 134,
            types: ["Barber shop", "Hair salon"],
            // No website
          },
        ],
      }),
    });

    const result = await searchGoogleMaps(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(2);
    expect(result.error).toBeUndefined();

    const first = result.candidates[0];
    expect(first.company_name).toBe("Seven Seeds Coffee");
    expect(first.domain).toBe("sevenseeds.com.au");
    expect(first.source).toBe("google_maps");
    expect(first.partial_profile.maps?.rating).toBe(4.6);
    expect(first.partial_profile.maps?.review_count).toBe(892);
    expect(first.partial_profile.maps?.category).toBe("Coffee shop");
    expect(first.partial_profile.maps?.photo_count).toBe(45);

    const second = result.candidates[1];
    expect(second.domain).toBeNull();
    expect(second.partial_profile.maps?.category).toBe("Barber shop");
    expect(second.raw_source_data?.place_id).toBe("ChIJ_def456");
  });

  it("passes location and ll coordinates to SerpAPI query", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ local_results: [] }),
    });

    await searchGoogleMaps(DEFAULT_PARAMS);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("engine=google_maps");
    expect(calledUrl).toContain("cafes");
    expect(calledUrl).toContain("Melbourne");
    expect(calledUrl).toContain("ll=%40-37.8136%2C144.9631%2C12z");
  });

  it("filters out results outside radius", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        local_results: [
          {
            position: 1,
            title: "Melbourne Cafe",
            gps_coordinates: { latitude: -37.82, longitude: 144.97 },
          },
          {
            position: 2,
            title: "Florida Cafe",
            gps_coordinates: { latitude: 28.08, longitude: -80.60 },
          },
        ],
      }),
    });

    const result = await searchGoogleMaps(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].company_name).toBe("Melbourne Cafe");
  });

  it("handles API errors gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        error: "Invalid API key",
      }),
    });

    const result = await searchGoogleMaps(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("Invalid API key");
  });

  it("handles network errors gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockRejectedValue(new Error("DNS resolution failed"));

    const result = await searchGoogleMaps(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain("DNS resolution failed");
  });

  it("handles missing local_results gracefully", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ search_metadata: { status: "Success" } }),
    });

    const result = await searchGoogleMaps(DEFAULT_PARAMS);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("logs external call to external_call_log", async () => {
    mockGetCredential.mockResolvedValue("test-key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        local_results: [
          { position: 1, title: "Test", rating: 4.0, reviews: 10 },
        ],
      }),
    });

    await searchGoogleMaps(DEFAULT_PARAMS);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    const logged = mockInsertValues.mock.calls[0][0];
    expect(logged.job).toBe("serpapi.google_maps");
    expect(logged.estimated_cost_aud).toBe(0.005);
  });
});
