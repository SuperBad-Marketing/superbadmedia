/**
 * Auto-enrichment trigger for newly created deals.
 *
 * Called after createDealFromLead() for non-Rundown sources. Rundown
 * already enriches at entry time, so this only fires for manual leads,
 * intro-funnel submissions, and other ingress paths.
 *
 * Runs asynchronously — never blocks deal creation.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { logActivity } from "@/lib/activity-log";

/**
 * Fire-and-forget enrichment for a company after deal creation.
 * Silently no-ops if enrichment data already exists or there's no domain.
 */
export async function autoEnrichCompanyIfNeeded(
  companyId: string,
  opts?: { by?: string },
): Promise<void> {
  try {
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();

    if (!company) return;

    // Skip if no domain — nothing to enrich against
    if (!company.domain) return;

    // Skip if already has enrichment data
    const existing = company.viability_profile_json as Record<
      string,
      unknown
    > | null;
    if (existing && Object.keys(existing).length > 0) return;

    const { enrichCandidate } = await import("@/lib/lead-gen/enrich");

    const result = await enrichCandidate({
      company_name: company.name,
      domain: company.domain,
      source: "google_maps",
      partial_profile: {},
    });

    await db
      .update(companies)
      .set({ viability_profile_json: result.profile })
      .where(eq(companies.id, companyId));

    await logActivity({
      kind: "company_enriched",
      companyId,
      body: `Auto-enriched ${company.name} (${result.signals_succeeded}/${result.signals_attempted} signals)`,
      createdBy: opts?.by ?? "system:auto_enrich",
      meta: {
        trigger: "deal_creation",
        signals_attempted: result.signals_attempted,
        signals_succeeded: result.signals_succeeded,
        duration_ms: result.enrichment_duration_ms,
      },
    });
  } catch {
    // Auto-enrich is best-effort — never block the caller
  }
}
