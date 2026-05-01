import {
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  SIGNAL_DEFINITIONS,
} from "@/lib/brand-dna/signal-definitions";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

export interface DomainPresenceScore {
  domain: string;
  domainLabel: string;
  domainColor: string;
  dnaStrength: number;
  presenceStrength: number;
}

const DOMAINS = ["aesthetic", "communication", "values", "creative", "aspiration"] as const;

export function buildPresenceScores(
  signalTags: string | null,
  enrichmentData: ViabilityProfile | null,
): DomainPresenceScore[] {
  const tagMap = parseTagMap(signalTags);
  const maxFreq = Math.max(1, ...Object.values(tagMap));

  const domainDnaScores: Record<string, number> = {};
  for (const domain of DOMAINS) domainDnaScores[domain] = 0;

  for (const [tag, freq] of Object.entries(tagMap)) {
    const def = SIGNAL_DEFINITIONS[tag];
    if (def) {
      domainDnaScores[def.domain] = Math.max(domainDnaScores[def.domain] ?? 0, freq / maxFreq);
    }
  }

  const presenceScores = computePresenceScores(enrichmentData);

  return DOMAINS.map((domain) => ({
    domain,
    domainLabel: DOMAIN_LABELS[domain],
    domainColor: DOMAIN_COLORS[domain],
    dnaStrength: domainDnaScores[domain] ?? 0,
    presenceStrength: presenceScores[domain] ?? 0,
  }));
}

function computePresenceScores(
  data: ViabilityProfile | null,
): Record<string, number> {
  if (!data) return {};
  const scores: Record<string, number> = {};

  // Aesthetic: Instagram + website quality
  {
    let score = 0;
    let signals = 0;
    if (data.instagram) {
      signals++;
      const posting = data.instagram.posts_last_30d;
      if (posting !== null && posting !== undefined) {
        score += Math.min(posting / 8, 1);
      }
      if (data.instagram.follower_count > 500) score += 0.3;
    }
    if (data.website?.pagespeed_performance_score !== null && data.website?.pagespeed_performance_score !== undefined) {
      signals++;
      score += data.website.pagespeed_performance_score / 100;
    }
    scores.aesthetic = signals > 0 ? Math.min(score / Math.max(signals, 1), 1) : 0;
  }

  // Communication: Facebook + LinkedIn + content quality
  {
    let score = 0;
    let signals = 0;
    if (data.facebook) {
      signals++;
      if (data.facebook.has_active_page && data.facebook.posts_last_30d !== null && data.facebook.posts_last_30d > 0) {
        score += Math.min(data.facebook.posts_last_30d / 4, 1);
      }
    }
    if (data.linkedin) {
      signals++;
      if (data.linkedin.has_active_page) score += 0.6;
      if (data.linkedin.follower_count && data.linkedin.follower_count > 100) score += 0.4;
    }
    if (data.website_content?.content_quality) {
      signals++;
      const q = data.website_content.content_quality;
      score += q === "excellent" ? 1 : q === "good" ? 0.7 : q === "basic" ? 0.4 : q === "poor" ? 0.15 : 0;
    }
    scores.communication = signals > 0 ? Math.min(score / Math.max(signals, 1), 1) : 0;
  }

  // Values: Google reviews + about page
  {
    let score = 0;
    let signals = 0;
    if (data.maps) {
      signals++;
      if (data.maps.rating !== null && data.maps.rating >= 4.0) score += 0.5;
      if (data.maps.review_count >= 20) score += 0.5;
      else if (data.maps.review_count >= 5) score += 0.25;
    }
    if (data.website) {
      signals++;
      if (data.website.has_about_page) score += 0.7;
    }
    scores.values = signals > 0 ? Math.min(score / Math.max(signals, 1), 1) : 0;
  }

  // Creative: YouTube + TikTok
  {
    let score = 0;
    let signals = 0;
    if (data.youtube) {
      signals++;
      if (data.youtube.video_count > 0) score += 0.4;
      if (data.youtube.uploads_last_90d !== null && data.youtube.uploads_last_90d > 0) score += 0.6;
    }
    if (data.tiktok) {
      signals++;
      if (data.tiktok.has_active_profile) score += 0.5;
      if (data.tiktok.posts_last_30d !== null && data.tiktok.posts_last_30d > 0) score += 0.5;
    }
    scores.creative = signals > 0 ? Math.min(score / Math.max(signals, 1), 1) : 0;
  }

  // Aspiration: breadth of presence + ads activity
  {
    let breadth = 0;
    if (data.instagram) breadth++;
    if (data.facebook?.has_active_page) breadth++;
    if (data.linkedin?.has_active_page) breadth++;
    if (data.youtube && data.youtube.video_count > 0) breadth++;
    if (data.tiktok?.has_active_profile) breadth++;
    if (data.maps) breadth++;

    let score = Math.min(breadth / 4, 1);

    if (data.meta_ads?.has_active_creatives) score = Math.min(score + 0.3, 1);
    if (data.google_ads?.has_active_campaigns) score = Math.min(score + 0.2, 1);

    scores.aspiration = score;
  }

  return scores;
}

function parseTagMap(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
  } catch { /* skip */ }
  return {};
}
