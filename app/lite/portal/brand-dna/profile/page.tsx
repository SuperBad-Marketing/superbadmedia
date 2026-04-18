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

  const sectionInsights: string[] = profile.section_insights
    ? (JSON.parse(profile.section_insights) as string[]).filter(
        (s) => typeof s === "string" && s.length > 0,
      )
    : [];

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

  return (
    <ProfileViewClient
      displayName={profile.subject_display_name ?? "Your"}
      firstImpression={profile.first_impression ?? ""}
      prosePortrait={profile.prose_portrait ?? ""}
      sectionInsights={sectionInsights}
      sectionTitles={([1, 2, 3, 4, 5] as const).map((n) => SECTION_TITLES[n])}
      version={profile.version}
      needsRegeneration={profile.needs_regeneration}
      blendPortrait={blendPortrait}
      blendDivergences={blendDivergences}
    />
  );
}
