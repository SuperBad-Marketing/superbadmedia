/**
 * Lead candidate deduplication.
 *
 * Filters a batch of discovery candidates against three layers:
 *   1. lead_candidates table — domain seen within the dedup window
 *   2. deals table (via companies) — domain already has an active deal
 *   3. DNC lists — isBlockedFromOutreach()
 *
 * Also deduplicates within the current batch (first occurrence wins).
 *
 * Owner: LG-4. Consumer: LG-4 orchestrator.
 */

import { and, eq, gte, isNotNull } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { isBlockedFromOutreach } from "./dnc";
import type { DiscoveryCandidate } from "./types";

export async function deduplicateCandidates(
  candidates: DiscoveryCandidate[],
  dedupWindowDays: number,
  dbInstance = defaultDb,
): Promise<DiscoveryCandidate[]> {
  if (candidates.length === 0) return [];

  const windowMs = dedupWindowDays * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - windowMs);

  // Layer 1: domains seen in lead_candidates within dedup window
  const recentRows = await dbInstance
    .select({ domain: leadCandidates.domain })
    .from(leadCandidates)
    .where(and(isNotNull(leadCandidates.domain), gte(leadCandidates.created_at, since)));

  const seenDomains = new Set<string>();
  for (const row of recentRows) {
    if (row.domain) seenDomains.add(row.domain.toLowerCase());
  }

  // Layer 2: company domains that already have at least one deal
  const dealtRows = await dbInstance
    .select({ domain: companies.domain })
    .from(companies)
    .innerJoin(deals, eq(deals.company_id, companies.id))
    .where(isNotNull(companies.domain));

  for (const row of dealtRows) {
    if (row.domain) seenDomains.add(row.domain.toLowerCase());
  }

  const survivors: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const domain = candidate.domain?.toLowerCase() ?? null;

    // Deduplicate against known domains (layers 1 + 2 + prior batch entries)
    if (domain && seenDomains.has(domain)) continue;

    // Layer 3: DNC check via domain-level lookup
    // Candidates don't have contact_email yet (Hunter.io is LG-8).
    // A synthetic address triggers the domain-level DNC path.
    if (domain) {
      const block = await isBlockedFromOutreach(
        `dedup@${domain}`,
        undefined,
        dbInstance,
      );
      if (block.blocked) continue;
    }

    // Mark domain as seen so within-batch duplicates are filtered
    if (domain) seenDomains.add(domain);
    survivors.push(candidate);
  }

  return survivors;
}
