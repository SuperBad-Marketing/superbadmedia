/**
 * Brand Pack generator — reads a completed Brand DNA profile and
 * produces a structured brand recommendation (fonts, colours, creative
 * direction) via LLM, then renders it to a premium PDF.
 *
 * Owner: BDA-PACK.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { companies } from "@/lib/db/schema/companies";
import { modelFor } from "@/lib/ai/models";
import { killSwitches } from "@/lib/kill-switches";

import { buildBrandPackPrompt } from "./prompt";
import { buildBrandPackHtml } from "./template";
import { renderToPdf } from "@/lib/pdf/render";

const CLIENT = new Anthropic();

export interface BrandPackData {
  subjectName: string;
  businessContext: { businessDoes?: string; customers?: string; differentiator?: string } | null;
  primaryFont: { name: string; category: string; reason: string };
  secondaryFont: { name: string; category: string; reason: string };
  accentFont: { name: string; category: string; reason: string } | null;
  colours: {
    primary: { hex: string; name: string; usage: string };
    secondary: { hex: string; name: string; usage: string };
    accent: { hex: string; name: string; usage: string };
    neutral: { hex: string; name: string; usage: string };
    background: { hex: string; name: string; usage: string };
  };
  colourGrades: { hex: string; label: string }[];
  photographyDirection: string;
  toneOfVoice: string;
  visualDonts: string[];
  prosePortraitExcerpt: string;
}

export async function generateBrandPack(profileId: string): Promise<Buffer> {
  if (!killSwitches.llm_calls_enabled) {
    throw new Error("LLM calls disabled");
  }

  const profiles = await db
    .select()
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profiles[0];
  if (!profile) throw new Error("Profile not found");
  if (profile.status !== "complete") throw new Error("Assessment not complete");

  const tagMap: Record<string, number> = profile.signal_tags
    ? (JSON.parse(profile.signal_tags) as Record<string, number>)
    : {};

  let businessContext: BrandPackData["businessContext"] = null;
  if (profile.business_context) {
    try { businessContext = JSON.parse(profile.business_context); } catch { /* skip */ }
  }

  let industry: string | null = null;
  if (businessContext?.businessDoes) {
    industry = businessContext.businessDoes;
  } else if (profile.company_id) {
    const rows = await db
      .select({ industry: companies.industry })
      .from(companies)
      .where(eq(companies.id, profile.company_id))
      .limit(1);
    industry = rows[0]?.industry ?? null;
  }

  const subjectName = profile.subject_display_name ?? "the brand";

  const prompt = buildBrandPackPrompt({
    subjectName,
    track: profile.track ?? "unspecified",
    tagFrequencyMap: tagMap,
    businessContext,
    industry,
    prosePortrait: profile.prose_portrait,
  });

  const modelId = modelFor("brand-dna-generate-brand-pack");
  const response = await CLIENT.messages.create({
    model: modelId,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((b) => b.type === "text")?.text?.trim() ?? "";

  let data: BrandPackData;
  try {
    data = JSON.parse(text);
    data.subjectName = subjectName;
    data.businessContext = businessContext;
    data.prosePortraitExcerpt = (profile.prose_portrait ?? "").slice(0, 500);
  } catch {
    throw new Error("LLM returned invalid JSON for brand pack");
  }

  const html = buildBrandPackHtml(data);
  return renderToPdf(html, { margin: { top: 0, right: 0, bottom: 0, left: 0 } });
}
