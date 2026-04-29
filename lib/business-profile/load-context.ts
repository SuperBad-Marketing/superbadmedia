import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  business_profile_sections,
  type BusinessProfileSectionKey,
} from "@/lib/db/schema/business-profile-sections";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import type { ModelTier } from "@/lib/ai/models";
import settingsRegistry from "@/lib/settings";
import { FALLBACK_SUPERBAD_PROFILE } from "./get-brand-dna";

interface CachedContext {
  text: string;
  expiresAt: number;
}

const cache = new Map<ModelTier, CachedContext>();

export function invalidateProfileCache(): void {
  cache.clear();
}

async function getCacheTtlMs(): Promise<number> {
  try {
    const minutes = await settingsRegistry.get("profile.cache_ttl_minutes");
    return minutes * 60 * 1000;
  } catch {
    return 10 * 60 * 1000;
  }
}

async function loadCurrentSections(): Promise<
  Map<BusinessProfileSectionKey, { structured: unknown; prose: string | null }>
> {
  const rows = await db
    .select({
      section_key: business_profile_sections.section_key,
      structured_data: business_profile_sections.structured_data,
      prose_summary: business_profile_sections.prose_summary,
    })
    .from(business_profile_sections)
    .where(eq(business_profile_sections.is_current, true));

  const map = new Map<
    BusinessProfileSectionKey,
    { structured: unknown; prose: string | null }
  >();
  for (const row of rows) {
    map.set(row.section_key as BusinessProfileSectionKey, {
      structured: row.structured_data,
      prose: row.prose_summary,
    });
  }
  return map;
}

async function loadBrandDnaProse(): Promise<string | null> {
  const row = await db
    .select({ prose_portrait: brand_dna_profiles.prose_portrait })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .get();

  return row?.prose_portrait ?? null;
}

function buildOpusContext(
  sections: Map<BusinessProfileSectionKey, { structured: unknown; prose: string | null }>,
  brandDnaProse: string | null,
): string {
  const parts: string[] = ["<superbad-identity>"];

  if (brandDnaProse) {
    parts.push(`## Brand Personality\n${brandDnaProse.slice(0, 800)}`);
  }

  const sectionOrder: BusinessProfileSectionKey[] = [
    "identity",
    "voice_rules",
    "positioning",
    "services",
    "audience",
    "external_design_rules",
    "internal_design_rules",
    "current_focus",
    "social_proof",
    "origin_story",
  ];

  for (const key of sectionOrder) {
    const section = sections.get(key);
    if (!section) continue;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (section.prose) {
      parts.push(`## ${label}\n${section.prose}`);
    }
  }

  parts.push("</superbad-identity>");
  return parts.join("\n\n");
}

function buildSonnetContext(
  sections: Map<BusinessProfileSectionKey, { structured: unknown; prose: string | null }>,
): string {
  const parts: string[] = ["<superbad-identity>"];

  const voiceRules = sections.get("voice_rules");
  if (voiceRules) {
    const data = voiceRules.structured as Record<string, unknown>;
    parts.push(
      `## Voice\n` +
        `Tone: ${data.tone_description ?? "Dry, observational, self-deprecating, slow burn"}\n` +
        `Banned words: ${Array.isArray(data.banned_words) ? (data.banned_words as string[]).join(", ") : "synergy, leverage, solutions"}\n` +
        `Style: ${data.sentence_style ?? "Short sentences. Leave room for the mutter."}\n` +
        `Humour: ${data.humour_rules ?? "Never explain the joke. Real first."}`,
    );
  } else {
    parts.push(
      `## Voice\nTone: ${FALLBACK_SUPERBAD_PROFILE.voiceDescription}\n` +
        `Banned words: ${FALLBACK_SUPERBAD_PROFILE.avoidWords?.join(", ") ?? ""}`,
    );
  }

  const positioning = sections.get("positioning");
  if (positioning?.prose) {
    parts.push(`## Positioning\n${positioning.prose}`);
  }

  const extDesign = sections.get("external_design_rules");
  if (extDesign) {
    const data = extDesign.structured as Record<string, unknown>;
    const designLines: string[] = [];
    if (data.colour_palette) designLines.push(`Colours: ${JSON.stringify(data.colour_palette)}`);
    if (data.overall_feeling) designLines.push(`Feel: ${data.overall_feeling}`);
    if (data.typography_display) designLines.push(`Display font: ${data.typography_display}`);
    if (data.typography_body) designLines.push(`Body font: ${data.typography_body}`);
    if (designLines.length > 0) {
      parts.push(`## External Design Rules\n${designLines.join("\n")}`);
    }
  }

  const intDesign = sections.get("internal_design_rules");
  if (intDesign) {
    const data = intDesign.structured as Record<string, unknown>;
    const designLines: string[] = [];
    if (data.admin_shell) designLines.push(`Shell: ${data.admin_shell}`);
    if (data.page_chrome) designLines.push(`Chrome: ${data.page_chrome}`);
    if (data.motion_house_spring) designLines.push(`Motion: ${data.motion_house_spring}`);
    if (data.no_generic_tailwind) designLines.push(`Style: ${data.no_generic_tailwind}`);
    if (designLines.length > 0) {
      parts.push(`## Internal Design Rules\n${designLines.join("\n")}`);
    }
  }

  parts.push("</superbad-identity>");
  return parts.join("\n\n");
}

function buildHaikuContext(
  sections: Map<BusinessProfileSectionKey, { structured: unknown; prose: string | null }>,
): string {
  const parts: string[] = ["<superbad-identity>"];

  const voiceRules = sections.get("voice_rules");
  const identity = sections.get("identity");

  if (identity) {
    const data = identity.structured as Record<string, unknown>;
    if (data.business_name) {
      parts.push(`Business: ${data.business_name}${data.tagline ? `, ${data.tagline}` : ""}`);
    }
  }

  if (voiceRules) {
    const data = voiceRules.structured as Record<string, unknown>;
    if (Array.isArray(data.tone_markers)) {
      parts.push(`Tone: ${(data.tone_markers as string[]).join(", ")}`);
    }
    if (Array.isArray(data.banned_words)) {
      parts.push(`Never use: ${(data.banned_words as string[]).join(", ")}`);
    }
  } else {
    parts.push(`Tone: ${FALLBACK_SUPERBAD_PROFILE.toneMarkers.join(", ")}`);
    parts.push(`Never use: ${FALLBACK_SUPERBAD_PROFILE.avoidWords?.join(", ") ?? ""}`);
  }

  const extDesign = sections.get("external_design_rules");
  if (extDesign) {
    const data = extDesign.structured as Record<string, unknown>;
    if (data.colour_palette) {
      const palette = data.colour_palette as Record<string, string>;
      parts.push(`Colours: primary ${palette.primary ?? "#B22848"}, bg ${palette.background ?? "#1A1A18"}, text ${palette.text ?? "#FDF5E6"}`);
    }
  }

  parts.push("</superbad-identity>");
  return parts.join("\n");
}

export async function loadSuperBadContext(tier: ModelTier): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(tier);
  if (cached && now < cached.expiresAt) return cached.text;

  const [sections, brandDnaProse, ttlMs] = await Promise.all([
    loadCurrentSections(),
    tier === "opus" ? loadBrandDnaProse() : Promise.resolve(null),
    getCacheTtlMs(),
  ]);

  if (sections.size === 0 && !brandDnaProse) return null;

  let text: string;
  switch (tier) {
    case "opus":
      text = buildOpusContext(sections, brandDnaProse);
      break;
    case "sonnet":
      text = buildSonnetContext(sections);
      break;
    case "haiku":
      text = buildHaikuContext(sections);
      break;
  }

  cache.set(tier, { text, expiresAt: now + ttlMs });
  return text;
}

export async function hasAnyProfileContent(): Promise<boolean> {
  const row = await db
    .select({ id: business_profile_sections.id })
    .from(business_profile_sections)
    .where(eq(business_profile_sections.is_current, true))
    .limit(1)
    .get();

  if (row) return true;

  const brandDna = await db
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .limit(1)
    .get();

  return !!brandDna;
}
