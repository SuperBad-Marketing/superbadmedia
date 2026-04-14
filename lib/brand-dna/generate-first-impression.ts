/**
 * Brand DNA — first-impression Opus generator.
 *
 * Reads the completed profile's aggregated signal_tags, all between-section
 * insights, and the optional reflection_text. Calls the
 * `brand-dna-generate-first-impression` Opus model and persists the output to
 * `brand_dna_profiles.first_impression`.
 *
 * Cached — if first_impression is already set, returns it without calling
 * Anthropic. Rerunning the reveal page does not re-bill.
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
import { buildFirstImpressionPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-first-impression";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

/**
 * Generate and persist the first-impression sentence for a completed profile.
 *
 * @param profileId  - brand_dna_profiles.id
 * @param dbOverride - Optional DB for tests
 */
export async function generateFirstImpression(
  profileId: string,
  dbOverride?: AnyDb,
): Promise<string> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (!killSwitches.llm_calls_enabled) {
    return "A first impression will appear here once LLM calls are enabled.";
  }

  const profiles = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) {
    return "Profile not found — first impression unavailable.";
  }

  // Cache hit — don't re-bill.
  if (profile.first_impression && profile.first_impression.trim().length > 0) {
    return profile.first_impression;
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

  const prompt = buildFirstImpressionPrompt({
    subjectName,
    track: profile.track ?? "unspecified",
    shape: profile.shape,
    tagFrequencyMap: tagMap,
    reflectionText: profile.reflection_text,
    sectionInsights,
  });

  const modelId = modelFor("brand-dna-generate-first-impression");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ??
    "First impression could not be generated.";

  await database
    .update(brand_dna_profiles)
    .set({ first_impression: text, updated_at_ms: Date.now() })
    .where(eq(brand_dna_profiles.id, profileId));

  return text;
}
