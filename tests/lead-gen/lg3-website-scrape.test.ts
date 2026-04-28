import { describe, it, expect } from "vitest";
import {
  inferTeamSize,
  inferPricingTier,
  applyWebsiteScrapeToProfile,
  type WebsiteScrapeResult,
} from "@/lib/lead-gen/enrich/website-scrape";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("inferTeamSize", () => {
  it("detects solo operator language", () => {
    expect(inferTeamSize("<p>I'm a freelance photographer based in Melbourne.</p>")).toBe("solo");
    expect(inferTeamSize("<p>Sole trader operating since 2015.</p>")).toBe("solo");
    expect(inferTeamSize("<p>An independent consultant with 10 years experience.</p>")).toBe("solo");
  });

  it("detects small team from 'our team' language", () => {
    expect(inferTeamSize("<p>Meet our team of dedicated professionals.</p>")).toBe("small");
  });

  it("detects numeric team sizes", () => {
    expect(inferTeamSize("<p>Our team of 3 specialists serves you.</p>")).toBe("small");
    expect(inferTeamSize("<p>We have 15 team members across two offices.</p>")).toBe("medium");
    expect(inferTeamSize("<p>Over 50 employees globally.</p>")).toBe("large");
    expect(inferTeamSize("<p>200+ staff members.</p>")).toBe("large");
  });

  it("detects large org from department language", () => {
    expect(inferTeamSize("<p>Our headquarters in Sydney manages three global offices.</p>")).toBe("large");
  });

  it("returns unknown for ambiguous content", () => {
    expect(inferTeamSize("<p>We provide excellent service.</p>")).toBe("unknown");
  });

  it("ignores script and style content", () => {
    const html = '<script>var team_members = 50;</script><p>I am a freelance designer.</p>';
    expect(inferTeamSize(html)).toBe("solo");
  });

  it("detects 1 person as solo", () => {
    expect(inferTeamSize("<p>1 team member — me!</p>")).toBe("solo");
  });
});

describe("inferPricingTier", () => {
  it("detects budget pricing from low dollar amounts", () => {
    expect(inferPricingTier("<p>Plans starting from $29/month.</p>")).toBe("budget");
  });

  it("detects mid-range pricing", () => {
    expect(inferPricingTier("<p>Our packages range from $199 to $499.</p>")).toBe("mid");
  });

  it("detects premium pricing from high amounts", () => {
    expect(inferPricingTier("<p>Starting at $2,500 per project.</p>")).toBe("premium");
  });

  it("detects premium from language cues", () => {
    expect(inferPricingTier("<p>We offer bespoke solutions tailored to your needs.</p>")).toBe("premium");
    expect(inferPricingTier("<p>Luxury event planning for high-end clients.</p>")).toBe("premium");
  });

  it("detects budget from language cues", () => {
    expect(inferPricingTier("<p>Affordable prices for every budget.</p>")).toBe("budget");
  });

  it("returns unknown for no pricing signals", () => {
    expect(inferPricingTier("<p>Contact us for more information.</p>")).toBe("unknown");
  });

  it("uses median of multiple prices", () => {
    // $50, $150, $300 → median $150 → mid
    expect(inferPricingTier("<p>$50 basic, $150 standard, $300 premium</p>")).toBe("mid");
  });
});

describe("applyWebsiteScrapeToProfile", () => {
  it("merges scrape result into empty profile", () => {
    const emptySocial = {
      instagram_url: null, facebook_url: null, linkedin_url: null,
      tiktok_url: null, twitter_url: null, youtube_url: null,
    };
    const result: WebsiteScrapeResult = {
      has_about_page: true,
      has_pricing_page: true,
      team_size_signal: "small",
      stated_pricing_tier: "mid",
      scraped_contacts: [],
      scraped_phones: [],
      scraped_social_links: emptySocial,
    };
    const profile = applyWebsiteScrapeToProfile({}, result);

    expect(profile.website?.has_about_page).toBe(true);
    expect(profile.website?.has_pricing_page).toBe(true);
    expect(profile.website?.team_size_signal).toBe("small");
    expect(profile.website?.stated_pricing_tier).toBe("mid");
    expect(profile.website?.domain_age_years).toBeNull();
    expect(profile.website?.pagespeed_performance_score).toBeNull();
  });

  it("preserves existing PageSpeed and WHOIS data", () => {
    const emptySocial = {
      instagram_url: null, facebook_url: null, linkedin_url: null,
      tiktok_url: null, twitter_url: null, youtube_url: null,
    };
    const existing: Partial<ViabilityProfile> = {
      website: {
        domain_age_years: 5,
        pagespeed_performance_score: 85,
        has_about_page: false,
        has_pricing_page: false,
        team_size_signal: "unknown",
        stated_pricing_tier: "unknown",
      },
    };

    const result: WebsiteScrapeResult = {
      has_about_page: true,
      has_pricing_page: false,
      team_size_signal: "medium",
      stated_pricing_tier: "premium",
      scraped_contacts: [],
      scraped_phones: [],
      scraped_social_links: emptySocial,
    };
    const profile = applyWebsiteScrapeToProfile(existing, result);

    expect(profile.website?.domain_age_years).toBe(5);
    expect(profile.website?.pagespeed_performance_score).toBe(85);
    expect(profile.website?.has_about_page).toBe(true);
    expect(profile.website?.team_size_signal).toBe("medium");
  });

  it("records error without blocking results", () => {
    const emptySocial = {
      instagram_url: null, facebook_url: null, linkedin_url: null,
      tiktok_url: null, twitter_url: null, youtube_url: null,
    };
    const result: WebsiteScrapeResult = {
      has_about_page: false,
      has_pricing_page: false,
      team_size_signal: "unknown",
      stated_pricing_tier: "unknown",
      scraped_contacts: [],
      scraped_phones: [],
      scraped_social_links: emptySocial,
      error: "Website scrape failed: timeout",
    };
    const profile = applyWebsiteScrapeToProfile({}, result);

    expect(profile.fetch_errors?.website_scrape).toContain("timeout");
    expect(profile.website?.has_about_page).toBe(false);
  });
});
