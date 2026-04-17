import { describe, it, expect } from "vitest";
import {
  scoreForSaasTrack,
  scoreForRetainerTrack,
  assignTrack,
  SAAS_QUALIFICATION_FLOOR,
  RETAINER_QUALIFICATION_FLOOR,
} from "@/lib/lead-gen/scoring";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

// ── Profile fixtures ──────────────────────────────────────────────────────────

/** Solo/small team, no ad spend, 2-year-old domain, about page present. SaaS candidate. */
const saasFit: Partial<ViabilityProfile> = {
  meta_ads: { active_ad_count: 0, estimated_spend_bracket: "unknown", has_active_creatives: false },
  website: {
    domain_age_years: 2,
    pagespeed_performance_score: 65,
    has_about_page: true,
    has_pricing_page: false,
    team_size_signal: "solo",
    stated_pricing_tier: "unknown",
  },
};

/** High ad spend, strong social, established business. Retainer candidate. */
const retainerFit: Partial<ViabilityProfile> = {
  meta_ads: { active_ad_count: 20, estimated_spend_bracket: "high", has_active_creatives: true },
  google_ads: { active_creative_count: 10, has_active_campaigns: true },
  instagram: { follower_count: 15000, post_count: 300, posts_last_30d: null },
  youtube: { subscriber_count: 3000, video_count: 80, uploads_last_90d: null },
  website: {
    domain_age_years: 8,
    pagespeed_performance_score: 50,
    has_about_page: true,
    has_pricing_page: true,
    team_size_signal: "large",
    stated_pricing_tier: "premium",
  },
  maps: { category: "restaurant", rating: 4.5, review_count: 120, photo_count: 40, last_photo_date: null },
};

/** Medium spend + strong social — qualifies for both tracks. Retainer should win on score. */
const bothQualify: Partial<ViabilityProfile> = {
  meta_ads: { active_ad_count: 5, estimated_spend_bracket: "medium", has_active_creatives: true },
  google_ads: { active_creative_count: 3, has_active_campaigns: true },
  instagram: { follower_count: 8000, post_count: 100, posts_last_30d: null },
  youtube: { subscriber_count: 1500, video_count: 50, uploads_last_90d: null },
  website: {
    domain_age_years: 5,
    pagespeed_performance_score: 80,
    has_about_page: true,
    has_pricing_page: true,
    team_size_signal: "small",
    stated_pricing_tier: "mid",
  },
  maps: { category: "cafe", rating: 4.8, review_count: 60, photo_count: 20, last_photo_date: null },
};

// ── scoreForSaasTrack ─────────────────────────────────────────────────────────

describe("scoreForSaasTrack", () => {
  it("solo/small team candidate scores >= SaaS floor", () => {
    const result = scoreForSaasTrack(saasFit);
    expect(result.score).toBeGreaterThanOrEqual(SAAS_QUALIFICATION_FLOOR);
    expect(result.qualifies).toBe(true);
  });

  it("missing profile (empty object) scores 0 and does not qualify", () => {
    const result = scoreForSaasTrack({});
    expect(result.score).toBe(0);
    expect(result.qualifies).toBe(false);
  });

  it("softAdjustment is added and clamped to 0–100", () => {
    // Profile with raw score of exactly 40 (solo:30 + about:10)
    const base: Partial<ViabilityProfile> = {
      website: {
        team_size_signal: "solo",
        has_about_page: true,
        has_pricing_page: false,
        pagespeed_performance_score: null,
        domain_age_years: null,
        stated_pricing_tier: "unknown",
      },
    };

    expect(scoreForSaasTrack(base, 0).score).toBe(40);
    expect(scoreForSaasTrack(base, 10).score).toBe(50);
    // Clamped to 100 when adjustment pushes above ceiling
    expect(scoreForSaasTrack(base, 100).score).toBe(100);
    // Clamped to 0 when adjustment pushes below floor
    expect(scoreForSaasTrack(base, -50).score).toBe(0);
    expect(scoreForSaasTrack(base, -50).qualifies).toBe(false);
  });

  it("breakdown keys are non-empty on a scored candidate", () => {
    const result = scoreForSaasTrack(saasFit);
    expect(Object.keys(result.breakdown).length).toBeGreaterThan(0);
  });
});

// ── scoreForRetainerTrack ─────────────────────────────────────────────────────

describe("scoreForRetainerTrack", () => {
  it("high-ad-spend + high-follower candidate scores >= retainer floor", () => {
    const result = scoreForRetainerTrack(retainerFit);
    expect(result.score).toBeGreaterThanOrEqual(RETAINER_QUALIFICATION_FLOOR);
    expect(result.qualifies).toBe(true);
  });

  it("missing profile (empty object) scores 0 and does not qualify", () => {
    const result = scoreForRetainerTrack({});
    expect(result.score).toBe(0);
    expect(result.qualifies).toBe(false);
  });

  it("breakdown keys are non-empty on a scored candidate", () => {
    const result = scoreForRetainerTrack(retainerFit);
    expect(Object.keys(result.breakdown).length).toBeGreaterThan(0);
  });
});

// ── assignTrack ───────────────────────────────────────────────────────────────

describe("assignTrack", () => {
  it("both qualify → track with higher score wins", () => {
    const saas = scoreForSaasTrack(bothQualify);
    const retainer = scoreForRetainerTrack(bothQualify);

    // Verify both qualify (fixture integrity check)
    expect(saas.qualifies).toBe(true);
    expect(retainer.qualifies).toBe(true);

    const result = assignTrack(bothQualify);
    const expectedTrack = saas.score >= retainer.score ? "saas" : "retainer";
    expect(result.track).toBe(expectedTrack);
    expect(result.score).toBe(Math.max(saas.score, retainer.score));
  });

  it("only SaaS qualifies → saas assigned", () => {
    // saasFit: solo team + no ads → SaaS qualifies, Retainer does not
    const saas = scoreForSaasTrack(saasFit);
    const retainer = scoreForRetainerTrack(saasFit);
    expect(saas.qualifies).toBe(true);
    expect(retainer.qualifies).toBe(false);

    const result = assignTrack(saasFit);
    expect(result.track).toBe("saas");
    expect(result.score).toBe(saas.score);
  });

  it("only retainer qualifies → retainer assigned", () => {
    // retainerFit: large team + high spend → SaaS disqualified, Retainer qualifies
    const saas = scoreForSaasTrack(retainerFit);
    const retainer = scoreForRetainerTrack(retainerFit);
    expect(saas.qualifies).toBe(false);
    expect(retainer.qualifies).toBe(true);

    const result = assignTrack(retainerFit);
    expect(result.track).toBe("retainer");
    expect(result.score).toBe(retainer.score);
  });

  it("neither qualifies → track: null, score: 0", () => {
    const result = assignTrack({});
    expect(result.track).toBeNull();
    expect(result.score).toBe(0);
  });
});
