/**
 * Brand DNA — between-section Opus insight generator.
 *
 * Reads the signal tags from a completed section's answers, calls the
 * `brand-dna-generate-section-insight` Opus model, stores the result in
 * brand_dna_profiles.section_insights (JSON string[]), and returns the text.
 *
 * Gated by `llm_calls_enabled` kill-switch. When gated, returns a stub
 * string so the UI can always render.
 *
 * ESLint carve-out: `lib/ai/` and `lib/brand-dna/` are excluded from
 * `no-direct-anthropic-import` so this file may import `@anthropic-ai/sdk`.
 *
 * Owner: BDA-2. Consumer: BDA-3 (reads section_insights for portrait generation).
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as globalDb } from "@/lib/db";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { buildSectionInsightPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-section-insight";
import { SECTION_TITLES } from "./question-bank";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

/**
 * Generate and persist a between-section insight for the given profile + section.
 *
 * Returns cached text from section_insights if it already exists for this
 * section, avoiding duplicate Opus calls on page refreshes.
 *
 * @param profileId  - brand_dna_profiles.id
 * @param section    - Section number 1–5 (insight is generated after completing it)
 * @param dbOverride - Optional DB instance for tests
 */
export async function generateSectionInsight(
  profileId: string,
  section: number,
  dbOverride?: AnyDb,
): Promise<string> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  // ── Kill-switch guard ────────────────────────────────────────────────────
  if (!killSwitches.llm_calls_enabled) {
    return `Your section ${section} signals are being processed. LLM insights will appear here once enabled.`;
  }

  // ── Load profile ─────────────────────────────────────────────────────────
  const profiles = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) {
    return `Profile not found — section ${section} insight unavailable.`;
  }

  // ── Check cache (avoid duplicate Opus calls) ─────────────────────────────
  if (profile.section_insights) {
    const cached = JSON.parse(profile.section_insights) as string[];
    const existing = cached[section - 1];
    if (existing && existing.trim().length > 0) {
      return existing;
    }
  }

  // ── Aggregate tags from answers ──────────────────────────────────────────
  const answers = await database
    .select()
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, profileId),
        eq(brand_dna_answers.section, section),
      ),
    );

  const tagFrequency: Record<string, number> = {};
  for (const answer of answers) {
    const tags = JSON.parse(answer.tags_awarded ?? "[]") as string[];
    for (const tag of tags) {
      tagFrequency[tag] = (tagFrequency[tag] ?? 0) + 1;
    }
  }

  const topTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, freq]) => `${tag} (×${freq})`)
    .join(", ");

  const sectionTitle =
    SECTION_TITLES[section as 1 | 2 | 3 | 4 | 5] ?? `Section ${section}`;
  const subjectName = profile.subject_display_name ?? "this brand";

  // ── Opus call ─────────────────────────────────────────────────────────────
  const modelId = modelFor("brand-dna-generate-section-insight");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: buildSectionInsightPrompt({
          subjectName,
          sectionTitle,
          topTags,
        }),
      },
    ],
  });

  const insightText =
    response.content.find((b) => b.type === "text")?.text?.trim() ??
    `Section ${section} insight could not be generated.`;

  // ── Persist to section_insights ──────────────────────────────────────────
  const existingInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[])
    : [];

  // Ensure array is long enough (sections are 1-indexed)
  while (existingInsights.length < section) {
    existingInsights.push("");
  }
  existingInsights[section - 1] = insightText;

  await database
    .update(brand_dna_profiles)
    .set({
      section_insights: JSON.stringify(existingInsights),
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  return insightText;
}
