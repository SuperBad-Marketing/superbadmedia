import { describe, it, expect } from "vitest";
import type {
  ViabilityProfile,
  DiscoveredCandidate,
  DiscoverySearchParams,
  SourceResult,
} from "@/lib/lead-gen/types";

describe("ViabilityProfile type", () => {
  it("accepts a fully populated profile", () => {
    const profile: ViabilityProfile = {
      meta_ads: {
        active_ad_count: 5,
        estimated_spend_bracket: "high",
        has_active_creatives: true,
      },
      google_ads: {
        active_creative_count: 12,
        has_active_campaigns: true,
      },
      website: {
        domain_age_years: 8,
        pagespeed_performance_score: 72,
        has_about_page: true,
        has_pricing_page: false,
        team_size_signal: "small",
        stated_pricing_tier: "mid",
      },
      instagram: {
        follower_count: 3200,
        post_count: 145,
        posts_last_30d: 8,
      },
      youtube: {
        subscriber_count: 500,
        video_count: 22,
        uploads_last_90d: 3,
      },
      maps: {
        category: "Cafe",
        rating: 4.5,
        review_count: 132,
        photo_count: 45,
        last_photo_date: "2026-03-15",
      },
      fetch_errors: {},
    };

    expect(profile.meta_ads?.active_ad_count).toBe(5);
    expect(profile.maps?.rating).toBe(4.5);
  });

  it("accepts a completely empty profile (all fields optional)", () => {
    const profile: ViabilityProfile = {};
    expect(profile.meta_ads).toBeUndefined();
    expect(profile.google_ads).toBeUndefined();
    expect(profile.website).toBeUndefined();
    expect(profile.instagram).toBeUndefined();
    expect(profile.youtube).toBeUndefined();
    expect(profile.maps).toBeUndefined();
  });

  it("accepts partial profiles (single signal source)", () => {
    const metaOnly: ViabilityProfile = {
      meta_ads: {
        active_ad_count: 1,
        estimated_spend_bracket: "low",
        has_active_creatives: true,
      },
    };
    expect(metaOnly.meta_ads?.estimated_spend_bracket).toBe("low");
  });

  it("captures fetch errors per source", () => {
    const profile: ViabilityProfile = {
      meta_ads: {
        active_ad_count: 3,
        estimated_spend_bracket: "medium",
        has_active_creatives: true,
      },
      fetch_errors: {
        instagram: "API rate limit exceeded",
        youtube: "Invalid API key",
      },
    };
    expect(Object.keys(profile.fetch_errors ?? {})).toHaveLength(2);
  });
});

describe("DiscoveredCandidate type", () => {
  it("represents a Meta Ad Library discovery", () => {
    const candidate: DiscoveredCandidate = {
      company_name: "Acme Cafe",
      domain: "acmecafe.com.au",
      source: "meta_ad_library",
      partial_profile: {
        meta_ads: {
          active_ad_count: 2,
          estimated_spend_bracket: "medium",
          has_active_creatives: true,
        },
      },
    };
    expect(candidate.source).toBe("meta_ad_library");
    expect(candidate.domain).toBe("acmecafe.com.au");
  });

  it("allows null domain (Maps-sourced without website)", () => {
    const candidate: DiscoveredCandidate = {
      company_name: "Corner Barber",
      domain: null,
      source: "google_maps",
      partial_profile: {
        maps: {
          category: "Barber shop",
          rating: 4.8,
          review_count: 67,
          photo_count: 12,
          last_photo_date: null,
        },
      },
    };
    expect(candidate.domain).toBeNull();
  });
});

describe("DiscoverySearchParams type", () => {
  it("captures all search fields", () => {
    const params: DiscoverySearchParams = {
      category: "dental clinics",
      location: "Melbourne, Australia",
      radius_km: 25,
      location_lat: -37.8136,
      location_lng: 144.9631,
      country_code: "AU",
      brief: "Looking for dental clinics that could benefit from better marketing",
      max_candidates: 8,
    };
    expect(params.category).toBe("dental clinics");
    expect(params.radius_km).toBe(25);
  });
});

describe("SourceResult type", () => {
  it("represents a successful source run", () => {
    const result: SourceResult = {
      source: "google_maps",
      candidates: [],
      duration_ms: 1200,
    };
    expect(result.error).toBeUndefined();
  });

  it("represents a failed source run", () => {
    const result: SourceResult = {
      source: "meta_ad_library",
      candidates: [],
      error: "API rate limit exceeded",
      duration_ms: 150,
    };
    expect(result.error).toBe("API rate limit exceeded");
    expect(result.candidates).toHaveLength(0);
  });
});
