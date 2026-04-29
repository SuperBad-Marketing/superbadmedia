"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { companies } from "@/lib/db/schema/companies";
import type { ViabilityProfile } from "@/lib/lead-gen/types";

export type SocialProfileFields = {
  instagram_handle: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  tiktok_url: string | null;
};

type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveCandidateSocialProfiles(
  candidateId: string,
  fields: SocialProfileFields,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  await db
    .update(leadCandidates)
    .set({
      instagram_handle: fields.instagram_handle || null,
      youtube_url: fields.youtube_url || null,
      facebook_url: fields.facebook_url || null,
      linkedin_url: fields.linkedin_url || null,
      tiktok_url: fields.tiktok_url || null,
    })
    .where(eq(leadCandidates.id, candidateId));

  revalidatePath("/lite/admin/lead-gen");
  return { ok: true };
}

export async function saveCompanySocialProfiles(
  companyId: string,
  fields: SocialProfileFields,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  await db
    .update(companies)
    .set({
      instagram_handle: fields.instagram_handle || null,
      youtube_url: fields.youtube_url || null,
      facebook_url: fields.facebook_url || null,
      linkedin_url: fields.linkedin_url || null,
      tiktok_url: fields.tiktok_url || null,
    })
    .where(eq(companies.id, companyId));

  revalidatePath(`/lite/admin/companies/${companyId}`);
  revalidatePath("/lite/admin/pipeline");
  return { ok: true };
}

const SIGNAL_KEYS = [
  "instagram",
  "youtube",
  "facebook",
  "linkedin",
  "tiktok",
  "maps",
  "website",
  "meta_ads",
  "google_ads",
  "website_content",
] as const;

type SignalKey = (typeof SIGNAL_KEYS)[number];

export async function removeEnrichmentSignal(
  target: { candidateId: string } | { companyId: string },
  signal: string,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  if (!SIGNAL_KEYS.includes(signal as SignalKey)) {
    return { ok: false, error: "Unknown signal." };
  }

  if ("candidateId" in target) {
    const [row] = await db
      .select({ viability_profile_json: leadCandidates.viability_profile_json })
      .from(leadCandidates)
      .where(eq(leadCandidates.id, target.candidateId))
      .limit(1);
    if (!row) return { ok: false, error: "Not found." };

    const profile = (row.viability_profile_json ?? {}) as Record<string, unknown>;
    delete profile[signal];
    if (profile.social_profiles && signal in socialSignalMap) {
      const sp = profile.social_profiles as Record<string, unknown>;
      const urlKey = socialSignalMap[signal as keyof typeof socialSignalMap];
      if (urlKey) sp[urlKey] = null;
    }

    await db
      .update(leadCandidates)
      .set({ viability_profile_json: profile })
      .where(eq(leadCandidates.id, target.candidateId));

    revalidatePath("/lite/admin/lead-gen");
  } else {
    const row = await db
      .select({ viability_profile_json: companies.viability_profile_json })
      .from(companies)
      .where(eq(companies.id, target.companyId))
      .get();
    if (!row) return { ok: false, error: "Not found." };

    const profile = (row.viability_profile_json ?? {}) as Record<string, unknown>;
    delete profile[signal];
    if (profile.social_profiles && signal in socialSignalMap) {
      const sp = profile.social_profiles as Record<string, unknown>;
      const urlKey = socialSignalMap[signal as keyof typeof socialSignalMap];
      if (urlKey) sp[urlKey] = null;
    }

    await db
      .update(companies)
      .set({ viability_profile_json: profile })
      .where(eq(companies.id, target.companyId));

    revalidatePath(`/lite/admin/companies/${target.companyId}`);
    revalidatePath("/lite/admin/pipeline");
  }

  return { ok: true };
}

const socialSignalMap: Partial<Record<SignalKey, string>> = {
  instagram: "instagram_url",
  youtube: "youtube_url",
  facebook: "facebook_url",
  linkedin: "linkedin_url",
  tiktok: "tiktok_url",
};
