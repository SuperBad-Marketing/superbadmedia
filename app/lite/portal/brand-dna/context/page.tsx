import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getPortalSession } from "@/lib/portal/guard";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

import { BusinessContextClient } from "@/app/lite/brand-dna/context/business-context-client";
import { submitPortalBusinessContext } from "../actions";

export default async function PortalBusinessContextPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const { profileId: profileIdParam } = await searchParams;

  let profileId = profileIdParam;
  if (!profileId) {
    const rows = await db
      .select({ id: brand_dna_profiles.id })
      .from(brand_dna_profiles)
      .where(
        and(
          eq(brand_dna_profiles.contact_id, session.contactId),
          eq(brand_dna_profiles.subject_type, "client"),
          eq(brand_dna_profiles.is_current, true),
        ),
      )
      .limit(1);

    profileId = rows[0]?.id;
  }

  if (!profileId) {
    redirect("/lite/portal/brand-dna");
  }

  const profileRows = await db
    .select({
      track: brand_dna_profiles.track,
      business_context: brand_dna_profiles.business_context,
      current_section: brand_dna_profiles.current_section,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = profileRows[0];

  if (!profile?.track) {
    redirect("/lite/portal/brand-dna");
  }

  if (profile.business_context && (profile.current_section ?? 0) >= 1) {
    redirect(
      `/lite/portal/brand-dna/section/${Math.max(1, profile.current_section ?? 1)}?profileId=${profileId}`,
    );
  }

  return (
    <BusinessContextClient
      profileId={profileId}
      submitAction={submitPortalBusinessContext}
    />
  );
}
