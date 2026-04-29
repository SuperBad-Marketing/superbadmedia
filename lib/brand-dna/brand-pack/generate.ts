/**
 * Brand Pack generator — reads a completed Brand DNA profile and
 * produces a structured brand recommendation (fonts, colours, content
 * pillars, voice guide, creative direction) via LLM, then renders
 * it to a premium PDF.
 *
 * Caches the LLM result in `brand_dna_profiles.brand_pack_json` so
 * re-downloads don't re-bill.
 *
 * Owner: BDA-PACK.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { companies } from "@/lib/db/schema/companies";
import { modelFor } from "@/lib/ai/models";
import { killSwitches } from "@/lib/kill-switches";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

import { buildBrandPackPrompt } from "./prompt";
import { buildBrandPackHtml } from "./template";
import { renderToPdf } from "@/lib/pdf/render";

const CLIENT = new Anthropic();

// ── Public data shape ──────────────────────────────────────────────────

export interface BrandPackFontEntry {
  name: string;
  category: string;
  reason: string;
}

export interface BrandPackColourEntry {
  hex: string;
  name: string;
  usage: string;
}

export interface BrandPackContentPillar {
  name: string;
  description: string;
}

export interface BrandPackVoice {
  tone: string;
  doList: string[];
  dontList: string[];
  examplePhrases: string[];
}

export interface BrandPackData {
  subjectName: string;
  businessContext: {
    businessDoes?: string;
    customers?: string;
    differentiator?: string;
  } | null;
  firstImpression: string;
  prosePortraitExcerpt: string;
  primaryFont: BrandPackFontEntry;
  secondaryFont: BrandPackFontEntry;
  accentFont: BrandPackFontEntry | null;
  colours: {
    primary: BrandPackColourEntry;
    secondary: BrandPackColourEntry;
    accent: BrandPackColourEntry;
    neutral: BrandPackColourEntry;
    background: BrandPackColourEntry;
  };
  colourGrades: { hex: string; label: string }[];
  contentPillars: BrandPackContentPillar[];
  brandVoice: BrandPackVoice;
  photographyDirection: string;
  toneOfVoice: string;
  visualDonts: string[];
  enrichmentSnapshot: EnrichmentSnapshot | null;
  generatedDate: string;
}

/** Simplified enrichment observations for the PDF. */
export interface EnrichmentSnapshot {
  facts: { label: string; observation: string }[];
}

// ── Enrichment → snapshot ──────────────────────────────────────────────

function buildEnrichmentSnapshot(
  data: ViabilityProfile | null,
  businessName: string,
): EnrichmentSnapshot | null {
  if (!data) return null;
  const facts: EnrichmentSnapshot["facts"] = [];

  if (data.instagram) {
    const { follower_count, posts_last_30d } = data.instagram;
    if (posts_last_30d !== null && posts_last_30d !== undefined && posts_last_30d === 0) {
      facts.push({
        label: "Instagram",
        observation: `${businessName} hasn't posted on Instagram in the last 30 days.`,
      });
    } else if (posts_last_30d !== null && posts_last_30d !== undefined && posts_last_30d <= 2) {
      facts.push({
        label: "Instagram",
        observation: `${posts_last_30d} Instagram ${posts_last_30d === 1 ? "post" : "posts"} in the last month.`,
      });
    } else if (follower_count !== undefined && follower_count < 500) {
      facts.push({
        label: "Instagram",
        observation: `${follower_count.toLocaleString()} followers. Room to grow.`,
      });
    }
  }

  if (data.facebook) {
    if (data.facebook.has_active_page === false) {
      facts.push({
        label: "Facebook",
        observation: "No active Facebook page found.",
      });
    } else if (data.facebook.posts_last_30d !== null && data.facebook.posts_last_30d === 0) {
      facts.push({
        label: "Facebook",
        observation: "Facebook page exists but hasn't posted recently.",
      });
    }
  }

  if (data.maps) {
    const { review_count, rating } = data.maps;
    if (review_count < 10) {
      facts.push({
        label: "Google Reviews",
        observation: `${review_count} Google ${review_count === 1 ? "review" : "reviews"}. Most people check before they visit.`,
      });
    } else if (rating !== null && rating < 4.0) {
      facts.push({
        label: "Google Reviews",
        observation: `${rating} star average across ${review_count} reviews.`,
      });
    } else if (rating !== null) {
      facts.push({
        label: "Google Reviews",
        observation: `${rating} stars across ${review_count} reviews. Solid foundation.`,
      });
    }
  }

  if (data.website) {
    const { pagespeed_performance_score, has_about_page } = data.website;
    if (pagespeed_performance_score !== null && pagespeed_performance_score < 50) {
      facts.push({
        label: "Website Speed",
        observation: `Performance score of ${pagespeed_performance_score}/100. Visitors feel it.`,
      });
    }
    if (!has_about_page) {
      facts.push({
        label: "Website",
        observation: "No about page found. People want to know who they're buying from.",
      });
    }
  }

  if (data.youtube) {
    if (data.youtube.video_count === 0) {
      facts.push({
        label: "YouTube",
        observation: "No YouTube presence yet.",
      });
    }
  }

  if (data.linkedin) {
    if (data.linkedin.has_active_page === false) {
      facts.push({
        label: "LinkedIn",
        observation: "No active LinkedIn company page.",
      });
    }
  }

  const trimmed = facts.slice(0, 6);
  return trimmed.length > 0 ? { facts: trimmed } : null;
}

// ── Field cleaners ────────────────────────────────────────────────────

function cleanFirstImpression(raw: string): string {
  const headlineMatch = raw.match(/^HEADLINE:\s*([\s\S]+?)(?:\s*SUBLINE:|$)/);
  if (headlineMatch?.[1]) return headlineMatch[1].trim();
  return raw.trim();
}

function cleanPortraitExcerpt(raw: string): string {
  let text = raw.replace(/^\[PORTRAIT\]\s*/i, "").trim();
  if (text.length <= 800) return text;
  const truncated = text.slice(0, 800);
  const lastSentence = truncated.match(/^([\s\S]*[.!?])\s/);
  return lastSentence ? lastSentence[1].trim() : truncated.trim();
}

// ── Main generator ─────────────────────────────────────────────────────

/**
 * Generate Brand Pack content for a profile. Calls Opus once for the
 * creative recommendations, caches the result, and returns the full
 * data shape needed by the template.
 */
export async function generateBrandPackContent(
  profileId: string,
  enrichmentData: ViabilityProfile | null,
): Promise<BrandPackData> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls disabled");
  }

  const profiles = await db
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) throw new Error("Profile not found");
  if (profile.status !== "complete") throw new Error("Assessment not complete");

  const subjectName = profile.subject_display_name ?? "the brand";

  // ── Cache hit — return existing data ──
  if (profile.brand_pack_json) {
    try {
      const cached = JSON.parse(profile.brand_pack_json) as BrandPackData;
      cached.enrichmentSnapshot = buildEnrichmentSnapshot(enrichmentData, subjectName);
      cached.firstImpression = cleanFirstImpression(cached.firstImpression);
      cached.prosePortraitExcerpt = cleanPortraitExcerpt(cached.prosePortraitExcerpt);
      return cached;
    } catch {
      // Corrupted cache — regenerate
    }
  }

  // ── Load profile data ──
  const tagMap: Record<string, number> = profile.signal_tags
    ? (JSON.parse(profile.signal_tags) as Record<string, number>)
    : {};

  let businessContext: BrandPackData["businessContext"] = null;
  if (profile.business_context) {
    try {
      businessContext = JSON.parse(profile.business_context);
    } catch {
      /* skip */
    }
  }

  let industry: string | null = null;
  if (businessContext?.businessDoes) {
    industry = businessContext.businessDoes;
  } else if (profile.company_id) {
    const rows = await db
      .select({ industry: companies.industry })
      .from(companies)
      .where(eq(companies.id, profile.company_id))
      .limit(1);
    industry = rows[0]?.industry ?? null;
  }

  const sectionInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[]).filter(
        (s) => typeof s === "string" && s.length > 0,
      )
    : [];

  // ── LLM call ──
  const prompt = buildBrandPackPrompt({
    subjectName,
    track: profile.track ?? "unspecified",
    tagFrequencyMap: tagMap,
    businessContext,
    industry,
    prosePortrait: profile.prose_portrait,
    sectionInsights,
    hasEnrichmentData: enrichmentData !== null,
  });

  const modelId = modelFor("brand-dna-generate-brand-pack");
  const response = await CLIENT.messages.create({
    model: modelId,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  let text =
    response.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  // Strip markdown fences if the model wrapped the JSON
  text = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // ── Parse LLM response ──
  let llmResult: Record<string, unknown>;
  try {
    llmResult = JSON.parse(text);
  } catch {
    // Try extracting JSON from between first { and last }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        llmResult = JSON.parse(text.slice(start, end + 1));
      } catch {
        throw new Error("LLM returned invalid JSON for brand pack");
      }
    } else {
      throw new Error("LLM returned invalid JSON for brand pack");
    }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const data: BrandPackData = {
    subjectName,
    businessContext,
    firstImpression: cleanFirstImpression(profile.first_impression ?? ""),
    prosePortraitExcerpt: cleanPortraitExcerpt(profile.prose_portrait ?? ""),
    primaryFont: llmResult.primaryFont as BrandPackFontEntry,
    secondaryFont: llmResult.secondaryFont as BrandPackFontEntry,
    accentFont: (llmResult.accentFont as BrandPackFontEntry) ?? null,
    colours: llmResult.colours as BrandPackData["colours"],
    colourGrades: llmResult.colourGrades as BrandPackData["colourGrades"],
    contentPillars: (llmResult.contentPillars as BrandPackContentPillar[]) ?? [],
    brandVoice: (llmResult.brandVoice as BrandPackVoice) ?? {
      tone: "",
      doList: [],
      dontList: [],
      examplePhrases: [],
    },
    photographyDirection: (llmResult.photographyDirection as string) ?? "",
    toneOfVoice: (llmResult.toneOfVoice as string) ?? "",
    visualDonts: (llmResult.visualDonts as string[]) ?? [],
    enrichmentSnapshot: buildEnrichmentSnapshot(enrichmentData, subjectName),
    generatedDate: dateStr,
  };

  // ── Cache the result ──
  await db
    .update(brand_dna_profiles)
    .set({
      brand_pack_json: JSON.stringify(data),
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  return data;
}

/**
 * Generate a Brand Pack PDF buffer. Convenience wrapper that calls
 * `generateBrandPackContent` then renders the template.
 */
export async function generateBrandPack(
  profileId: string,
  enrichmentData: ViabilityProfile | null = null,
): Promise<Buffer> {
  const data = await generateBrandPackContent(profileId, enrichmentData);
  const html = buildBrandPackHtml(data);
  return renderToPdf(html, { margin: { top: 0, right: 0, bottom: 0, left: 0 } });
}
