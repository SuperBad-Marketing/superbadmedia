import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import {
  buildGapRevealPrompt,
  buildEnrichmentSummary,
  hasRichEnrichment,
} from "@/lib/ai/prompts/brand-dna-assessment/generate-gap-reveal";
import { domainForTag } from "@/lib/brand-dna/signal-definitions";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

export interface GapRevealObservations {
  mode: "observations";
  strength: string;
  gap: string;
}

export interface GapRevealQuestions {
  mode: "questions";
  questions: string[];
}

export type GapRevealData = GapRevealObservations | GapRevealQuestions;

const CLIENT_SINGLETON = new Anthropic();
const MIN_FREQUENCY = 3;

export async function generateGapReveal(
  sessionToken: string,
  profileId: string,
  enrichmentData: ViabilityProfile | null,
): Promise<GapRevealData | null> {
  if (!killSwitches.llm_calls_enabled) return null;

  const sessions = await db
    .select({ gap_reveal_json: rundownSessions.gap_reveal_json })
    .from(rundownSessions)
    .where(eq(rundownSessions.session_token, sessionToken))
    .limit(1);

  const cached = sessions[0]?.gap_reveal_json;
  if (cached) {
    try {
      return JSON.parse(cached) as GapRevealData;
    } catch { /* regenerate */ }
  }

  const profiles = await db
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) return null;

  const tagMap: Record<string, number> = profile.signal_tags
    ? (JSON.parse(profile.signal_tags) as Record<string, number>)
    : {};

  const topSignals = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .filter(([, freq]) => freq >= MIN_FREQUENCY)
    .slice(0, 12)
    .map(([tag, frequency]) => ({
      tag,
      frequency,
      domain: domainForTag(tag) ?? "values",
    }));

  if (topSignals.length === 0) return null;

  const sectionInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[]).filter(
        (s) => typeof s === "string" && s.length > 0,
      )
    : [];

  const richEnrichment = hasRichEnrichment(enrichmentData);
  const enrichmentSummaryText = buildEnrichmentSummary(enrichmentData);

  const prompt = buildGapRevealPrompt({
    subjectName: profile.subject_display_name ?? "this brand",
    businessName: profile.subject_display_name ?? "this brand",
    track: profile.track ?? "unspecified",
    topSignals,
    sectionInsights,
    enrichmentSummary: enrichmentSummaryText,
    hasRichEnrichment: richEnrichment,
  });

  const modelId = modelFor("brand-dna-generate-gap-reveal");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  let result: GapRevealData;

  if (richEnrichment) {
    const strengthMatch = text.match(/STRENGTH:\s*(.+)/);
    const gapMatch = text.match(/GAP:\s*(.+)/);
    result = {
      mode: "observations",
      strength: strengthMatch?.[1]?.trim() ?? "",
      gap: gapMatch?.[1]?.trim() ?? "",
    };
  } else {
    const questions: string[] = [];
    for (const line of text.split("\n")) {
      const match = line.match(/^Q\d:\s*(.+)$/);
      if (match?.[1]) questions.push(match[1].trim());
    }
    result = { mode: "questions", questions };
  }

  await db
    .update(rundownSessions)
    .set({
      gap_reveal_json: JSON.stringify(result),
      updated_at_ms: Date.now(),
    })
    .where(eq(rundownSessions.session_token, sessionToken));

  return result;
}
