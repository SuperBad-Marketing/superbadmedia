/**
 * Brand DNA — retake comparison Opus generator.
 *
 * When a retake completes, compares the previous and current profiles and
 * narrates what shifted, what held, and what the movement means.
 *
 * Does not persist the comparison text — it's returned for the reveal UI
 * to render inline. The individual profiles (previous archived, current
 * active) already store everything needed to regenerate on demand.
 *
 * Gated by `llm_calls_enabled` kill-switch.
 *
 * Owner: BDA-5.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq, and, desc } from "drizzle-orm";

import { db as globalDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { buildRetakeComparisonPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-retake-comparison";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

export type RetakeComparisonResult = {
  comparisonNarrative: string;
  previousProfileId: string;
  currentProfileId: string;
  daysBetween: number;
};

/**
 * Generate a comparison narrative between the current profile and its
 * immediate predecessor for the same contact.
 *
 * Returns null if no previous version exists or LLM calls are disabled.
 */
export async function generateRetakeComparison(
  currentProfileId: string,
  dbOverride?: AnyDb,
): Promise<RetakeComparisonResult | null> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (!killSwitches.llm_calls_enabled) {
    return null;
  }

  const currentRows = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, currentProfileId))
    .limit(1);

  const current = currentRows[0];
  if (!current || current.status !== "complete") {
    return null;
  }

  const contactId = current.contact_id;
  const subjectType = current.subject_type;
  if (!contactId && subjectType !== "superbad_self") {
    return null;
  }

  const previousRows = await database
    .select()
    .from(brand_dna_profiles)
    .where(
      contactId
        ? and(
            eq(brand_dna_profiles.contact_id, contactId),
            eq(brand_dna_profiles.is_current, false),
            eq(brand_dna_profiles.status, "complete"),
          )
        : and(
            eq(brand_dna_profiles.subject_type, "superbad_self"),
            eq(brand_dna_profiles.is_current, false),
            eq(brand_dna_profiles.status, "complete"),
          ),
    )
    .orderBy(desc(brand_dna_profiles.version))
    .limit(1);

  const previous = previousRows[0];
  if (!previous) {
    return null;
  }

  const prevTags: Record<string, number> = previous.signal_tags
    ? (JSON.parse(previous.signal_tags) as Record<string, number>)
    : {};
  const currTags: Record<string, number> = current.signal_tags
    ? (JSON.parse(current.signal_tags) as Record<string, number>)
    : {};

  const daysBetween = Math.round(
    ((current.completed_at_ms ?? current.created_at_ms) -
      (previous.completed_at_ms ?? previous.created_at_ms)) /
      (1000 * 60 * 60 * 24),
  );

  const subjectName = current.subject_display_name ?? "this brand";

  const prompt = buildRetakeComparisonPrompt({
    subjectName,
    track: current.track ?? "founder",
    previousTags: prevTags,
    currentTags: currTags,
    previousFirstImpression: previous.first_impression ?? "",
    currentFirstImpression: current.first_impression ?? "",
    previousPortraitExcerpt: previous.prose_portrait ?? "",
    currentPortraitExcerpt: current.prose_portrait ?? "",
    daysBetween: Math.max(daysBetween, 1),
  });

  const modelId = modelFor("brand-dna-generate-retake-comparison");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const narrative =
    response.content.find((b) => b.type === "text")?.text?.trim() ??
    "Comparison could not be generated.";

  return {
    comparisonNarrative: narrative,
    previousProfileId: previous.id,
    currentProfileId: current.id,
    daysBetween: Math.max(daysBetween, 1),
  };
}
