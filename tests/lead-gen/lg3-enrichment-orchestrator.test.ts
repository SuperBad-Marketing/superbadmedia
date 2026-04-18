import { describe, it, expect, vi } from "vitest";
import type { DiscoveredCandidate } from "@/lib/lead-gen/types";

// Mock all external fetchers so the orchestrator test doesn't hit real APIs
vi.mock("@/lib/lead-gen/enrich/pagespeed", () => ({
  fetchPageSpeed: vi.fn().mockResolvedValue({ performance_score: 72 }),
  applyPageSpeedToProfile: vi.fn((profile, result) => ({
    ...profile,
    website: {
      ...profile.website,
      pagespeed_performance_score: result.performance_score,
    },
  })),
}));

vi.mock("@/lib/lead-gen/enrich/whois", () => ({
  fetchWhois: vi.fn().mockResolvedValue({
    domain_age_years: 5.3,
    registration_date: "2021-01-01T00:00:00Z",
  }),
  applyWhoisToProfile: vi.fn((profile, result) => ({
    ...profile,
    website: { ...profile.website, domain_age_years: result.domain_age_years },
  })),
}));

vi.mock("@/lib/lead-gen/enrich/instagram", () => ({
  fetchInstagram: vi.fn().mockResolvedValue({
    follower_count: 2500,
    post_count: 100,
    posts_last_30d: 5,
    username: "acmecafe",
  }),
  applyInstagramToProfile: vi.fn((profile, result) => ({
    ...profile,
    instagram: {
      follower_count: result.follower_count,
      post_count: result.post_count,
      posts_last_30d: result.posts_last_30d,
    },
  })),
}));

vi.mock("@/lib/lead-gen/enrich/youtube", () => ({
  fetchYouTube: vi.fn().mockResolvedValue({
    subscriber_count: 800,
    video_count: 30,
    uploads_last_90d: 4,
    channel_id: "UCtest",
  }),
  applyYouTubeToProfile: vi.fn((profile, result) => ({
    ...profile,
    youtube: {
      subscriber_count: result.subscriber_count,
      video_count: result.video_count,
      uploads_last_90d: result.uploads_last_90d,
    },
  })),
}));

vi.mock("@/lib/lead-gen/enrich/website-scrape", () => ({
  scrapeWebsite: vi.fn().mockResolvedValue({
    has_about_page: true,
    has_pricing_page: true,
    team_size_signal: "small",
    stated_pricing_tier: "mid",
  }),
  applyWebsiteScrapeToProfile: vi.fn((profile, result) => ({
    ...profile,
    website: {
      ...profile.website,
      has_about_page: result.has_about_page,
      has_pricing_page: result.has_pricing_page,
      team_size_signal: result.team_size_signal,
      stated_pricing_tier: result.stated_pricing_tier,
    },
  })),
}));

vi.mock("@/lib/lead-gen/enrich/maps-extras", () => ({
  fetchMapsExtras: vi.fn().mockResolvedValue({
    photo_count: 45,
    last_photo_date: "2026-03-15",
  }),
  applyMapsExtrasToProfile: vi.fn((profile, result) => ({
    ...profile,
    maps: {
      ...profile.maps,
      photo_count: result.photo_count,
      last_photo_date: result.last_photo_date,
    },
  })),
}));

describe("enrichCandidate orchestrator", () => {
  it("enriches a candidate with domain and place_id (all 6 signals)", async () => {
    const { enrichCandidate } = await import("@/lib/lead-gen/enrich");

    const candidate: DiscoveredCandidate = {
      company_name: "Acme Cafe",
      domain: "acmecafe.com.au",
      source: "google_maps",
      partial_profile: {
        maps: {
          category: "Cafe",
          rating: 4.5,
          review_count: 100,
          photo_count: 10,
          last_photo_date: null,
        },
      },
      raw_source_data: {
        place_id: "ChIJtest123",
      },
    };

    const result = await enrichCandidate(candidate);

    expect(result.signals_attempted).toBe(6);
    expect(result.signals_succeeded).toBeGreaterThanOrEqual(1);
    expect(result.enrichment_duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.profile).toBeDefined();
  });

  it("skips domain-dependent signals for domainless candidates", async () => {
    const { enrichCandidate } = await import("@/lib/lead-gen/enrich");

    const candidate: DiscoveredCandidate = {
      company_name: "Corner Barber",
      domain: null,
      source: "google_maps",
      partial_profile: {
        maps: {
          category: "Barber",
          rating: 4.8,
          review_count: 30,
          photo_count: 5,
          last_photo_date: null,
        },
      },
      raw_source_data: {
        place_id: "ChIJbarber456",
      },
    };

    const result = await enrichCandidate(candidate);

    // Only youtube (name-based) and maps_extras (place_id-based) should run
    expect(result.signals_attempted).toBe(2);
  });

  it("skips maps extras when no place_id available", async () => {
    const { enrichCandidate } = await import("@/lib/lead-gen/enrich");

    const candidate: DiscoveredCandidate = {
      company_name: "Ad Runner Inc",
      domain: "adrunner.com",
      source: "meta_ad_library",
      partial_profile: {
        meta_ads: {
          active_ad_count: 5,
          estimated_spend_bracket: "high",
          has_active_creatives: true,
        },
      },
      // No raw_source_data with place_id
    };

    const result = await enrichCandidate(candidate);

    // All 6 attempted (maps_extras is eligible but skips internally)
    expect(result.signals_attempted).toBe(6);
  });

  it("preserves discovery partial profile data", async () => {
    const { enrichCandidate } = await import("@/lib/lead-gen/enrich");

    const candidate: DiscoveredCandidate = {
      company_name: "Meta Advertiser",
      domain: "metaadvertiser.com",
      source: "meta_ad_library",
      partial_profile: {
        meta_ads: {
          active_ad_count: 3,
          estimated_spend_bracket: "medium",
          has_active_creatives: true,
        },
      },
    };

    const result = await enrichCandidate(candidate);

    // meta_ads from discovery should be preserved in the final profile
    expect(result.profile.meta_ads?.active_ad_count).toBe(3);
    expect(result.profile.meta_ads?.estimated_spend_bracket).toBe("medium");
  });

  it("returns valid duration measurement", async () => {
    const { enrichCandidate } = await import("@/lib/lead-gen/enrich");

    const candidate: DiscoveredCandidate = {
      company_name: "Quick Test",
      domain: "quicktest.com",
      source: "google_ads_transparency",
      partial_profile: {},
    };

    const result = await enrichCandidate(candidate);

    expect(result.enrichment_duration_ms).toBeGreaterThanOrEqual(0);
    expect(typeof result.enrichment_duration_ms).toBe("number");
  });
});
