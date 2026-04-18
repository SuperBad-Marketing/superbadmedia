import { describe, it, expect } from "vitest";
import {
  applyWhoisToProfile,
  type WhoisResult,
} from "@/lib/lead-gen/enrich/whois";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("applyWhoisToProfile", () => {
  it("merges domain age into an empty profile", () => {
    const result: WhoisResult = {
      domain_age_years: 8.5,
      registration_date: "2017-10-15T00:00:00Z",
    };
    const profile = applyWhoisToProfile({}, result);

    expect(profile.website?.domain_age_years).toBe(8.5);
    expect(profile.website?.pagespeed_performance_score).toBeNull();
    expect(profile.fetch_errors).toBeUndefined();
  });

  it("preserves existing website fields", () => {
    const existing: Partial<ViabilityProfile> = {
      website: {
        domain_age_years: null,
        pagespeed_performance_score: 72,
        has_about_page: true,
        has_pricing_page: false,
        team_size_signal: "medium",
        stated_pricing_tier: "premium",
      },
    };

    const result: WhoisResult = {
      domain_age_years: 3.2,
      registration_date: "2023-01-01T00:00:00Z",
    };
    const profile = applyWhoisToProfile(existing, result);

    expect(profile.website?.domain_age_years).toBe(3.2);
    expect(profile.website?.pagespeed_performance_score).toBe(72);
    expect(profile.website?.team_size_signal).toBe("medium");
  });

  it("records fetch error when RDAP fails", () => {
    const result: WhoisResult = {
      domain_age_years: null,
      registration_date: null,
      error: "RDAP lookup error: 404 Not Found",
    };
    const profile = applyWhoisToProfile({}, result);

    expect(profile.website?.domain_age_years).toBeNull();
    expect(profile.fetch_errors?.whois).toBe("RDAP lookup error: 404 Not Found");
  });

  it("handles privacy-protected domains gracefully", () => {
    const result: WhoisResult = {
      domain_age_years: null,
      registration_date: null,
      error: "No registration date in RDAP response",
    };
    const profile = applyWhoisToProfile({}, result);

    expect(profile.website?.domain_age_years).toBeNull();
    expect(profile.fetch_errors?.whois).toContain("No registration date");
  });
});
