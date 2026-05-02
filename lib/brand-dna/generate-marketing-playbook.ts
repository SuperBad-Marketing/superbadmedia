/**
 * Brand DNA — marketing playbook Opus generator.
 *
 * Reads the profile's signals, first impression, portrait, and section
 * insights to generate a 5-section personalised marketing playbook.
 * Cached on `brand_dna_profiles.marketing_playbook_json`.
 *
 * Owner: BDA-PLAYBOOK.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as globalDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { buildMarketingPlaybookPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-marketing-playbook";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

export interface MarketingPlaybookExample {
  scenario: string;
  guidance: string;
}

export interface MarketingPlaybookSection {
  title: string;
  overview: string;
  examples: MarketingPlaybookExample[];
}

export interface MarketingPlaybook {
  sections: MarketingPlaybookSection[];
}

export async function generateMarketingPlaybook(
  profileId: string,
  dbOverride?: AnyDb,
): Promise<MarketingPlaybook | null> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (!killSwitches.llm_calls_enabled) return null;

  const profiles = await database
    .select({
      marketing_playbook_json: brand_dna_profiles.marketing_playbook_json,
      signal_tags: brand_dna_profiles.signal_tags,
      first_impression: brand_dna_profiles.first_impression,
      prose_portrait: brand_dna_profiles.prose_portrait,
      section_insights: brand_dna_profiles.section_insights,
      business_context: brand_dna_profiles.business_context,
      subject_display_name: brand_dna_profiles.subject_display_name,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) return null;

  if (profile.marketing_playbook_json) {
    try {
      return JSON.parse(profile.marketing_playbook_json) as MarketingPlaybook;
    } catch {
      // corrupted cache — regenerate
    }
  }

  const signalTags: Record<string, number> = profile.signal_tags
    ? JSON.parse(profile.signal_tags as string)
    : {};

  if (Object.keys(signalTags).length === 0) return null;

  const subjectName = profile.subject_display_name ?? "this brand";
  const firstImpression = profile.first_impression ?? "";
  const prosePortrait = profile.prose_portrait ?? "";

  let sectionInsights: string[] = [];
  if (profile.section_insights) {
    try {
      const parsed = JSON.parse(profile.section_insights as string);
      if (Array.isArray(parsed)) {
        sectionInsights = parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {}
  }

  let businessContext: { businessDoes?: string; customers?: string; differentiator?: string } | null = null;
  if (profile.business_context) {
    try {
      businessContext = JSON.parse(profile.business_context as string);
    } catch {}
  }

  const prompt = buildMarketingPlaybookPrompt({
    subjectName,
    signalTags,
    firstImpression,
    prosePortraitExcerpt: prosePortrait.slice(0, 800),
    sectionInsights,
    businessContext,
  });

  const modelId = modelFor("brand-dna-generate-marketing-playbook");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text?.trim() ?? "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let playbook: MarketingPlaybook;
  try {
    playbook = JSON.parse(cleaned) as MarketingPlaybook;
  } catch {
    return null;
  }

  if (!playbook.sections || playbook.sections.length === 0) return null;

  await database
    .update(brand_dna_profiles)
    .set({
      marketing_playbook_json: JSON.stringify(playbook),
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  return playbook;
}
