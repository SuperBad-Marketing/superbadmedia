import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import type { BrandDnaProfile } from "@/lib/ai/drift-check";

type DatabaseLike = typeof defaultDb;

/**
 * Fallback profile used when the SuperBad brand DNA assessment hasn't
 * been completed yet (early dev / fresh-start envs / tests). Mirrors the
 * voice rules in CLAUDE.md so drift checks have a meaningful baseline
 * before BDA-* lands data.
 */
const FALLBACK_SUPERBAD_PROFILE: BrandDnaProfile = {
  voiceDescription:
    "Dry, observational, self-deprecating, slow burn. Melbourne wit. Honest first. Never explains the joke.",
  toneMarkers: ["dry", "observational", "self-deprecating", "honest", "low-key"],
  avoidWords: ["synergy", "leverage", "solutions", "stakeholder", "ecosystem", "unlock", "deliver value"],
  targetAudience: "Australian small to mid-size business owners deciding whether to engage SuperBad Marketing.",
};

/**
 * Read SuperBad's own brand DNA profile (the `superbad_self` row) and
 * map it to the `BrandDnaProfile` shape the drift grader consumes. If
 * the assessment hasn't been completed yet, return a hard-coded fallback
 * so quote sends still get drift-checked against a sensible baseline.
 */
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

  // Map BDA assessment output → drift-grader profile shape. Tag map is
  // dense JSON; only the prose portrait + signal tags surface for drift.
  let toneMarkers: string[] = [];
  try {
    const tags = row.signal_tags ? (JSON.parse(row.signal_tags) as Record<string, unknown>) : null;
    if (tags && typeof tags === "object") {
      toneMarkers = Object.keys(tags).slice(0, 8);
    }
  } catch {
    // signal_tags parse failure → fall back to seed markers
  }

  return {
    voiceDescription: row.prose_portrait.slice(0, 600),
    toneMarkers: toneMarkers.length > 0 ? toneMarkers : FALLBACK_SUPERBAD_PROFILE.toneMarkers,
    avoidWords: FALLBACK_SUPERBAD_PROFILE.avoidWords,
    targetAudience: FALLBACK_SUPERBAD_PROFILE.targetAudience,
  };
}
