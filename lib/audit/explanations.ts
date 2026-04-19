import { invokeLlmText } from "@/lib/ai/invoke";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import type { CategoryScore, AuditCategory } from "./scoring";

export type CategoryExplanations = Record<AuditCategory, string>;

export async function generateCategoryExplanations(
  categoryScores: CategoryScore[],
  profile: ViabilityProfile,
  businessName: string,
): Promise<CategoryExplanations> {
  const results = await Promise.allSettled(
    categoryScores
      .filter((c) => c.available)
      .map(async (cs) => {
        const signals = describeSignals(cs.category, profile);
        const prompt = [
          `You are a marketing auditor. Write a 2–3 sentence plain-English explanation of this business's marketing performance in the "${cs.category}" category.`,
          `Business: ${businessName}`,
          `Grade: ${cs.grade} (score: ${cs.score}/100)`,
          `Signals: ${signals}`,
          "",
          "Be honest, specific, and direct. Not a recommendation — just what the signals show. No jargon. No exclamation marks. Voice: dry, observational.",
        ].join("\n");

        const text = await invokeLlmText({
          job: "audit-category-explanation",
          prompt,
          maxTokens: 200,
        });
        return { category: cs.category, text };
      }),
  );

  const explanations: Partial<CategoryExplanations> = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      explanations[result.value.category] = result.value.text;
    }
  }

  // Fill unavailable categories
  for (const cs of categoryScores) {
    if (!cs.available) {
      explanations[cs.category] = "We couldn't check this one — not enough data available.";
    }
  }

  return explanations as CategoryExplanations;
}

function describeSignals(
  category: AuditCategory,
  profile: ViabilityProfile,
): string {
  switch (category) {
    case "advertising": {
      const parts: string[] = [];
      if (profile.meta_ads) {
        parts.push(
          `Meta Ads: ${profile.meta_ads.active_ad_count} active, spend bracket: ${profile.meta_ads.estimated_spend_bracket}`,
        );
      } else {
        parts.push("No Meta Ads detected");
      }
      if (profile.google_ads) {
        parts.push(
          `Google Ads: ${profile.google_ads.active_creative_count} creatives, campaigns: ${profile.google_ads.has_active_campaigns ? "yes" : "no"}`,
        );
      } else {
        parts.push("No Google Ads detected");
      }
      return parts.join(". ");
    }
    case "social": {
      const parts: string[] = [];
      if (profile.instagram) {
        parts.push(
          `Instagram: ${profile.instagram.follower_count} followers, ${profile.instagram.post_count} posts, ${profile.instagram.posts_last_30d ?? "unknown"} posts in last 30d`,
        );
      } else {
        parts.push("No Instagram detected");
      }
      if (profile.youtube) {
        parts.push(
          `YouTube: ${profile.youtube.subscriber_count} subscribers, ${profile.youtube.video_count} videos, ${profile.youtube.uploads_last_90d ?? "unknown"} uploads in last 90d`,
        );
      } else {
        parts.push("No YouTube detected");
      }
      return parts.join(". ");
    }
    case "website": {
      if (!profile.website) return "No website data available";
      const parts: string[] = [];
      if (profile.website.pagespeed_performance_score !== null) {
        parts.push(`PageSpeed: ${profile.website.pagespeed_performance_score}/100`);
      }
      if (profile.website.domain_age_years !== null) {
        parts.push(`Domain age: ${profile.website.domain_age_years} years`);
      }
      parts.push(`About page: ${profile.website.has_about_page ? "yes" : "no"}`);
      parts.push(`Pricing page: ${profile.website.has_pricing_page ? "yes" : "no"}`);
      parts.push(`Team size signal: ${profile.website.team_size_signal}`);
      return parts.join(". ");
    }
    case "reputation": {
      if (!profile.maps) return "No Google Maps listing found";
      const parts: string[] = [];
      if (profile.maps.rating !== null) parts.push(`Rating: ${profile.maps.rating}/5`);
      parts.push(`${profile.maps.review_count} reviews`);
      parts.push(`${profile.maps.photo_count} photos`);
      if (profile.maps.last_photo_date) {
        parts.push(`Last photo: ${profile.maps.last_photo_date}`);
      }
      return parts.join(". ");
    }
    case "content": {
      const parts: string[] = [];
      if (profile.instagram?.posts_last_30d !== null && profile.instagram) {
        parts.push(`Instagram: ${profile.instagram.posts_last_30d} posts in last 30d`);
      }
      if (profile.youtube?.uploads_last_90d !== null && profile.youtube) {
        parts.push(`YouTube: ${profile.youtube.uploads_last_90d} uploads in last 90d`);
      }
      if (parts.length === 0) parts.push("Limited content signals available");
      return parts.join(". ");
    }
  }
}
