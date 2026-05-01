/**
 * Brand DNA — signal scores intro Opus generator.
 *
 * Reads the profile's aggregated signal_tags, generates a 2-sentence intro
 * for the signal scores chart, and persists it to
 * `brand_dna_profiles.signal_scores_intro`.
 *
 * Cached — if signal_scores_intro is already set, returns without calling
 * Anthropic. Gated by `llm_calls_enabled` kill-switch.
 *
 * Owner: BDA-SIGNAL-SCORES.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as globalDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { companies } from "@/lib/db/schema/companies";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { buildSignalScoresIntroPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-signal-scores-intro";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

export async function generateSignalScoresIntro(
  profileId: string,
  dbOverride?: AnyDb,
): Promise<string> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (!killSwitches.llm_calls_enabled) {
    return "Signal scores intro will appear here once LLM calls are enabled.";
  }

  const profiles = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) {
    return "Profile not found.";
  }

  if (
    profile.signal_scores_intro &&
    profile.signal_scores_intro.trim().length > 0
  ) {
    return profile.signal_scores_intro;
  }

  const tagMap: Record<string, number> = profile.signal_tags
    ? (JSON.parse(profile.signal_tags) as Record<string, number>)
    : {};

  const topSignals = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, frequency]) => ({ tag, frequency }));

  if (topSignals.length === 0) {
    return "No signal data available.";
  }

  const subjectName = profile.subject_display_name ?? "this brand";

  let industry: string | null = null;
  if (profile.business_context) {
    try {
      const ctx = JSON.parse(profile.business_context) as {
        businessDoes?: string;
      };
      if (ctx.businessDoes) industry = ctx.businessDoes;
    } catch {
      /* skip */
    }
  }
  if (!industry && profile.company_id) {
    const companyRows = await database
      .select({ industry: companies.industry })
      .from(companies)
      .where(eq(companies.id, profile.company_id))
      .limit(1);
    if (companyRows[0]) industry = companyRows[0].industry;
  }

  const prompt = buildSignalScoresIntroPrompt({
    subjectName,
    track: profile.track ?? "unspecified",
    topSignals,
    industry,
  });

  const modelId = modelFor("brand-dna-generate-signal-scores-intro");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ??
    "Signal scores intro could not be generated.";

  await database
    .update(brand_dna_profiles)
    .set({ signal_scores_intro: text, updated_at_ms: Date.now() })
    .where(eq(brand_dna_profiles.id, profileId));

  return text;
}
