"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { companies } from "@/lib/db/schema/companies";
import { logActivity } from "@/lib/activity-log";

type ReEnrichResult =
  | { ok: true; signalsSucceeded: number; signalsAttempted: number }
  | { ok: false; error: string };

/**
 * Re-run enrichment for a lead candidate. Updates viability_profile_json
 * on the lead_candidates row.
 */
export async function reEnrichCandidate(
  candidateId: string,
): Promise<ReEnrichResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const [candidate] = await db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, candidateId))
    .limit(1);

  if (!candidate) return { ok: false, error: "Candidate not found." };

  const { enrichCandidate } = await import("@/lib/lead-gen/enrich");
  const existingProfile = (candidate.viability_profile_json ?? {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await enrichCandidate({
      company_name: candidate.company_name,
      domain: candidate.domain,
      source: candidate.sourced_from as
        | "google_maps"
        | "meta_ad_library"
        | "google_ads_transparency"
        | "instagram_location",
      partial_profile: {
        maps: existingProfile.maps as never,
        meta_ads: existingProfile.meta_ads as never,
        google_ads: existingProfile.google_ads as never,
      },
    });

    await db
      .update(leadCandidates)
      .set({ viability_profile_json: result.profile })
      .where(eq(leadCandidates.id, candidateId));

    const by = `user:${session.user.id ?? "admin"}`;
    await logActivity({
      kind: "lead_candidate_updated",
      body: `Re-enriched ${candidate.company_name} (${result.signals_succeeded}/${result.signals_attempted} signals)`,
      createdBy: by,
      meta: {
        candidate_id: candidateId,
        signals_attempted: result.signals_attempted,
        signals_succeeded: result.signals_succeeded,
        duration_ms: result.enrichment_duration_ms,
      },
    });

    revalidatePath("/lite/admin/lead-gen");
    revalidatePath("/lite/admin/pipeline");

    return {
      ok: true,
      signalsSucceeded: result.signals_succeeded,
      signalsAttempted: result.signals_attempted,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Enrichment failed — try again.",
    };
  }
}

/**
 * Re-run enrichment for a company. Updates viability_profile_json
 * on the companies row.
 */
export async function reEnrichCompany(
  companyId: string,
): Promise<ReEnrichResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!company) return { ok: false, error: "Company not found." };

  if (!company.domain) {
    return {
      ok: false,
      error: "No domain on file — enrichment needs a domain or social profile.",
    };
  }

  const { enrichCandidate } = await import("@/lib/lead-gen/enrich");
  const existingProfile = (company.viability_profile_json ?? {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await enrichCandidate({
      company_name: company.name,
      domain: company.domain,
      source: "google_maps",
      partial_profile: {
        maps: existingProfile.maps as never,
        meta_ads: existingProfile.meta_ads as never,
        google_ads: existingProfile.google_ads as never,
      },
    });

    await db
      .update(companies)
      .set({ viability_profile_json: result.profile })
      .where(eq(companies.id, companyId));

    const by = `user:${session.user.id ?? "admin"}`;
    await logActivity({
      kind: "company_enriched",
      companyId,
      body: `Enriched ${company.name} (${result.signals_succeeded}/${result.signals_attempted} signals)`,
      createdBy: by,
      meta: {
        signals_attempted: result.signals_attempted,
        signals_succeeded: result.signals_succeeded,
        duration_ms: result.enrichment_duration_ms,
      },
    });

    revalidatePath(`/lite/admin/companies/${companyId}`);
    revalidatePath("/lite/admin/pipeline");

    return {
      ok: true,
      signalsSucceeded: result.signals_succeeded,
      signalsAttempted: result.signals_attempted,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Enrichment failed — try again.",
    };
  }
}
