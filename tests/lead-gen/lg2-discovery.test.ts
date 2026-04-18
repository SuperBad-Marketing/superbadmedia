import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DiscoveredCandidate,
  DiscoverySearchParams,
} from "@/lib/lead-gen/types";

// ── Mocks ───────────────────────────────────────────────────────────

const mockSearchMetaAdLibrary = vi.fn();
const mockSearchGoogleMaps = vi.fn();
const mockSearchGoogleAdsTransparency = vi.fn();

vi.mock("@/lib/lead-gen/sources/meta-ad-library", () => ({
  searchMetaAdLibrary: (...args: unknown[]) =>
    mockSearchMetaAdLibrary(...args),
}));

vi.mock("@/lib/lead-gen/sources/google-maps", () => ({
  searchGoogleMaps: (...args: unknown[]) => mockSearchGoogleMaps(...args),
}));

vi.mock("@/lib/lead-gen/sources/google-ads-transparency", () => ({
  searchGoogleAdsTransparency: (...args: unknown[]) =>
    mockSearchGoogleAdsTransparency(...args),
}));

// ── Import after mocks ──────────────────────────────────────────────

import { runDiscovery } from "@/lib/lead-gen/discovery";

const DEFAULT_PARAMS: DiscoverySearchParams = {
  category: "cafes",
  location: "Melbourne, Australia",
  radius_km: 25,
  brief: "cafes with good marketing potential",
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
    mockSearchMetaAdLibrary.mockResolvedValue({
      candidates: [makeCandidate("Meta Biz", "meta.com.au", "meta_ad_library")],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [makeCandidate("Maps Biz", "maps.com.au", "google_maps")],
    });
    mockSearchGoogleAdsTransparency.mockResolvedValue({
      candidates: [
        makeCandidate("Ads Biz", "ads.com.au", "google_ads_transparency"),
      ],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(3);
    expect(result.total_found_before_dedup).toBe(3);
    expect(result.dedup_removed).toBe(0);
  });

  it("deduplicates by domain (case-insensitive)", async () => {
    mockSearchMetaAdLibrary.mockResolvedValue({
      candidates: [
        makeCandidate("Acme (Meta)", "acme.com.au", "meta_ad_library"),
      ],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [
        makeCandidate("Acme (Maps)", "ACME.COM.AU", "google_maps"),
      ],
    });
    mockSearchGoogleAdsTransparency.mockResolvedValue({
      candidates: [],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].company_name).toBe("Acme (Meta)"); // Meta wins priority
    expect(result.dedup_removed).toBe(1);
  });

  it("preserves priority order: Meta > Transparency > Maps", async () => {
    mockSearchMetaAdLibrary.mockResolvedValue({
      candidates: [
        makeCandidate("Meta Biz", "shared.com.au", "meta_ad_library"),
      ],
    });
    mockSearchGoogleAdsTransparency.mockResolvedValue({
      candidates: [
        makeCandidate("Ads Biz", "shared.com.au", "google_ads_transparency"),
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
    mockSearchMetaAdLibrary.mockResolvedValue({ candidates: [] });
    mockSearchGoogleAdsTransparency.mockResolvedValue({ candidates: [] });
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
    mockSearchMetaAdLibrary.mockRejectedValue(new Error("Meta API down"));
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [makeCandidate("Maps Biz", "maps.com.au", "google_maps")],
    });
    mockSearchGoogleAdsTransparency.mockResolvedValue({
      candidates: [
        makeCandidate("Ads Biz", "ads.com.au", "google_ads_transparency"),
      ],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    // Two sources survived
    expect(result.candidates).toHaveLength(2);

    // Failed source is captured in source_results
    const metaSource = result.source_results.find(
      (s) => s.source === "meta_ad_library",
    );
    expect(metaSource?.error).toContain("Meta API down");
    expect(metaSource?.candidates).toHaveLength(0);
  });

  it("continues when all sources fail", async () => {
    mockSearchMetaAdLibrary.mockRejectedValue(new Error("fail 1"));
    mockSearchGoogleMaps.mockRejectedValue(new Error("fail 2"));
    mockSearchGoogleAdsTransparency.mockRejectedValue(new Error("fail 3"));

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(0);
    expect(result.source_results).toHaveLength(3);
    expect(result.source_results.every((s) => s.error)).toBe(true);
  });

  it("captures per-source errors when source returns error string", async () => {
    mockSearchMetaAdLibrary.mockResolvedValue({
      candidates: [],
      error: "credential not found",
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [makeCandidate("Biz", "biz.com", "google_maps")],
    });
    mockSearchGoogleAdsTransparency.mockResolvedValue({
      candidates: [],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.candidates).toHaveLength(1);
    const metaSource = result.source_results.find(
      (s) => s.source === "meta_ad_library",
    );
    expect(metaSource?.error).toBe("credential not found");
  });

  it("reports correct total_found_before_dedup and dedup_removed", async () => {
    mockSearchMetaAdLibrary.mockResolvedValue({
      candidates: [
        makeCandidate("A", "shared.com", "meta_ad_library"),
        makeCandidate("B", "unique-meta.com", "meta_ad_library"),
      ],
    });
    mockSearchGoogleMaps.mockResolvedValue({
      candidates: [
        makeCandidate("C", "shared.com", "google_maps"), // dupe
        makeCandidate("D", "unique-maps.com", "google_maps"),
        makeCandidate("E", null, "google_maps"), // no domain
      ],
    });
    mockSearchGoogleAdsTransparency.mockResolvedValue({
      candidates: [
        makeCandidate("F", "shared.com", "google_ads_transparency"), // dupe
      ],
    });

    const result = await runDiscovery(DEFAULT_PARAMS);

    expect(result.total_found_before_dedup).toBe(6);
    expect(result.dedup_removed).toBe(2); // Two "shared.com" dupes removed
    expect(result.candidates).toHaveLength(4); // A, B, D, E
  });
});
