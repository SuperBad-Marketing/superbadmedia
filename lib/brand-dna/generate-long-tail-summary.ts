/**
 * Brand DNA — long-tail summary Opus generator.
 *
 * Reads the profile's below-threshold signal tags and generates a single
 * sentence tying them together. Cached on `brand_dna_profiles.long_tail_summary`.
 *
 * Owner: BDA-SIGNAL-SCORES.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as globalDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { buildLongTailSummaryPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-long-tail-summary";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

export async function generateLongTailSummary(
  profileId: string,
  longTailTags: string[],
  topSignalNames: string[],
  dbOverride?: AnyDb,
): Promise<string> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (longTailTags.length === 0) return "";

  if (!killSwitches.llm_calls_enabled) return "";

  const profiles = await database
    .select({
      long_tail_summary: brand_dna_profiles.long_tail_summary,
      subject_display_name: brand_dna_profiles.subject_display_name,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) return "";

  if (profile.long_tail_summary && profile.long_tail_summary.trim().length > 0) {
    return profile.long_tail_summary;
  }

  const subjectName = profile.subject_display_name ?? "this brand";

  const prompt = buildLongTailSummaryPrompt({
    subjectName,
    longTailTags,
    topSignalNames,
  });

  const modelId = modelFor("brand-dna-generate-long-tail-summary");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  if (text) {
    await database
      .update(brand_dna_profiles)
      .set({ long_tail_summary: text, updated_at_ms: Date.now() })
      .where(eq(brand_dna_profiles.id, profileId));
  }

  return text;
}
