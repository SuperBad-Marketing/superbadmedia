import type { ViabilityProfile } from "@/lib/lead-gen/types";

export const AUDIT_CATEGORIES = [
  "advertising",
  "social",
  "website",
  "reputation",
  "content",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export interface CategoryScore {
  category: AuditCategory;
  score: number;
  grade: string;
  available: boolean;
}

export interface OverallScore {
  score: number;
  grade: string;
}

const CATEGORY_WEIGHTS: Record<AuditCategory, number> = {
  advertising: 25,
  social: 20,
  website: 25,
  reputation: 20,
  content: 10,
};

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "A−";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "B−";
  if (score >= 40) return "C+";
  if (score >= 30) return "C";
  if (score >= 20) return "C−";
  if (score >= 10) return "D";
  return "F";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreAdvertising(p: ViabilityProfile): { score: number; available: boolean } {
  if (!p.meta_ads && !p.google_ads) return { score: 0, available: false };

  let score = 0;

  if (p.meta_ads) {
    if (p.meta_ads.has_active_creatives) score += 15;
    if (p.meta_ads.active_ad_count >= 3) score += 10;
    else if (p.meta_ads.active_ad_count >= 1) score += 5;
    const spend = p.meta_ads.estimated_spend_bracket;
    if (spend === "high") score += 20;
    else if (spend === "medium") score += 12;
    else if (spend === "low") score += 5;
  }

  if (p.google_ads) {
    if (p.google_ads.has_active_campaigns) score += 15;
    if (p.google_ads.active_creative_count >= 5) score += 15;
    else if (p.google_ads.active_creative_count >= 3) score += 10;
    else if (p.google_ads.active_creative_count >= 1) score += 5;
  }

  return { score: clamp(score, 0, 100), available: true };
}

function scoreSocial(p: ViabilityProfile): { score: number; available: boolean } {
  if (!p.instagram && !p.youtube) return { score: 0, available: false };

  let score = 0;

  if (p.instagram) {
    if (p.instagram.follower_count > 10000) score += 25;
    else if (p.instagram.follower_count > 5000) score += 20;
    else if (p.instagram.follower_count > 1000) score += 15;
    else if (p.instagram.follower_count > 100) score += 8;
    else if (p.instagram.follower_count > 0) score += 3;

    if (p.instagram.posts_last_30d !== null) {
      if (p.instagram.posts_last_30d >= 8) score += 15;
      else if (p.instagram.posts_last_30d >= 4) score += 10;
      else if (p.instagram.posts_last_30d >= 1) score += 5;
    }

    if (p.instagram.post_count > 100) score += 5;
  }

  if (p.youtube) {
    if (p.youtube.subscriber_count > 1000) score += 15;
    else if (p.youtube.subscriber_count > 100) score += 8;
    else if (p.youtube.subscriber_count > 0) score += 3;

    if (p.youtube.uploads_last_90d !== null) {
      if (p.youtube.uploads_last_90d >= 6) score += 10;
      else if (p.youtube.uploads_last_90d >= 3) score += 7;
      else if (p.youtube.uploads_last_90d >= 1) score += 3;
    }
  }

  return { score: clamp(score, 0, 100), available: true };
}

function scoreWebsite(p: ViabilityProfile): { score: number; available: boolean } {
  if (!p.website) return { score: 0, available: false };

  let score = 0;

  const ps = p.website.pagespeed_performance_score;
  if (ps !== null && ps !== undefined) {
    if (ps >= 90) score += 25;
    else if (ps >= 70) score += 18;
    else if (ps >= 50) score += 12;
    else if (ps >= 30) score += 6;
    else score += 2;
  }

  const age = p.website.domain_age_years;
  if (age !== null && age !== undefined) {
    if (age >= 10) score += 15;
    else if (age >= 5) score += 12;
    else if (age >= 2) score += 8;
    else if (age >= 1) score += 4;
    else score += 1;
  }

  if (p.website.has_about_page) score += 10;
  if (p.website.has_pricing_page) score += 10;

  const team = p.website.team_size_signal;
  if (team === "large") score += 12;
  else if (team === "medium") score += 10;
  else if (team === "small") score += 6;
  else if (team === "solo") score += 3;

  const tier = p.website.stated_pricing_tier;
  if (tier === "premium") score += 10;
  else if (tier === "mid") score += 7;
  else if (tier === "budget") score += 4;

  return { score: clamp(score, 0, 100), available: true };
}

function scoreReputation(p: ViabilityProfile): { score: number; available: boolean } {
  if (!p.maps) return { score: 0, available: false };

  let score = 0;

  if (p.maps.rating !== null) {
    if (p.maps.rating >= 4.8) score += 30;
    else if (p.maps.rating >= 4.5) score += 25;
    else if (p.maps.rating >= 4.0) score += 18;
    else if (p.maps.rating >= 3.5) score += 10;
    else score += 3;
  }

  if (p.maps.review_count >= 100) score += 25;
  else if (p.maps.review_count >= 50) score += 20;
  else if (p.maps.review_count >= 20) score += 15;
  else if (p.maps.review_count >= 5) score += 8;
  else if (p.maps.review_count > 0) score += 3;

  if (p.maps.photo_count >= 20) score += 15;
  else if (p.maps.photo_count >= 10) score += 10;
  else if (p.maps.photo_count >= 5) score += 5;

  if (p.maps.last_photo_date) {
    const photoAge = daysSince(p.maps.last_photo_date);
    if (photoAge !== null) {
      if (photoAge < 30) score += 15;
      else if (photoAge < 90) score += 10;
      else if (photoAge < 180) score += 5;
    }
  }

  return { score: clamp(score, 0, 100), available: true };
}

function scoreContent(p: ViabilityProfile): { score: number; available: boolean } {
  let hasData = false;
  let score = 0;

  if (p.website) {
    hasData = true;
    // Blog presence inferred from website scrape
  }

  if (p.youtube) {
    hasData = true;
    if (p.youtube.uploads_last_90d !== null) {
      if (p.youtube.uploads_last_90d >= 6) score += 25;
      else if (p.youtube.uploads_last_90d >= 3) score += 15;
      else if (p.youtube.uploads_last_90d >= 1) score += 8;
    }
    if (p.youtube.video_count > 20) score += 10;
    else if (p.youtube.video_count > 5) score += 5;
  }

  if (p.instagram) {
    hasData = true;
    if (p.instagram.posts_last_30d !== null) {
      if (p.instagram.posts_last_30d >= 8) score += 25;
      else if (p.instagram.posts_last_30d >= 4) score += 15;
      else if (p.instagram.posts_last_30d >= 1) score += 8;
    }
    if (p.instagram.post_count > 200) score += 10;
    else if (p.instagram.post_count > 50) score += 5;
  }

  // Social handle presence itself is a signal
  if (p.instagram) score += 5;
  if (p.youtube) score += 5;

  if (!hasData) return { score: 0, available: false };
  return { score: clamp(score, 0, 100), available: true };
}

const SCORERS: Record<AuditCategory, (p: ViabilityProfile) => { score: number; available: boolean }> = {
  advertising: scoreAdvertising,
  social: scoreSocial,
  website: scoreWebsite,
  reputation: scoreReputation,
  content: scoreContent,
};

export function scoreAuditCategory(
  category: AuditCategory,
  profile: ViabilityProfile,
): CategoryScore {
  const { score, available } = SCORERS[category](profile);
  return {
    category,
    score,
    grade: available ? scoreToGrade(score) : "N/A",
    available,
  };
}

export function scoreAuditOverall(
  categoryScores: CategoryScore[],
): OverallScore {
  const available = categoryScores.filter((c) => c.available);
  if (available.length === 0) return { score: 0, grade: "N/A" };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const cs of available) {
    const weight = CATEGORY_WEIGHTS[cs.category];
    weightedSum += cs.score * weight;
    totalWeight += weight;
  }

  const score = Math.round(weightedSum / totalWeight);
  return { score, grade: scoreToGrade(score) };
}

function daysSince(isoDate: string): number | null {
  const parsed = Date.parse(isoDate);
  if (isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
}
