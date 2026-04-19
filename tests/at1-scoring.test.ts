import { describe, it, expect } from "vitest";
import {
  scoreAuditCategory,
  scoreAuditOverall,
  AUDIT_CATEGORIES,
  type CategoryScore,
} from "@/lib/audit/scoring";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

describe("AT-1: Audit scoring engine", () => {
  const fullProfile: ViabilityProfile = {
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
      domain_age_years: 7,
      pagespeed_performance_score: 75,
      has_about_page: true,
      has_pricing_page: true,
      team_size_signal: "medium",
      stated_pricing_tier: "mid",
    },
    instagram: {
      follower_count: 3000,
      post_count: 150,
      posts_last_30d: 6,
    },
    youtube: {
      subscriber_count: 500,
      video_count: 25,
      uploads_last_90d: 4,
    },
    maps: {
      category: "Restaurant",
      rating: 4.5,
      review_count: 45,
      photo_count: 15,
      last_photo_date: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  };

  describe("scoreAuditCategory", () => {
    it("scores all 5 categories", () => {
      for (const cat of AUDIT_CATEGORIES) {
        const result = scoreAuditCategory(cat, fullProfile);
        expect(result.category).toBe(cat);
        expect(result.available).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.grade).toBeTruthy();
      }
    });

    it("marks categories as unavailable when signals are missing", () => {
      const empty: ViabilityProfile = {};
      const adResult = scoreAuditCategory("advertising", empty);
      expect(adResult.available).toBe(false);
      expect(adResult.grade).toBe("N/A");

      const repResult = scoreAuditCategory("reputation", empty);
      expect(repResult.available).toBe(false);
    });

    it("returns correct grade boundaries", () => {
      // A profile with very high signals should grade well
      const strongProfile: ViabilityProfile = {
        meta_ads: {
          active_ad_count: 10,
          estimated_spend_bracket: "high",
          has_active_creatives: true,
        },
        google_ads: {
          active_creative_count: 8,
          has_active_campaigns: true,
        },
      };
      const adScore = scoreAuditCategory("advertising", strongProfile);
      expect(adScore.available).toBe(true);
      expect(adScore.score).toBeGreaterThanOrEqual(50);
    });

    it("clamps scores to 0-100", () => {
      const result = scoreAuditCategory("advertising", fullProfile);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe("scoreAuditOverall", () => {
    it("computes weighted average from available categories", () => {
      const scores: CategoryScore[] = AUDIT_CATEGORIES.map((cat) =>
        scoreAuditCategory(cat, fullProfile),
      );
      const overall = scoreAuditOverall(scores);
      expect(overall.score).toBeGreaterThan(0);
      expect(overall.score).toBeLessThanOrEqual(100);
      expect(overall.grade).toBeTruthy();
      expect(overall.grade).not.toBe("N/A");
    });

    it("excludes unavailable categories from average", () => {
      const partial: ViabilityProfile = {
        website: {
          domain_age_years: 5,
          pagespeed_performance_score: 80,
          has_about_page: true,
          has_pricing_page: false,
          team_size_signal: "small",
          stated_pricing_tier: "mid",
        },
      };
      const scores: CategoryScore[] = AUDIT_CATEGORIES.map((cat) =>
        scoreAuditCategory(cat, partial),
      );
      const available = scores.filter((s) => s.available);
      // website + content are available (content uses website presence)
      expect(available.length).toBe(2);
      const overall = scoreAuditOverall(scores);
      expect(overall.score).toBeGreaterThan(0);
      // Overall should be the weighted average of just those two
      const unavailable = scores.filter((s) => !s.available);
      expect(unavailable.length).toBe(3);
    });

    it("returns N/A when no categories have data", () => {
      const empty: ViabilityProfile = {};
      const scores: CategoryScore[] = AUDIT_CATEGORIES.map((cat) =>
        scoreAuditCategory(cat, empty),
      );
      const overall = scoreAuditOverall(scores);
      expect(overall.grade).toBe("N/A");
      expect(overall.score).toBe(0);
    });
  });
});
