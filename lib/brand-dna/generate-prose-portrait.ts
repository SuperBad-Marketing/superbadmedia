/**
 * Brand DNA — prose-portrait Opus generator.
 *
 * Reads the completed profile + its first impression (generated first) and
 * persists the 500–800 word narrative portrait to
 * `brand_dna_profiles.prose_portrait`.
 *
 * Cached — if prose_portrait is already set, returns it.
 *
 * Gated by `llm_calls_enabled` kill-switch. When gated, returns a stub.
 *
 * Owner: BDA-3.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as globalDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { buildProsePortraitPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-prose-portrait";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

/**
 * Generate and persist the prose portrait for a completed profile.
 * Expects `first_impression` already written (first-impression runs first).
 *
 * @param profileId  - brand_dna_profiles.id
 * @param dbOverride - Optional DB for tests
 */
export async function generateProsePortrait(
  profileId: string,
  dbOverride?: AnyDb,
): Promise<string> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (!killSwitches.llm_calls_enabled) {
    return "A prose portrait will appear here once LLM calls are enabled.";
  }

  const profiles = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) {
    return "Profile not found — portrait unavailable.";
  }

  if (profile.prose_portrait && profile.prose_portrait.trim().length > 0) {
    return profile.prose_portrait;
  }

  const tagMap: Record<string, number> = profile.signal_tags
    ? (JSON.parse(profile.signal_tags) as Record<string, number>)
    : {};

  const sectionInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[]).filter(
        (s) => typeof s === "string" && s.length > 0,
      )
    : [];

  const subjectName = profile.subject_display_name ?? "this brand";

  const prompt = buildProsePortraitPrompt({
    subjectName,
    track: profile.track ?? "unspecified",
    shape: profile.shape,
    tagFrequencyMap: tagMap,
    reflectionText: profile.reflection_text,
    firstImpression: profile.first_impression ?? "",
    sectionInsights,
  });

  const modelId = modelFor("brand-dna-generate-prose-portrait");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ??
    "Prose portrait could not be generated.";

  await database
    .update(brand_dna_profiles)
    .set({ prose_portrait: text, updated_at_ms: Date.now() })
    .where(eq(brand_dna_profiles.id, profileId));

  return text;
}
