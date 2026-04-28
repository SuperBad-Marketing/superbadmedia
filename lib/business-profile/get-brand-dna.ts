import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import type { BrandDnaProfile } from "@/lib/ai/drift-check";

type DatabaseLike = typeof defaultDb;

export const FALLBACK_SUPERBAD_PROFILE: BrandDnaProfile = {
  voiceDescription:
    "Dry, observational, self-deprecating, slow burn. Melbourne wit. Honest first. Never explains the joke.",
  toneMarkers: ["dry", "observational", "self-deprecating", "honest", "low-key"],
  avoidWords: ["synergy", "leverage", "solutions", "stakeholder", "ecosystem", "unlock", "deliver value"],
  targetAudience: "Australian small to mid-size business owners deciding whether to engage SuperBad Marketing.",
};

export async function getSuperbadBrandProfile(
  dbOverride?: DatabaseLike,
): Promise<BrandDnaProfile> {
  const database = dbOverride ?? defaultDb;
  const row = await database
    .select()
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .get();

  if (!row || !row.prose_portrait) return FALLBACK_SUPERBAD_PROFILE;

  let toneMarkers: string[] = [];
  try {
    const tags = row.signal_tags ? (JSON.parse(row.signal_tags) as Record<string, unknown>) : null;
    if (tags && typeof tags === "object") {
      toneMarkers = Object.keys(tags).slice(0, 8);
    }
  } catch {
    // signal_tags parse failure — fall back to seed markers
  }

  return {
    voiceDescription: row.prose_portrait.slice(0, 600),
    toneMarkers: toneMarkers.length > 0 ? toneMarkers : FALLBACK_SUPERBAD_PROFILE.toneMarkers,
    avoidWords: FALLBACK_SUPERBAD_PROFILE.avoidWords,
    targetAudience: FALLBACK_SUPERBAD_PROFILE.targetAudience,
  };
}
