import type { ViabilityProfile } from "../types";
import type { TrackAssignment } from "../scoring";
import { assignTrack } from "../scoring";
import { crawlWebsiteContent } from "../sources/apify-website-crawler";
import {
  scrapeFacebookPage,
  applyFacebookToProfile,
} from "../sources/apify-facebook-page";
import {
  scrapeLinkedInCompany,
  applyLinkedInToProfile,
} from "../sources/apify-linkedin-company";
import {
  scrapeTikTokProfile,
  applyTikTokToProfile,
} from "../sources/apify-tiktok-profile";
import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";

const SOFT_ADJUSTMENT_CAP = 5;

export interface DeepEnrichmentInput {
  companyName: string;
  domain: string | null;
  currentProfile: ViabilityProfile;
  currentAssignment: TrackAssignment;
}

export interface DeepEnrichmentResult {
  profile: ViabilityProfile;
  softAdjustment: number;
  adjustmentReasons: string[];
  reassignment: TrackAssignment;
  actorsAttempted: number;
  actorsSucceeded: number;
  durationMs: number;
  scrapedContacts: Array<{ email: string; phone: string | null; source: string }>;
}

export async function deepEnrichCandidate(
  input: DeepEnrichmentInput,
): Promise<DeepEnrichmentResult> {
  const start = Date.now();
  let profile: Partial<ViabilityProfile> = { ...input.currentProfile };
  let actorsAttempted = 0;
  let actorsSucceeded = 0;
  const scrapedContacts: DeepEnrichmentResult["scrapedContacts"] = [];

  const tasks: Array<{
    name: string;
    run: () => Promise<void>;
  }> = [];

  if (input.domain) {
    tasks.push({
      name: "website_crawler",
      run: async () => {
        const result = await crawlWebsiteContent(input.domain!);
        if (result.pages.length > 0) {
          actorsSucceeded++;
          const distilled = await distillWebsiteContent(
            result.pages,
            input.companyName,
          );
          profile = {
            ...profile,
            website_content: distilled,
          };
        }
        if (result.error) {
          profile = {
            ...profile,
            fetch_errors: {
              ...profile.fetch_errors,
              website_crawler: result.error,
            },
          };
        }
      },
    });
  }

  tasks.push({
    name: "facebook",
    run: async () => {
      const result = await scrapeFacebookPage(
        input.companyName,
        input.domain,
      );
      profile = applyFacebookToProfile(profile, result);
      if (result.has_active_page) actorsSucceeded++;
      if (result.scraped_email) {
        scrapedContacts.push({
          email: result.scraped_email,
          phone: result.scraped_phone,
          source: "facebook",
        });
      }
    },
  });

  tasks.push({
    name: "linkedin",
    run: async () => {
      const result = await scrapeLinkedInCompany(
        input.companyName,
        input.domain,
      );
      profile = applyLinkedInToProfile(profile, result);
      if (result.has_active_page) actorsSucceeded++;
    },
  });

  tasks.push({
    name: "tiktok",
    run: async () => {
      const result = await scrapeTikTokProfile(input.companyName);
      profile = applyTikTokToProfile(profile, result);
      if (result.has_active_profile) actorsSucceeded++;
    },
  });

  actorsAttempted = tasks.length;
  await Promise.allSettled(tasks.map((t) => t.run()));

  const fullProfile = profile as ViabilityProfile;
  const { adjustment, reasons } = computeSoftAdjustment(
    fullProfile,
    input.currentAssignment.track,
  );

  fullProfile.deep_enrichment = {
    ran_at_ms: Date.now(),
    actors_attempted: actorsAttempted,
    actors_succeeded: actorsSucceeded,
    soft_adjustment: adjustment,
    adjustment_reasons: reasons,
  };

  const reassignment = assignTrack(fullProfile, adjustment);

  return {
    profile: fullProfile,
    softAdjustment: adjustment,
    adjustmentReasons: reasons,
    reassignment,
    actorsAttempted,
    actorsSucceeded,
    durationMs: Date.now() - start,
    scrapedContacts,
  };
}

export async function deepEnrichBatch(
  candidates: DeepEnrichmentInput[],
): Promise<Map<DeepEnrichmentInput, DeepEnrichmentResult>> {
  const results = new Map<DeepEnrichmentInput, DeepEnrichmentResult>();
  const settled = await Promise.allSettled(
    candidates.map(async (c) => {
      const result = await deepEnrichCandidate(c);
      return { input: c, result };
    }),
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.set(outcome.value.input, outcome.value.result);
    }
  }

  return results;
}

function computeSoftAdjustment(
  profile: ViabilityProfile,
  currentTrack: "saas" | "retainer" | null,
): { adjustment: number; reasons: string[] } {
  let adjustment = 0;
  const reasons: string[] = [];

  const hasActiveReviews =
    (profile.maps?.review_count ?? 0) >= 5 &&
    (profile.maps?.rating ?? 0) >= 3.5;

  const hasFacebook = profile.facebook?.has_active_page === true;
  const hasLinkedIn = profile.linkedin?.has_active_page === true;
  const hasTikTok = profile.tiktok?.has_active_profile === true;
  const hasInstagram =
    (profile.instagram?.follower_count ?? 0) > 0;

  const activeSocialCount =
    (hasFacebook ? 1 : 0) +
    (hasInstagram ? 1 : 0) +
    (hasTikTok ? 1 : 0);

  // Active reviews but dead social = needs marketing help
  if (hasActiveReviews && activeSocialCount === 0) {
    adjustment += 3;
    reasons.push("active_reviews_no_social");
  }

  // Website exists but content quality is poor/basic
  const contentQuality = profile.website_content?.content_quality;
  if (contentQuality === "poor" || contentQuality === "basic") {
    adjustment += 1;
    reasons.push("weak_website_content");
  }

  // LinkedIn shows 10+ employees — can likely afford services
  const employeeRange = profile.linkedin?.employee_count_range;
  if (
    employeeRange &&
    !["1", "2-10"].includes(employeeRange)
  ) {
    adjustment += 1;
    reasons.push("linkedin_10plus_employees");
  }

  // Premium pricing on website
  if (profile.website?.stated_pricing_tier === "premium") {
    adjustment += 1;
    reasons.push("premium_pricing");
  }

  // Website content mentions in-house marketing team
  const maturitySignals = profile.website_content?.business_maturity_signals ?? [];
  if (maturitySignals.some((s) => s.toLowerCase().includes("in-house marketing"))) {
    adjustment -= 2;
    reasons.push("in_house_marketing_team");
  }

  // All socials active + professional content
  if (activeSocialCount >= 2 && contentQuality === "excellent") {
    adjustment -= 2;
    reasons.push("strong_existing_marketing");
  }

  // TikTok active: retainer -1 (already doing creative), SaaS +1 (wants tools)
  if (hasTikTok && (profile.tiktok?.posts_last_30d ?? 0) > 2) {
    if (currentTrack === "retainer") {
      adjustment -= 1;
      reasons.push("tiktok_active_retainer_penalty");
    } else if (currentTrack === "saas") {
      adjustment += 1;
      reasons.push("tiktok_active_saas_boost");
    }
  }

  const clamped = Math.max(-SOFT_ADJUSTMENT_CAP, Math.min(SOFT_ADJUSTMENT_CAP, adjustment));
  return { adjustment: clamped, reasons };
}

async function distillWebsiteContent(
  pages: Array<{ url: string; title: string | null; text: string }>,
  companyName: string,
): Promise<ViabilityProfile["website_content"]> {
  if (!killSwitches.llm_calls_enabled) {
    return {
      services_offered: [],
      unique_selling_points: [],
      target_audience_signals: [],
      business_maturity_signals: [],
      content_quality: "unknown",
      distilled_brief: null,
    };
  }

  const pagesText = pages
    .map((p) => `--- ${p.title ?? p.url} ---\n${p.text}`)
    .join("\n\n")
    .slice(0, 8000);

  const prompt = `Analyse the following website content for "${companyName}" and extract structured signals.

WEBSITE CONTENT:
${pagesText}

Respond with a JSON object only — no prose, no markdown fences:
{
  "services_offered": ["service1", "service2"],
  "unique_selling_points": ["usp1", "usp2"],
  "target_audience_signals": ["signal1", "signal2"],
  "business_maturity_signals": ["signal1", "signal2"],
  "content_quality": "poor|basic|good|excellent",
  "distilled_brief": "2-3 sentence summary of what this business does and who they serve"
}

Rules:
- services_offered: max 5 items, each under 10 words
- unique_selling_points: what makes them different, max 3 items
- target_audience_signals: who their customers seem to be, max 3 items
- business_maturity_signals: indicators of business size/age/professionalism (e.g. "established 2015", "multiple locations", "in-house marketing team", "sole operator")
- content_quality: "poor" = thin/broken, "basic" = functional but generic, "good" = clear and professional, "excellent" = polished with strong copy
- distilled_brief: factual, no marketing fluff`;

  try {
    const raw = await invokeLlmText({
      job: "lead-gen-deep-website-distill",
      prompt,
      maxTokens: 512,
    });

    const cleaned = raw
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      services_offered?: unknown;
      unique_selling_points?: unknown;
      target_audience_signals?: unknown;
      business_maturity_signals?: unknown;
      content_quality?: unknown;
      distilled_brief?: unknown;
    };

    return {
      services_offered: asStringArray(parsed.services_offered),
      unique_selling_points: asStringArray(parsed.unique_selling_points),
      target_audience_signals: asStringArray(parsed.target_audience_signals),
      business_maturity_signals: asStringArray(parsed.business_maturity_signals),
      content_quality: parseContentQuality(parsed.content_quality),
      distilled_brief:
        typeof parsed.distilled_brief === "string"
          ? parsed.distilled_brief.trim()
          : null,
    };
  } catch {
    return {
      services_offered: [],
      unique_selling_points: [],
      target_audience_signals: [],
      business_maturity_signals: [],
      content_quality: "unknown",
      distilled_brief: null,
    };
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 5);
}

function parseContentQuality(
  value: unknown,
): NonNullable<ViabilityProfile["website_content"]>["content_quality"] {
  if (typeof value !== "string") return "unknown";
  const valid = ["poor", "basic", "good", "excellent"] as const;
  return valid.includes(value as (typeof valid)[number])
    ? (value as (typeof valid)[number])
    : "unknown";
}
