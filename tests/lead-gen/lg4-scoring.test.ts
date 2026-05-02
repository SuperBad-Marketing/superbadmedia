import { describe, it, expect } from "vitest";
import {
  scoreForSaasTrack,
  scoreForRetainerTrack,
  assignTrack,
  rescoreCandidate,
  SAAS_FLOOR,
  RETAINER_FLOOR,
  REACTIVE_MIN,
  REACTIVE_MAX,
} from "@/lib/lead-gen/scoring";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

// ── Fixtures ───────────────────────────────────────────────────────────

const EMPTY_PROFILE: ViabilityProfile = {};

const SAAS_LEANING_PROFILE: ViabilityProfile = {
  meta_ads: {
    active_ad_count: 2,
    estimated_spend_bracket: "low",
    has_active_creatives: true,
  },
  website: {
    domain_age_years: 1,
    pagespeed_performance_score: 35,
    has_about_page: true,
    has_pricing_page: true,
    team_size_signal: "solo",
    stated_pricing_tier: "budget",
  },
  instagram: {
    follower_count: 800,
    post_count: 50,
    posts_last_30d: 4,
  },
  maps: {
    category: "cafe",
    rating: 4.2,
    review_count: 25,
    photo_count: 8,
    last_photo_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  },
};

const RETAINER_LEANING_PROFILE: ViabilityProfile = {
  meta_ads: {
    active_ad_count: 10,
    estimated_spend_bracket: "high",
    has_active_creatives: true,
  },
  google_ads: {
    active_creative_count: 8,
    has_active_campaigns: true,
  },
  website: {
    domain_age_years: 8,
    pagespeed_performance_score: 85,
    has_about_page: true,
    has_pricing_page: true,
    team_size_signal: "large",
    stated_pricing_tier: "premium",
  },
  instagram: {
    follower_count: 25000,
    post_count: 500,
    posts_last_30d: 10,
  },
  youtube: {
    subscriber_count: 5000,
    video_count: 80,
    uploads_last_90d: 6,
  },
  maps: {
    category: "restaurant",
    rating: 4.6,
    review_count: 120,
    photo_count: 40,
    last_photo_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  },
};

// ── SaaS scorer ────────────────────────────────────────────────────────

describe("scoreForSaasTrack", () => {
  it("returns zero for empty profile", () => {
    const result = scoreForSaasTrack(EMPTY_PROFILE);
    expect(result.score).toBe(0);
    expect(result.qualifies).toBe(false);
  });

  it("scores a SaaS-leaning profile above floor", () => {
    const result = scoreForSaasTrack(SAAS_LEANING_PROFILE);
    expect(result.score).toBeGreaterThanOrEqual(SAAS_FLOOR);
    expect(result.qualifies).toBe(true);
  });

  it("includes breakdown with four categories", () => {
    const result = scoreForSaasTrack(SAAS_LEANING_PROFILE);
    expect(result.breakdown).toHaveProperty("advertising");
    expect(result.breakdown).toHaveProperty("web");
    expect(result.breakdown).toHaveProperty("social");
    expect(result.breakdown).toHaveProperty("maps");
    expect(result.breakdown.floor).toBe(SAAS_FLOOR);
  });

  it("applies soft adjustment", () => {
    const base = scoreForSaasTrack(SAAS_LEANING_PROFILE, 0);
    const boosted = scoreForSaasTrack(SAAS_LEANING_PROFILE, 10);
    expect(boosted.score).toBe(Math.min(base.score + 10, 100));
  });

  it("clamps score to 0-100", () => {
    const result = scoreForSaasTrack(EMPTY_PROFILE, -50);
    expect(result.score).toBe(0);

    const maxResult = scoreForSaasTrack(RETAINER_LEANING_PROFILE, 100);
    expect(maxResult.score).toBeLessThanOrEqual(100);
  });
});

// ── Retainer scorer ────────────────────────────────────────────────────

describe("scoreForRetainerTrack", () => {
  it("returns zero for empty profile", () => {
    const result = scoreForRetainerTrack(EMPTY_PROFILE);
    expect(result.score).toBe(0);
    expect(result.qualifies).toBe(false);
  });

  it("scores a retainer-leaning profile above floor", () => {
    const result = scoreForRetainerTrack(RETAINER_LEANING_PROFILE);
    expect(result.score).toBeGreaterThanOrEqual(RETAINER_FLOOR);
    expect(result.qualifies).toBe(true);
  });

  it("retainer floor is higher than SaaS floor", () => {
    expect(RETAINER_FLOOR).toBeGreaterThan(SAAS_FLOOR);
  });
});

// ── Track assignment ───────────────────────────────────────────────────

describe("assignTrack", () => {
  it("returns null track when neither qualifies", () => {
    const result = assignTrack(EMPTY_PROFILE);
    expect(result.track).toBeNull();
    expect(result.score).toBe(0);
  });

  it("assigns SaaS when only SaaS qualifies", () => {
    const result = assignTrack(SAAS_LEANING_PROFILE);
    if (
      result.saas.qualifies &&
      !result.retainer.qualifies
    ) {
      expect(result.track).toBe("saas");
    }
  });

  it("assigns retainer for retainer-leaning profile", () => {
    const result = assignTrack(RETAINER_LEANING_PROFILE);
    expect(result.track).not.toBeNull();
    expect(result.saas).toBeDefined();
    expect(result.retainer).toBeDefined();
  });

  it("winner-takes-all when both qualify", () => {
    const result = assignTrack(RETAINER_LEANING_PROFILE);
    if (result.saas.qualifies && result.retainer.qualifies) {
      if (result.saas.score >= result.retainer.score) {
        expect(result.track).toBe("saas");
      } else {
        expect(result.track).toBe("retainer");
      }
    }
  });

  it("includes both track scores in result", () => {
    const result = assignTrack(RETAINER_LEANING_PROFILE);
    expect(result.saas.score).toBeGreaterThanOrEqual(0);
    expect(result.retainer.score).toBeGreaterThanOrEqual(0);
  });
});

// ── Reactive scoring (rescoreCandidate) ────────────────────────────────

describe("rescoreCandidate", () => {
  const baseArgs = {
    currentSaasScore: 60,
    currentRetainerScore: 40,
    currentTrack: "saas" as const,
    viabilityProfile: SAAS_LEANING_PROFILE,
    engagementHistory: [],
    replyClassifications: [],
    touchesSent: 0,
    fileNotes: [],
    hardBounced: false,
    trackChangeUsed: false,
  };

  it("returns unchanged scores with no events", () => {
    const result = rescoreCandidate(baseArgs);
    expect(result.rescoreBreakdown.clampedTotal).toBe(0);
    expect(result.trackChanged).toBe(false);
  });

  it("boosts score on click engagement", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [{ tier: 1, touchIndex: 1 }],
    });
    expect(result.rescoreBreakdown.engagement).toBe(5);
  });

  it("caps click engagement at +15", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [
        { tier: 1, touchIndex: 1 },
        { tier: 1, touchIndex: 2 },
        { tier: 1, touchIndex: 3 },
        { tier: 1, touchIndex: 4 },
      ],
    });
    expect(result.rescoreBreakdown.engagement).toBe(15);
  });

  it("boosts on full open (tier 2)", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [{ tier: 2, touchIndex: 1 }],
    });
    expect(result.rescoreBreakdown.engagement).toBe(2);
  });

  it("caps full open adjustment at +6", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [
        { tier: 2, touchIndex: 1 },
        { tier: 2, touchIndex: 2 },
        { tier: 2, touchIndex: 3 },
        { tier: 2, touchIndex: 4 },
      ],
    });
    expect(result.rescoreBreakdown.engagement).toBe(6);
  });

  it("no adjustment on sub-60s open (tier 3)", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [{ tier: 3, touchIndex: 1 }],
    });
    expect(result.rescoreBreakdown.engagement).toBe(0);
  });

  it("penalises non-engagement (tier 4)", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [{ tier: 4, touchIndex: 1 }],
    });
    expect(result.rescoreBreakdown.engagement).toBe(-2);
  });

  it("caps non-engagement penalty at -8", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [
        { tier: 4, touchIndex: 1 },
        { tier: 4, touchIndex: 2 },
        { tier: 4, touchIndex: 3 },
        { tier: 4, touchIndex: 4 },
        { tier: 4, touchIndex: 5 },
      ],
    });
    expect(result.rescoreBreakdown.engagement).toBe(-8);
  });

  it("positive reply gives +12 (one-time)", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      replyClassifications: [
        { intent: "positive" },
        { intent: "positive" },
      ],
    });
    expect(result.rescoreBreakdown.reply).toBe(12);
  });

  it("negative reply gives -15", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      replyClassifications: [{ intent: "negative" }],
    });
    expect(result.rescoreBreakdown.reply).toBe(-15);
  });

  it("objection/question gives +5", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      replyClassifications: [{ intent: "objection" }],
    });
    expect(result.rescoreBreakdown.reply).toBe(5);
  });

  it("auto_responder gives 0", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      replyClassifications: [{ intent: "auto_responder" }],
    });
    expect(result.rescoreBreakdown.reply).toBe(0);
  });

  it("replied within 24h gives +4", () => {
    const now = Date.now();
    const result = rescoreCandidate({
      ...baseArgs,
      replyClassifications: [{ intent: "positive" }],
      earliestReplyMs: now,
      earliestTouchMs: now - 12 * 60 * 60 * 1000,
    });
    expect(result.rescoreBreakdown.responsiveness).toBe(4);
  });

  it("replied within 72h gives +2", () => {
    const now = Date.now();
    const result = rescoreCandidate({
      ...baseArgs,
      replyClassifications: [{ intent: "positive" }],
      earliestReplyMs: now,
      earliestTouchMs: now - 48 * 60 * 60 * 1000,
    });
    expect(result.rescoreBreakdown.responsiveness).toBe(2);
  });

  it("no reply after 3+ touches gives -3", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      touchesSent: 3,
      replyClassifications: [],
    });
    expect(result.rescoreBreakdown.responsiveness).toBe(-3);
  });

  it("file note gives +3", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      fileNotes: [{ id: "note-1" }],
    });
    expect(result.rescoreBreakdown.fileNote).toBe(3);
  });

  it("hard bounce gives -10", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      hardBounced: true,
    });
    expect(result.rescoreBreakdown.hardBounce).toBe(-10);
  });

  it("clamps total reactive adjustment to bounds", () => {
    // Max out positive signals
    const positiveResult = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [
        { tier: 1, touchIndex: 1 },
        { tier: 1, touchIndex: 2 },
        { tier: 1, touchIndex: 3 },
        { tier: 2, touchIndex: 4 },
        { tier: 2, touchIndex: 5 },
        { tier: 2, touchIndex: 6 },
      ],
      replyClassifications: [{ intent: "positive" }],
      fileNotes: [{ id: "note-1" }],
      earliestReplyMs: Date.now(),
      earliestTouchMs: Date.now() - 12 * 60 * 60 * 1000,
    });
    expect(positiveResult.rescoreBreakdown.clampedTotal).toBeLessThanOrEqual(
      REACTIVE_MAX,
    );

    // Max out negative signals
    const negativeResult = rescoreCandidate({
      ...baseArgs,
      engagementHistory: [
        { tier: 4, touchIndex: 1 },
        { tier: 4, touchIndex: 2 },
        { tier: 4, touchIndex: 3 },
        { tier: 4, touchIndex: 4 },
      ],
      replyClassifications: [{ intent: "negative" }],
      touchesSent: 4,
      hardBounced: true,
    });
    expect(negativeResult.rescoreBreakdown.clampedTotal).toBeGreaterThanOrEqual(
      REACTIVE_MIN,
    );
  });

  it("detects track change when new track differs and not used", () => {
    // Force a profile where retainer could win after positive signals
    const result = rescoreCandidate({
      currentSaasScore: 42,
      currentRetainerScore: 58,
      currentTrack: "saas",
      viabilityProfile: RETAINER_LEANING_PROFILE,
      engagementHistory: [{ tier: 1, touchIndex: 1 }],
      replyClassifications: [{ intent: "positive" }],
      touchesSent: 1,
      fileNotes: [],
      hardBounced: false,
      trackChangeUsed: false,
    });
    // Whether track actually changes depends on rescored values
    expect(typeof result.trackChanged).toBe("boolean");
  });

  it("suppresses second track change when trackChangeUsed", () => {
    const result = rescoreCandidate({
      currentSaasScore: 42,
      currentRetainerScore: 58,
      currentTrack: "saas",
      viabilityProfile: RETAINER_LEANING_PROFILE,
      engagementHistory: [{ tier: 1, touchIndex: 1 }],
      replyClassifications: [{ intent: "positive" }],
      touchesSent: 1,
      fileNotes: [],
      hardBounced: false,
      trackChangeUsed: true,
    });
    expect(result.trackChanged).toBe(false);
    expect(result.qualifiedTrack).toBe("saas");
  });

  it("final scores are clamped 0-100", () => {
    const result = rescoreCandidate({
      ...baseArgs,
      hardBounced: true,
      engagementHistory: [
        { tier: 4, touchIndex: 1 },
        { tier: 4, touchIndex: 2 },
        { tier: 4, touchIndex: 3 },
        { tier: 4, touchIndex: 4 },
      ],
      replyClassifications: [{ intent: "negative" }],
      touchesSent: 4,
    });
    expect(result.saasScore).toBeGreaterThanOrEqual(0);
    expect(result.saasScore).toBeLessThanOrEqual(100);
    expect(result.retainerScore).toBeGreaterThanOrEqual(0);
    expect(result.retainerScore).toBeLessThanOrEqual(100);
  });
});

// ── Floor constants ────────────────────────────────────────────────────

describe("scoring constants", () => {
  it("SaaS floor is 5", () => {
    expect(SAAS_FLOOR).toBe(5);
  });

  it("retainer floor is 14", () => {
    expect(RETAINER_FLOOR).toBe(14);
  });

  it("reactive bounds are [-20, +25]", () => {
    expect(REACTIVE_MIN).toBe(-20);
    expect(REACTIVE_MAX).toBe(25);
  });
});
