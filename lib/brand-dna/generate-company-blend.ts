/**
 * Brand DNA — company blend Opus generator.
 *
 * Reads all completed individual profiles for a company and synthesises them
 * into a blended company-level profile. Stores the result on
 * `brand_dna_blends`.
 *
 * Regenerated when any stakeholder retakes (version increments).
 *
 * Gated by `llm_calls_enabled` kill-switch.
 *
 * Owner: BDA-5.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as globalDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_blends } from "@/lib/db/schema/brand-dna-blends";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { logActivity } from "@/lib/activity-log";
import {
  buildCompanyBlendPrompt,
  type StakeholderProfile,
} from "@/lib/ai/prompts/brand-dna-assessment/generate-company-blend";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

const CLIENT_SINGLETON = new Anthropic();

export type CompanyBlendResult = {
  blendId: string;
  tagsJson: Record<string, number>;
  prosePortrait: string;
  divergencesJson: Array<{
    domain: string;
    tag: string;
    description: string;
  }>;
};

/**
 * Generate (or regenerate) a company blend from all current individual profiles.
 *
 * Requires ≥2 completed profiles for the company. Returns null if fewer exist.
 */
export async function generateCompanyBlend(
  companyId: string,
  dbOverride?: AnyDb,
): Promise<CompanyBlendResult | null> {
  const database = (dbOverride ?? globalDb) as AnyDb;

  if (!killSwitches.llm_calls_enabled) {
    return null;
  }

  const profiles = await database
    .select()
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.company_id, companyId),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
        eq(brand_dna_profiles.subject_type, "client"),
      ),
    );

  if (profiles.length < 2) {
    return null;
  }

  const stakeholders: StakeholderProfile[] = profiles.map((p) => {
    const tags: Record<string, number> = p.signal_tags
      ? (JSON.parse(p.signal_tags) as Record<string, number>)
      : {};

    const brandOverrides: Record<string, number> = {};
    if (p.track === "founder_supplement" && p.supplement_completed) {
      for (const [key, val] of Object.entries(tags)) {
        if (key.startsWith("brand_override.")) {
          brandOverrides[key] = val;
        }
      }
    }

    return {
      name: p.subject_display_name ?? "Stakeholder",
      track: p.track ?? "founder",
      tagFrequencyMap: tags,
      firstImpression: p.first_impression ?? "",
      prosePortrait: p.prose_portrait ?? "",
      brandOverrideTags:
        Object.keys(brandOverrides).length > 0 ? brandOverrides : null,
    };
  });

  const companyName =
    profiles[0]?.subject_display_name?.split(" ")?.[0] ?? "this company";

  const prompt = buildCompanyBlendPrompt({ companyName, stakeholders });

  const modelId = modelFor("brand-dna-generate-company-blend");
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText =
    response.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  const { sharedTags, divergences, portrait } = parseBlendOutput(rawText);

  const blendId = randomUUID();
  const now = Date.now();

  await database.insert(brand_dna_blends).values({
    id: blendId,
    company_id: companyId,
    source_profile_ids: JSON.stringify(profiles.map((p) => p.id)),
    tags_json: JSON.stringify(sharedTags),
    prose_portrait: portrait,
    divergences_json: JSON.stringify(divergences),
    created_at_ms: now,
  });

  await logActivity({
    kind: "blend_generated",
    body: `Company blend generated from ${profiles.length} stakeholder profiles`,
    companyId,
  });

  return {
    blendId,
    tagsJson: sharedTags,
    prosePortrait: portrait,
    divergencesJson: divergences,
  };
}

function parseBlendOutput(raw: string): {
  sharedTags: Record<string, number>;
  divergences: Array<{ domain: string; tag: string; description: string }>;
  portrait: string;
} {
  const sharedSection = extractSection(raw, "SHARED SIGNALS");
  const divergenceSection = extractSection(raw, "DIVERGENCES");
  const portraitSection = extractSection(raw, "COMPANY PORTRAIT");

  const sharedTags: Record<string, number> = {};
  const tagPattern = /(\w[\w.]+)\s*\((?:×|x)(\d+)\)/g;
  let match;
  while ((match = tagPattern.exec(sharedSection)) !== null) {
    sharedTags[match[1]] = parseInt(match[2], 10);
  }

  const divergences: Array<{
    domain: string;
    tag: string;
    description: string;
  }> = [];
  const lines = divergenceSection.split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    const cleaned = line.replace(/^[-•*]\s*/, "").trim();
    if (cleaned.length > 10) {
      const domainMatch = cleaned.match(/^(\w+):/);
      divergences.push({
        domain: domainMatch?.[1] ?? "general",
        tag: cleaned.slice(0, 60),
        description: cleaned,
      });
    }
  }

  return {
    sharedTags,
    divergences,
    portrait: portraitSection.trim() || raw,
  };
}

function extractSection(text: string, sectionName: string): string {
  const pattern = new RegExp(
    `===\\s*${sectionName}\\s*===([\\s\\S]*?)(?====|$)`,
    "i",
  );
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? "";
}
