import type { ViabilityProfile } from "./types";

export type ScoringBreakdown = Record<string, number>;

export const SAAS_QUALIFICATION_FLOOR = 40;
export const RETAINER_QUALIFICATION_FLOOR = 55;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * SaaS track scorer — prefers lean teams, no/low ad spend, basic web presence.
 * Max raw score = 100 (team_size:30, has_about_page:10, pagespeed:15, low_ad_spend:25, domain_age:20).
 * Missing signals contribute 0 (graceful degradation).
 */
export function scoreForSaasTrack(
  profile: Partial<ViabilityProfile>,
  softAdjustment = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean } {
  const breakdown: ScoringBreakdown = {};

  // team_size_signal — max 30: SaaS favours solo/small operators
  const teamSize = profile.website?.team_size_signal;
  breakdown.team_size =
    teamSize === "solo" ? 30
    : teamSize === "small" ? 20
    : teamSize === "medium" ? 5
    : 0;

  // has_about_page — max 10
  breakdown.has_about_page = profile.website?.has_about_page === true ? 10 : 0;

  // pagespeed_performance_score — max 15 (score × 0.15)
  const psi = profile.website?.pagespeed_performance_score;
  breakdown.pagespeed = psi != null ? Math.round(psi * 0.15) : 0;

  // low_ad_spend — max 25: SaaS favours no/low Meta ad spend
  const metaAds = profile.meta_ads;
  breakdown.low_ad_spend =
    metaAds == null ? 0
    : metaAds.active_ad_count === 0 || metaAds.estimated_spend_bracket === "unknown" ? 25
    : metaAds.estimated_spend_bracket === "low" ? 15
    : metaAds.estimated_spend_bracket === "medium" ? 5
    : 0; // high spend

  // domain_age_years — max 20: SaaS favours younger/growing businesses
  const age = profile.website?.domain_age_years;
  breakdown.domain_age =
    age == null ? 0
    : age < 1 ? 8
    : age < 3 ? 20
    : age < 7 ? 15
    : 8;

  const raw = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const score = clamp(raw + softAdjustment, 0, 100);

  return { score, breakdown, qualifies: score >= SAAS_QUALIFICATION_FLOOR };
}

/**
 * Retainer track scorer — prefers ad spend, social presence, established business.
 * Max raw score = 100 (meta_ad_spend:25, google_ads:10, instagram_followers:15,
 * youtube_subscribers:10, domain_age:10, maps_review_count:8, maps_rating:5,
 * pagespeed:7, has_pricing_page:5, team_size:5).
 * Missing signals contribute 0 (graceful degradation).
 */
export function scoreForRetainerTrack(
  profile: Partial<ViabilityProfile>,
  softAdjustment = 0,
): { score: number; breakdown: ScoringBreakdown; qualifies: boolean } {
  const breakdown: ScoringBreakdown = {};

  // meta_ad_spend — max 25: retainer favours active ad spend
  const metaAds = profile.meta_ads;
  breakdown.meta_ad_spend =
    metaAds == null ? 0
    : metaAds.estimated_spend_bracket === "high" ? 25
    : metaAds.estimated_spend_bracket === "medium" ? 18
    : metaAds.estimated_spend_bracket === "low" ? 8
    : 0;

  // google_ads — max 10
  breakdown.google_ads = profile.google_ads?.has_active_campaigns === true ? 10 : 0;

  // instagram_followers — max 15
  const followers = profile.instagram?.follower_count ?? 0;
  breakdown.instagram_followers =
    profile.instagram == null ? 0
    : followers >= 5000 ? 15
    : followers >= 1000 ? 10
    : followers >= 100 ? 5
    : 0;

  // youtube_subscribers — max 10
  const subs = profile.youtube?.subscriber_count ?? 0;
  breakdown.youtube_subscribers =
    profile.youtube == null ? 0
    : subs >= 1000 ? 10
    : subs >= 100 ? 5
    : 0;

  // domain_age_years — max 10: retainer favours established businesses
  const age = profile.website?.domain_age_years;
  breakdown.domain_age =
    age == null ? 0
    : age >= 3 ? 10
    : age >= 1 ? 5
    : 2;

  // maps_review_count — max 8
  const reviewCount = profile.maps?.review_count ?? 0;
  breakdown.maps_review_count =
    profile.maps == null ? 0
    : reviewCount >= 50 ? 8
    : reviewCount >= 10 ? 6
    : reviewCount >= 1 ? 3
    : 0;

  // maps_rating — max 5
  const rating = profile.maps?.rating ?? null;
  breakdown.maps_rating =
    rating == null ? 0
    : rating >= 4 ? 5
    : rating >= 3 ? 2
    : 0;

  // pagespeed_performance_score — max 7 (score × 0.07)
  const psi = profile.website?.pagespeed_performance_score;
  breakdown.pagespeed = psi != null ? Math.round(psi * 0.07) : 0;

  // has_pricing_page — max 5
  breakdown.has_pricing_page = profile.website?.has_pricing_page === true ? 5 : 0;

  // team_size_signal — max 5: retainer favours medium/large teams
  const teamSize = profile.website?.team_size_signal;
  breakdown.team_size =
    teamSize === "large" ? 5
    : teamSize === "medium" ? 3
    : 0;

  const raw = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const score = clamp(raw + softAdjustment, 0, 100);

  return { score, breakdown, qualifies: score >= RETAINER_QUALIFICATION_FLOOR };
}

/**
 * Winner-takes-all track assignment. Returns the qualifying track with the higher score,
 * or null if neither track meets its qualification floor.
 */
export function assignTrack(
  profile: Partial<ViabilityProfile>,
): { track: "saas" | "retainer" | null; score: number } {
  const saas = scoreForSaasTrack(profile);
  const retainer = scoreForRetainerTrack(profile);

  if (!saas.qualifies && !retainer.qualifies) return { track: null, score: 0 };
  if (saas.qualifies && !retainer.qualifies) return { track: "saas", score: saas.score };
  if (retainer.qualifies && !saas.qualifies) return { track: "retainer", score: retainer.score };
  return saas.score >= retainer.score
    ? { track: "saas", score: saas.score }
    : { track: "retainer", score: retainer.score };
}
