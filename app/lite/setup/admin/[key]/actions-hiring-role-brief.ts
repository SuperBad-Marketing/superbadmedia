"use server";

import { auth } from "@/lib/auth/auth";
import { createRoleBrief, updateRoleBrief } from "@/lib/hiring/queries";
import {
  ingestPortfolioUrl,
  type PortfolioSignal,
} from "@/lib/hiring/portfolio";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";

export type SynthesisInput = {
  roleName: string;
  engagementType: "contractor" | "employee";
  rateMinAud: number | null;
  rateMaxAud: number | null;
  targetHoursPerWeek: number | null;
  locationPrefCity: string | null;
  remoteOk: boolean;
  openCount: number;
  referenceSignals: PortfolioSignal[];
};

export type SynthesisResult = {
  ok: true;
  styleSummary: string;
  extractedTags: string[];
  styleDoList: string[];
  styleAvoidList: string[];
  discoverySearchHints: string[];
} | {
  ok: false;
  reason: string;
};

export async function synthesizeRoleBriefAction(
  input: SynthesisInput,
): Promise<SynthesisResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired, sign in again." };
  }

  const signalsSummary = input.referenceSignals
    .map(
      (s) =>
        `URL: ${s.url} | Platform: ${s.platform} | Tags: ${s.extracted_tags.join(", ") || "none yet"} | Bio: ${s.bio || "unavailable"} | Samples: ${s.work_samples.length}`,
    )
    .join("\n");

  const rateRange =
    input.rateMinAud != null && input.rateMaxAud != null
      ? `$${input.rateMinAud}–$${input.rateMaxAud}/hr`
      : input.rateMinAud != null
        ? `from $${input.rateMinAud}/hr`
        : "not specified";

  const prompt = `You are building a Role Brief for a creative contractor hiring pipeline. The brief becomes perpetual LLM context, every future hiring action reads it.

Role: ${input.roleName}
Type: ${input.engagementType}
Rate band: ${rateRange}
Hours/week: ${input.targetHoursPerWeek ?? "flexible"}
Location: ${input.locationPrefCity ?? "any"}${input.remoteOk ? " (remote OK)" : " (on-site only)"}
Slots to fill: ${input.openCount}

Reference portfolios Andy admires (these are the taste signal, what he'd hire tomorrow):
${signalsSummary || "No portfolio signals available yet."}

Analyse the reference portfolios and produce a structured brief. Return ONLY valid JSON with these fields:
{
  "style_summary": "2-3 sentence prose description of the visual/creative style Andy is looking for, derived from the reference portfolios",
  "extracted_tags": ["array", "of", "style", "tags", "from", "references"],
  "style_do_list": ["things the ideal candidate's work should demonstrate"],
  "style_avoid_list": [],
  "discovery_search_hints": ["search queries that would find similar portfolios on the open web"]
}

style_avoid_list starts empty, it grows from archive reflections over time.
discovery_search_hints should be 3-5 search queries suitable for Vimeo/Behance/Google that would surface similar work.
Be specific to the references, not generic.`;

  try {
    const raw = await invokeLlmText({
      job: "hiring-brief-synthesize",
      prompt,
      maxTokens: 1500,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, reason: "Synthesis returned unexpected format. Try again." };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      style_summary?: string;
      extracted_tags?: string[];
      style_do_list?: string[];
      style_avoid_list?: string[];
      discovery_search_hints?: string[];
    };

    return {
      ok: true,
      styleSummary: parsed.style_summary ?? "",
      extractedTags: Array.isArray(parsed.extracted_tags) ? parsed.extracted_tags : [],
      styleDoList: Array.isArray(parsed.style_do_list) ? parsed.style_do_list : [],
      styleAvoidList: Array.isArray(parsed.style_avoid_list) ? parsed.style_avoid_list : [],
      discoverySearchHints: Array.isArray(parsed.discovery_search_hints)
        ? parsed.discovery_search_hints
        : [],
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Synthesis failed.",
    };
  }
}

export async function ingestPortfolioUrlAction(
  url: string,
): Promise<{ ok: true; signal: PortfolioSignal } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired, sign in again." };
  }

  try {
    const signal = await ingestPortfolioUrl(url);
    return { ok: true, signal };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Failed to ingest URL.",
    };
  }
}

export type CompleteRoleBriefInput = {
  roleName: string;
  engagementType: "contractor" | "employee";
  rateMinAud: number | null;
  rateMaxAud: number | null;
  targetHoursPerWeek: number | null;
  locationPrefCity: string | null;
  remoteOk: boolean;
  openCount: number;
  referenceUrls: string[];
  referenceSignals: PortfolioSignal[];
  styleSummary: string;
  extractedTags: string[];
  styleDoList: string[];
  styleAvoidList: string[];
  discoverySearchHints: string[];
  andyOverrides: string | null;
};

export async function completeRoleBriefAction(
  input: CompleteRoleBriefInput,
): Promise<CelebrationCompleteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Session expired, sign in again." };
  }

  try {
    const brief = await createRoleBrief({
      role_name: input.roleName,
      engagement_type: input.engagementType,
      rate_min_aud: input.rateMinAud,
      rate_max_aud: input.rateMaxAud,
      target_hours_per_week: input.targetHoursPerWeek,
      location_pref_city: input.locationPrefCity,
      remote_ok: input.remoteOk,
      open_count: input.openCount,
    });

    await updateRoleBrief(brief.id, {
      status: "open",
      reference_urls_json: input.referenceUrls,
      reference_signals_json: input.referenceSignals,
      style_summary: input.styleSummary,
      extracted_tags_json: input.extractedTags,
      style_do_list_json: input.styleDoList,
      style_avoid_list_json: input.styleAvoidList,
      discovery_search_hints_json: input.discoverySearchHints,
      andy_overrides: input.andyOverrides,
    });

    await logActivity({
      kind: "role_brief_opened",
      body: `Role Brief opened: ${input.roleName}`,
      meta: { roleBriefId: brief.id, roleName: input.roleName },
      createdBy: session.user.id,
    });

    return {
      ok: true,
      observatorySummary: `Role Brief "${input.roleName}" is open. Discovery starts within the hour.`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Failed to create Role Brief.",
    };
  }
}
