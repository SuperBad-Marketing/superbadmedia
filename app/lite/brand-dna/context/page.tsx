import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

import { submitBusinessContext } from "../actions";
import { BusinessContextClient } from "./business-context-client";

export const metadata: Metadata = {
  title: "Brand DNA — Tell us about the business",
};

export default async function BusinessContextPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/lite/login");
  }

  const existing = await db
    .select({
      id: brand_dna_profiles.id,
      track: brand_dna_profiles.track,
      business_context: brand_dna_profiles.business_context,
      current_section: brand_dna_profiles.current_section,
      status: brand_dna_profiles.status,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .limit(1);

  const profile = existing[0];

  if (!profile?.track) {
    redirect("/lite/brand-dna");
  }

  if (profile.business_context && profile.current_section >= 1) {
    redirect(`/lite/brand-dna/section/${Math.max(1, profile.current_section)}`);
  }

  return (
    <BusinessContextClient
      profileId={profile.id}
      submitAction={submitBusinessContext}
    />
  );
}
