/**
 * Scoring engine — pure functions for candidate qualification and track
 * assignment. §12.B: this is the ONLY location of scoring rules.
 *
 * Owner: Lead Generation spec §6 + §16.
 */

import type { ViabilityProfile } from "./types";

// ── Qualification floors (§6.2) ────────────────────────────────────────
// Changes are deploys, not config (§12.C).

export const SAAS_FLOOR = 5;
export const RETAINER_FLOOR = 14;

// ── Reactive adjustment bounds (§12.X) ─────────────────────────────────

export const REACTIVE_MIN = -20;
export const REACTIVE_MAX = 25;

// ── Scoring breakdown types ────────────────────────────────────────────

export interface ScoringBreakdown {
  advertising: number;
  web: number;
  social: number;
  maps: number;
  total: number;
  floor: number;
}

export interface TrackAssignment {
  track: "saas" | "retainer" | null;
  score: number;
  saas: { score: number; breakdown: ScoringBreakdown; qualifies: boolean };
  retainer: { score: number; breakdown: ScoringBreakdown; qualifies: boolean };
}

// ── Engagement / rescore types ─────────────────────────────────────────

export interface EngagementEvent {
  tier: 1 | 2 | 3 | 4;
  touchIndex: number;
}

export interface ReplyClassification {
  intent: "positive" | "objection" | "question" | "negative" | "auto_responder";
}

export interface FileNote {
  id: string;
}

export interface RescoreBreakdown {
  engagement: number;
  reply: number;
  responsiveness: number;
  fileNote: number;
  hardBounce: number;
  rawTotal: number;
  clampedTotal: number;
}

export interface RescoreResult {
  saasScore: number;
  retainerScore: number;
  qualifiedTrack: "saas" | "retainer" | null;
  trackChanged: boolean;
  rescoreBreakdown: RescoreBreakdown;
}

// ── SaaS track scorer (§6.1) ───────────────────────────────────────────

/**
 * Score a viability profile for the SaaS track.
 * Pure function — no I/O, no side effects, fully unit-testable.
 */
export function scoreForSaasTrack(
  profile: ViabilityProfile,
  softAdjustment: number = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean } {
  const advertising = scoreSaasAdvertising(profile);
  const web = scoreSaasWeb(profile);
  const social = scoreSaasSocial(profile);
  const maps = scoreSaasMaps(profile);

  const rawTotal = advertising + web + social + maps + softAdjustment;
  const total = clamp(rawTotal, 0, 100);

  return {
    score: total,
    breakdown: { advertising, web, social, maps, total, floor: SAAS_FLOOR },
    qualifies: total >= SAAS_FLOOR,
  };
}

// ── Retainer track scorer (§6.1) ───────────────────────────────────────

/**
 * Score a viability profile for the Retainer track.
 * Pure function — no I/O, no side effects, fully unit-testable.
 */
export function scoreForRetainerTrack(
  profile: ViabilityProfile,
  softAdjustment: number = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean } {
  const advertising = scoreRetainerAdvertising(profile);
  const web = scoreRetainerWeb(profile);
  const social = scoreRetainerSocial(profile);
  const maps = scoreRetainerMaps(profile);

  const rawTotal = advertising + web + social + maps + softAdjustment;
  const total = clamp(rawTotal, 0, 100);

  return {
    score: total,
    breakdown: {
      advertising,
      web,
      social,
      maps,
      total,
      floor: RETAINER_FLOOR,
    },
    qualifies: total >= RETAINER_FLOOR,
  };
}

// ── Winner-takes-all track assignment (§6.3) ───────────────────────────

export function assignTrack(
  profile: ViabilityProfile,
  softAdjustment: number = 0,
): TrackAssignment {
  const saas = scoreForSaasTrack(profile, softAdjustment);
  const retainer = scoreForRetainerTrack(profile, softAdjustment);

  if (!saas.qualifies && !retainer.qualifies) {
    return { track: null, score: 0, saas, retainer };
  }
  if (saas.qualifies && !retainer.qualifies) {
    return { track: "saas", score: saas.score, saas, retainer };
  }
  if (retainer.qualifies && !saas.qualifies) {
    return { track: "retainer", score: retainer.score, saas, retainer };
  }
  // Both qualify — highest score wins
  return saas.score >= retainer.score
    ? { track: "saas", score: saas.score, saas, retainer }
    : { track: "retainer", score: retainer.score, saas, retainer };
}

// ── Reactive ICP scoring (§16) ─────────────────────────────────────────

/**
 * Rescore a candidate using post-send engagement signals.
 * Pure function (§12.U) — deterministic rules, no LLM call.
 */
export function rescoreCandidate(args: {
  currentSaasScore: number;
  currentRetainerScore: number;
  currentTrack: "saas" | "retainer";
  viabilityProfile: ViabilityProfile;
  engagementHistory: EngagementEvent[];
  replyClassifications: ReplyClassification[];
  touchesSent: number;
  fileNotes: FileNote[];
  hardBounced: boolean;
  trackChangeUsed: boolean;
  earliestReplyMs?: number | null;
  earliestTouchMs?: number | null;
}): RescoreResult {
  // Engagement adjustments (§16.4)
  const clicks = args.engagementHistory.filter((e) => e.tier === 1).length;
  const fullOpens = args.engagementHistory.filter((e) => e.tier === 2).length;
  const noneEvents = args.engagementHistory.filter((e) => e.tier === 4).length;

  const clickAdj = Math.min(clicks * 5, 15);
  const fullOpenAdj = Math.min(fullOpens * 2, 6);
  const noneAdj = Math.max(noneEvents * -2, -8);
  const engagement = clickAdj + fullOpenAdj + noneAdj;

  // Reply adjustments
  const hasPositive = args.replyClassifications.some(
    (r) => r.intent === "positive",
  );
  const hasObjectionOrQuestion = args.replyClassifications.some(
    (r) => r.intent === "objection" || r.intent === "question",
  );
  const hasNegative = args.replyClassifications.some(
    (r) => r.intent === "negative",
  );
  let reply = 0;
  if (hasPositive) reply += 12;
  if (hasObjectionOrQuestion) reply += 5;
  if (hasNegative) reply += -15;

  // Responsiveness pattern
  let responsiveness = 0;
  if (args.earliestReplyMs != null && args.earliestTouchMs != null) {
    const replyDelayMs = args.earliestReplyMs - args.earliestTouchMs;
    const replyDelayHours = replyDelayMs / (1000 * 60 * 60);
    if (replyDelayHours <= 24) {
      responsiveness = 4;
    } else if (replyDelayHours <= 72) {
      responsiveness = 2;
    }
  }
  if (
    args.touchesSent >= 3 &&
    args.replyClassifications.length === 0
  ) {
    responsiveness = -3;
  }

  // File note adjustment
  const fileNote = args.fileNotes.length > 0 ? 3 : 0;

  // Hard bounce
  const hardBounce = args.hardBounced ? -10 : 0;

  const rawTotal = engagement + reply + responsiveness + fileNote + hardBounce;
  const clampedTotal = clamp(rawTotal, REACTIVE_MIN, REACTIVE_MAX);

  // Recompute base scores from viability profile + reactive adjustment
  const saasBase = scoreForSaasTrack(args.viabilityProfile);
  const retainerBase = scoreForRetainerTrack(args.viabilityProfile);

  const saasScore = clamp(saasBase.score + clampedTotal, 0, 100);
  const retainerScore = clamp(retainerBase.score + clampedTotal, 0, 100);

  // Track assignment on rescored values
  const saasQualifies = saasScore >= SAAS_FLOOR;
  const retainerQualifies = retainerScore >= RETAINER_FLOOR;

  let qualifiedTrack: "saas" | "retainer" | null = null;
  if (saasQualifies && retainerQualifies) {
    qualifiedTrack =
      saasScore >= retainerScore ? "saas" : "retainer";
  } else if (saasQualifies) {
    qualifiedTrack = "saas";
  } else if (retainerQualifies) {
    qualifiedTrack = "retainer";
  }

  // Track change detection (§16.5, §12.W — capped at one per candidate)
  let trackChanged = false;
  if (
    qualifiedTrack !== null &&
    qualifiedTrack !== args.currentTrack &&
    !args.trackChangeUsed
  ) {
    trackChanged = true;
  }

  return {
    saasScore,
    retainerScore,
    qualifiedTrack: trackChanged ? qualifiedTrack! : args.currentTrack,
    trackChanged,
    rescoreBreakdown: {
      engagement,
      reply,
      responsiveness,
      fileNote,
      hardBounce,
      rawTotal,
      clampedTotal,
    },
  };
}

// ── SaaS sub-scorers ───────────────────────────────────────────────────
// SaaS prospects: lean teams, DIY-leaning, lower-revenue, budget-conscious.
// The signals that matter most: are they already marketing (ads), do they
// have a web presence, is the team small enough to want a SaaS product.

function scoreSaasAdvertising(p: ViabilityProfile): number {
  let score = 0;

  // Meta ads — running ads = marketing budget exists
  if (p.meta_ads) {
    if (p.meta_ads.has_active_creatives) score += 5;
    if (p.meta_ads.active_ad_count >= 3) score += 3;
    const spend = p.meta_ads.estimated_spend_bracket;
    if (spend === "low") score += 2;
    if (spend === "medium") score += 4;
    if (spend === "high") score += 2; // high spend = maybe too big for SaaS
  }

  // Google ads
  if (p.google_ads) {
    if (p.google_ads.has_active_campaigns) score += 4;
    if (p.google_ads.active_creative_count >= 3) score += 2;
  }

  return clamp(score, 0, 20);
}

function scoreSaasWeb(p: ViabilityProfile): number {
  let score = 0;

  if (p.website) {
    // PageSpeed: lower scores = DIY site = SaaS fit
    const ps = p.website.pagespeed_performance_score;
    if (ps !== null && ps !== undefined) {
      if (ps < 40) score += 5; // bad site = needs help
      else if (ps < 70) score += 3;
      else score += 1; // good site = may not need SaaS
    }

    // Domain age — newer businesses more likely to use SaaS
    const age = p.website.domain_age_years;
    if (age !== null && age !== undefined) {
      if (age < 2) score += 4;
      else if (age < 5) score += 2;
    }

    if (p.website.has_about_page) score += 1;
    if (p.website.has_pricing_page) score += 2;

    // Team size — solo/small is perfect SaaS fit
    const team = p.website.team_size_signal;
    if (team === "solo") score += 6;
    else if (team === "small") score += 4;
    else if (team === "medium") score += 1;
    // large = retainer territory

    // Pricing tier — budget/mid = SaaS fit
    const tier = p.website.stated_pricing_tier;
    if (tier === "budget") score += 3;
    else if (tier === "mid") score += 2;
    else if (tier === "premium") score += 1;
  }

  return clamp(score, 0, 30);
}

function scoreSaasSocial(p: ViabilityProfile): number {
  let score = 0;

  if (p.instagram) {
    // Moderate presence = SaaS fit; big presence = retainer
    if (p.instagram.follower_count > 0 && p.instagram.follower_count <= 5000)
      score += 5;
    else if (p.instagram.follower_count > 5000) score += 2;

    if (p.instagram.posts_last_30d !== null && p.instagram.posts_last_30d > 0)
      score += 3;
  }

  if (p.youtube) {
    // Any YouTube = content-aware business
    if (p.youtube.video_count > 0) score += 2;
    if (
      p.youtube.uploads_last_90d !== null &&
      p.youtube.uploads_last_90d > 0
    )
      score += 2;
  }

  return clamp(score, 0, 25);
}

function scoreSaasMaps(p: ViabilityProfile): number {
  let score = 0;

  if (p.maps) {
    // Reviews = real business
    if (p.maps.review_count >= 5) score += 3;
    if (p.maps.review_count >= 20) score += 2;

    // Good rating
    if (p.maps.rating !== null && p.maps.rating >= 4.0) score += 3;

    // Photos = visual business
    if (p.maps.photo_count >= 5) score += 2;

    // Recent photo = still active
    if (p.maps.last_photo_date) {
      const photoAge = daysSince(p.maps.last_photo_date);
      if (photoAge !== null && photoAge < 180) score += 2;
    }
  }

  return clamp(score, 0, 25);
}

// ── Retainer sub-scorers ───────────────────────────────────────────────
// Retainer prospects: established, larger teams, higher revenue, already
// investing in marketing. The signals that matter: are they spending real
// money on ads, big web presence, large social followings.

function scoreRetainerAdvertising(p: ViabilityProfile): number {
  let score = 0;

  if (p.meta_ads) {
    if (p.meta_ads.has_active_creatives) score += 3;
    if (p.meta_ads.active_ad_count >= 5) score += 4;
    const spend = p.meta_ads.estimated_spend_bracket;
    if (spend === "medium") score += 3;
    if (spend === "high") score += 6;
  }

  if (p.google_ads) {
    if (p.google_ads.has_active_campaigns) score += 3;
    if (p.google_ads.active_creative_count >= 5) score += 3;
  }

  return clamp(score, 0, 25);
}

function scoreRetainerWeb(p: ViabilityProfile): number {
  let score = 0;

  if (p.website) {
    // PageSpeed: higher = existing investment in web
    const ps = p.website.pagespeed_performance_score;
    if (ps !== null && ps !== undefined) {
      if (ps >= 70) score += 4;
      else if (ps >= 40) score += 2;
    }

    // Domain age — established businesses
    const age = p.website.domain_age_years;
    if (age !== null && age !== undefined) {
      if (age >= 5) score += 5;
      else if (age >= 2) score += 3;
      else score += 1;
    }

    if (p.website.has_about_page) score += 2;
    if (p.website.has_pricing_page) score += 1;

    // Team size — medium/large is retainer territory
    const team = p.website.team_size_signal;
    if (team === "large") score += 6;
    else if (team === "medium") score += 4;
    else if (team === "small") score += 1;

    // Pricing tier — premium = high LTV
    const tier = p.website.stated_pricing_tier;
    if (tier === "premium") score += 4;
    else if (tier === "mid") score += 2;
  }

  return clamp(score, 0, 30);
}

function scoreRetainerSocial(p: ViabilityProfile): number {
  let score = 0;

  if (p.instagram) {
    // Large following = content investment = retainer fit
    if (p.instagram.follower_count > 10000) score += 6;
    else if (p.instagram.follower_count > 5000) score += 4;
    else if (p.instagram.follower_count > 1000) score += 2;

    if (p.instagram.posts_last_30d !== null && p.instagram.posts_last_30d >= 4)
      score += 3;
  }

  if (p.youtube) {
    // YouTube presence = long-form content investment
    if (p.youtube.subscriber_count > 1000) score += 4;
    else if (p.youtube.video_count > 10) score += 2;

    if (
      p.youtube.uploads_last_90d !== null &&
      p.youtube.uploads_last_90d >= 3
    )
      score += 2;
  }

  return clamp(score, 0, 25);
}

function scoreRetainerMaps(p: ViabilityProfile): number {
  let score = 0;

  if (p.maps) {
    if (p.maps.review_count >= 20) score += 3;
    if (p.maps.review_count >= 50) score += 2;

    if (p.maps.rating !== null && p.maps.rating >= 4.5) score += 3;
    else if (p.maps.rating !== null && p.maps.rating >= 4.0) score += 2;

    if (p.maps.photo_count >= 10) score += 2;

    if (p.maps.last_photo_date) {
      const photoAge = daysSince(p.maps.last_photo_date);
      if (photoAge !== null && photoAge < 90) score += 3;
    }
  }

  return clamp(score, 0, 20);
}

// ── Helpers ────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysSince(isoDate: string): number | null {
  const parsed = Date.parse(isoDate);
  if (isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
}
