import { describe, it, expect } from "vitest";
import {
  applyPageSpeedToProfile,
  type PageSpeedResult,
} from "@/lib/lead-gen/enrich/pagespeed";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("applyPageSpeedToProfile", () => {
  it("merges a successful score into an empty profile", () => {
    const result: PageSpeedResult = { performance_score: 85 };
    const profile = applyPageSpeedToProfile({}, result);

    expect(profile.website?.pagespeed_performance_score).toBe(85);
    expect(profile.website?.domain_age_years).toBeNull();
    expect(profile.website?.has_about_page).toBe(false);
    expect(profile.fetch_errors).toBeUndefined();
  });

  it("preserves existing website fields when merging", () => {
    const existing: Partial<ViabilityProfile> = {
      website: {
        domain_age_years: 5,
        pagespeed_performance_score: null,
        has_about_page: true,
        has_pricing_page: true,
        team_size_signal: "small",
        stated_pricing_tier: "mid",
      },
    };

    const result: PageSpeedResult = { performance_score: 72 };
    const profile = applyPageSpeedToProfile(existing, result);

    expect(profile.website?.pagespeed_performance_score).toBe(72);
    expect(profile.website?.domain_age_years).toBe(5);
    expect(profile.website?.has_about_page).toBe(true);
    expect(profile.website?.team_size_signal).toBe("small");
  });

  it("records fetch error on failure", () => {
    const result: PageSpeedResult = {
      performance_score: null,
      error: "API key invalid",
    };
    const profile = applyPageSpeedToProfile({}, result);

    expect(profile.website?.pagespeed_performance_score).toBeNull();
    expect(profile.fetch_errors?.pagespeed).toBe("API key invalid");
  });

  it("handles null score without error (no data available)", () => {
    const result: PageSpeedResult = { performance_score: null };
    const profile = applyPageSpeedToProfile({}, result);

    expect(profile.website?.pagespeed_performance_score).toBeNull();
    expect(profile.fetch_errors).toBeUndefined();
  });

  it("preserves existing fetch_errors from other signals", () => {
    const existing: Partial<ViabilityProfile> = {
      fetch_errors: { instagram: "rate limited" },
    };
    const result: PageSpeedResult = {
      performance_score: null,
      error: "timeout",
    };
    const profile = applyPageSpeedToProfile(existing, result);

    expect(profile.fetch_errors?.instagram).toBe("rate limited");
    expect(profile.fetch_errors?.pagespeed).toBe("timeout");
  });
});
