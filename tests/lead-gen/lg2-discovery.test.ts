import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DiscoveredCandidate,
  DiscoverySearchParams,
} from "@/lib/lead-gen/types";

// ── Mocks ───────────────────────────────────────────────────────────

const mockSearchMetaAdLibraryApify = vi.fn();
const mockSearchInstagramLocation = vi.fn();
const mockSearchGoogleMaps = vi.fn();

vi.mock("@/lib/lead-gen/sources/apify-meta-ad-library", () => ({
  searchMetaAdLibraryApify: (...args: unknown[]) =>
    mockSearchMetaAdLibraryApify(...args),
}));

vi.mock("@/lib/lead-gen/sources/apify-instagram-location", () => ({
  searchInstagramLocation: (...args: unknown[]) =>
    mockSearchInstagramLocation(...args),
}));

vi.mock("@/lib/lead-gen/sources/google-maps", () => ({
  searchGoogleMaps: (...args: unknown[]) => mockSearchGoogleMaps(...args),
}));

// ── Import after mocks ──────────────────────────────────────────────

import { runDiscovery } from "@/lib/lead-gen/discovery";

const DEFAULT_PARAMS: DiscoverySearchParams = {
  location: "Melbourne, Australia",
  radius_km: 25,
  location_lat: -37.8136,
  location_lng: 144.9631,
  country_code: "AU",
  brief: "businesses with good marketing potential",
  max_candidates: 8,
};

function makeCandidate(
  name: string,
  domain: string | null,
  source: DiscoveredCandidate["source"],
): DiscoveredCandidate {
  return {
    company_name: name,
    domain,
    source,
    partial_profile: {},
  };
}

describe("runDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("combines candidates from all three sources", async () => {
    mockSearchMetaAdLibraryApify.mockResolvedValue({
      candidates: [makeCandidate("Meta Biz", "meta.com.au", "meta_ad_library")],
    });
    mockSearchInstagramLocation.mockResolvedValue({
      candidates: [makeCandidate("IG Biz", "ig.com.au", "instagram_location")],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [makeCandidate("Maps Biz", "maps.com.au", "google_maps")],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(3);
    expect(result.total_found_before_dedup).toBe(3);
    expect(result.dedup_removed).toBe(0);
  });

  it("deduplicates by domain (case-insensitive)", async () => {
    mockSearchMetaAdLibraryApify.mockResolvedValue({
      candidates: [
        makeCandidate("Acme (Meta)", "acme.com.au", "meta_ad_library"),
      ],
    });
    mockSearchInstagramLocation.mockResolvedValue({
      candidates: [
        makeCandidate("Acme (IG)", "ACME.COM.AU", "instagram_location"),
      ],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].company_name).toBe("Acme (Meta)");
    expect(result.dedup_removed).toBe(1);
  });

  it("preserves priority order: Meta > Instagram > Maps", async () => {
    mockSearchMetaAdLibraryApify.mockResolvedValue({
      candidates: [
        makeCandidate("Meta Biz", "shared.com.au", "meta_ad_library"),
      ],
    });
    mockSearchInstagramLocation.mockResolvedValue({
      candidates: [
        makeCandidate("IG Biz", "shared.com.au", "instagram_location"),
      ],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [
        makeCandidate("Maps Biz", "shared.com.au", "google_maps"),
      ],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].source).toBe("meta_ad_library");
  });

  it("does not dedup candidates without domains", async () => {
    mockSearchMetaAdLibraryApify.mockResolvedValue({ candidates: [] });
    mockSearchInstagramLocation.mockResolvedValue({ candidates: [] });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [
        makeCandidate("No Web A", null, "google_maps"),
        makeCandidate("No Web B", null, "google_maps"),
      ],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(2);
    expect(result.dedup_removed).toBe(0);
  });

  it("continues when one source fails", async () => {
    mockSearchMetaAdLibraryApify.mockRejectedValue(new Error("Meta API down"));
    mockSearchInstagramLocation.mockResolvedValue({
      candidates: [makeCandidate("IG Biz", "ig.com.au", "instagram_location")],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [makeCandidate("Maps Biz", "maps.com.au", "google_maps")],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(2);

    const metaSource = result.source_results.find(
      (s) => s.source === "meta_ad_library",
    );
    expect(metaSource?.error).toContain("Meta API down");
    expect(metaSource?.candidates).toHaveLength(0);
  });

  it("continues when all sources fail", async () => {
    mockSearchMetaAdLibraryApify.mockRejectedValue(new Error("fail 1"));
    mockSearchInstagramLocation.mockRejectedValue(new Error("fail 2"));
    mockSearchGoogleMaps.mockRejectedValue(new Error("fail 3"));

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(0);
    expect(result.source_results).toHaveLength(3);
    expect(result.source_results.every((s) => s.error)).toBe(true);
  });

  it("captures per-source errors when source returns error string", async () => {
    mockSearchMetaAdLibraryApify.mockResolvedValue({
      candidates: [],
      error: "credential not found",
    });
    mockSearchInstagramLocation.mockResolvedValue({
      candidates: [],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [makeCandidate("Biz", "biz.com", "google_maps")],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(1);
    const metaSource = result.source_results.find(
      (s) => s.source === "meta_ad_library",
    );
    expect(metaSource?.error).toBe("credential not found");
  });

  it("reports correct total_found_before_dedup and dedup_removed", async () => {
    mockSearchMetaAdLibraryApify.mockResolvedValue({
      candidates: [
        makeCandidate("A", "shared.com", "meta_ad_library"),
        makeCandidate("B", "unique-meta.com", "meta_ad_library"),
      ],
    });
    mockSearchInstagramLocation.mockResolvedValue({
      candidates: [
        makeCandidate("C", "shared.com", "instagram_location"), // dupe
        makeCandidate("D", "unique-ig.com", "instagram_location"),
      ],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [
        makeCandidate("E", "shared.com", "google_maps"), // dupe
        makeCandidate("F", null, "google_maps"), // no domain
      ],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.total_found_before_dedup).toBe(6);
    expect(result.dedup_removed).toBe(2);
    expect(result.candidates).toHaveLength(4); // A, B, D, F
  });
});
