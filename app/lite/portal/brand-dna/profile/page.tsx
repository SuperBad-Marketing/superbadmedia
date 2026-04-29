import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";

import { getPortalSession } from "@/lib/portal/guard";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_blends } from "@/lib/db/schema/brand-dna-blends";
import { SECTION_TITLES } from "@/lib/brand-dna/question-bank";

import { ProfileViewClient } from "./profile-view-client";

/**
 * Portal Brand DNA — completed profile view.
 *
 * Permanent, revisitable page showing the full profile. Includes retake
 * trigger and company blend (when ≥2 stakeholders exist).
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaProfilePage() {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const profileRows = await db
    .select()
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.contact_id, session.contactId),
        eq(brand_dna_profiles.subject_type, "client"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .limit(1);

  const profile = profileRows[0];
  if (!profile) {
    redirect("/lite/portal/brand-dna");
  }

  const sectionInsights: string[] = parseSectionInsights(profile.section_insights);

  let blendPortrait: string | null = null;
  let blendDivergences: Array<{
    domain: string;
    tag: string;
    description: string;
  }> = [];

  if (profile.company_id) {
    const blendRows = await db
      .select()
      .from(brand_dna_blends)
      .where(eq(brand_dna_blends.company_id, profile.company_id))
      .orderBy(desc(brand_dna_blends.created_at_ms))
      .limit(1);

    const blend = blendRows[0];
    if (blend) {
      blendPortrait = blend.prose_portrait;
      try {
        blendDivergences = JSON.parse(blend.divergences_json ?? "[]");
      } catch {
        blendDivergences = [];
      }
    }
  }

  const signalTags = parseSignalTags(profile.signal_tags);

  return (
    <ProfileViewClient
      displayName={profile.subject_display_name ?? "Your"}
      firstImpression={profile.first_impression ?? ""}
      prosePortrait={profile.prose_portrait ?? ""}
      sectionInsights={sectionInsights}
      sectionTitles={([1, 2, 3, 4, 5] as const).map((n) => SECTION_TITLES[n])}
      signalTags={signalTags}
      version={profile.version}
      needsRegeneration={profile.needs_regeneration}
      blendPortrait={blendPortrait}
      blendDivergences={blendDivergences}
    />
  );
}

function parseSectionInsights(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === "string" && s.length > 0);
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.values(parsed).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
    }
  } catch { /* malformed JSON */ }
  return [];
}

function parseSignalTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s): s is string => typeof s === "string")
        .slice(0, 8)
        .map((t) => t.replace(/_/g, " "));
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as Record<string, number>)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 8)
        .map(([tag]) => tag.replace(/_/g, " "));
    }
  } catch { /* malformed JSON */ }
  return [];
}
