/**
 * Brand DNA — per-signal contextual description Opus generator.
 *
 * For the top 12 signals, generates one contextual sentence each explaining
 * how the signal showed up in this person's answers. Persisted to
 * `brand_dna_profiles.signal_descriptions_json`.
 *
 * Cached — if signal_descriptions_json is already set, returns without
 * calling Anthropic. Gated by `llm_calls_enabled` kill-switch.
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
import { buildSignalDescriptionsPrompt } from "@/lib/ai/prompts/brand-dna-assessment/generate-signal-descriptions";
import { domainForTag } from "@/lib/brand-dna/signal-definitions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

const MIN_FREQUENCY = 3;
const MAX_SIGNALS = 12;

export async function generateSignalDescriptions(
  profileId: string,
  dbOverride?: AnyDb,
): Promise<Record<string, string>> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (!killSwitches.llm_calls_enabled) {
    return {};
  }

  const profiles = await database
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) return {};

  if (
    profile.signal_descriptions_json &&
    profile.signal_descriptions_json.trim().length > 0
  ) {
    try {
      return JSON.parse(profile.signal_descriptions_json) as Record<
        string,
        string
      >;
    } catch {
      /* regenerate on corrupt data */
    }
  }

  const tagMap: Record<string, number> = profile.signal_tags
    ? (JSON.parse(profile.signal_tags) as Record<string, number>)
    : {};

  const signals = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .filter(([, freq]) => freq >= MIN_FREQUENCY)
    .slice(0, MAX_SIGNALS)
    .map(([tag, frequency]) => ({
      tag,
      frequency,
      domain: domainForTag(tag) ?? "values",
    }));

  if (signals.length === 0) return {};

  const subjectName = profile.subject_display_name ?? "this brand";

  const sectionInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[]).filter(
        (s) => typeof s === "string" && s.length > 0,
      )
    : [];

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

  const prompt = buildSignalDescriptionsPrompt({
    subjectName,
    track: profile.track ?? "unspecified",
    signals,
    sectionInsights,
    reflectionText: profile.reflection_text,
    industry,
  });

  const modelId = modelFor("brand-dna-generate-signal-descriptions");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  const descriptions: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match?.[1] && match[2]) {
      descriptions[match[1]] = match[2].trim();
    }
  }

  const json = JSON.stringify(descriptions);
  await database
    .update(brand_dna_profiles)
    .set({ signal_descriptions_json: json, updated_at_ms: Date.now() })
    .where(eq(brand_dna_profiles.id, profileId));

  return descriptions;
}
