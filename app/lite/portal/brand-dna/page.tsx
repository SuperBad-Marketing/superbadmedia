import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";

import { getPortalSession } from "@/lib/portal/guard";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

import { AlignmentGateClient } from "@/app/lite/brand-dna/alignment-gate-client";
import { submitPortalAlignmentGate } from "./actions";

/**
 * Portal Brand DNA entry — alignment gate or resume.
 *
 * If a current client profile exists and is in-progress, resumes.
 * If complete, redirects to the profile view.
 * Otherwise, shows the alignment gate.
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const params = await searchParams;

  const existing = await db
    .select()
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.contact_id, session.contactId),
        eq(brand_dna_profiles.subject_type, "client"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .limit(1);

  const profile = existing[0];

  if (profile) {
    if (profile.status === "complete") {
      redirect("/lite/portal/brand-dna/profile");
    }
    if (profile.status === "in_progress" && profile.track) {
      if (!profile.business_context) {
        redirect(`/lite/portal/brand-dna/context?profileId=${profile.id}`);
      }
      const section = profile.current_section ?? 1;
      redirect(
        `/lite/portal/brand-dna/section/${section}?profileId=${profile.id}`,
      );
    }
  }

  return (
    <AlignmentGateClient
      submitAction={submitPortalAlignmentGate}
      errorParam={params.error}
    />
  );
}
