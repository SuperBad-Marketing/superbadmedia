/**
 * Candidate creation — builds a `lead_candidates` row from enriched +
 * scored data. Step 11 of §3.4.
 *
 * Owner: LG-4. Consumer: daily search runner.
 */

import { randomUUID } from "node:crypto";
import { db as defaultDb } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { logActivity } from "@/lib/activity-log";
import type { DiscoveredCandidate, ViabilityProfile } from "./types";
import type { TrackAssignment } from "./scoring";

export interface CreateCandidateInput {
  discovered: DiscoveredCandidate;
  enrichedProfile: ViabilityProfile;
  trackAssignment: TrackAssignment;
  leadRunId: string;
  contactEmail?: string;
  contactName?: string | null;
  contactRole?: string | null;
  contactPhone?: string | null;
  emailConfidence?: "verified" | "inferred" | "unknown";
}

export interface CreateCandidateResult {
  candidateId: string;
  track: "saas" | "retainer";
  score: number;
}

/**
 * Insert a fully enriched + scored candidate into `lead_candidates`.
 * Also writes to the activity log (§12.R).
 *
 * The candidate's `scoring_debug_json` is populated for downstream
 * auditability (§12.D).
 */
export async function createCandidate(
  input: CreateCandidateInput,
  dbInstance = defaultDb,
): Promise<CreateCandidateResult> {
  const { discovered, enrichedProfile, trackAssignment, leadRunId } = input;

  if (trackAssignment.track === null) {
    throw new Error(
      "Cannot create candidate with null track — must pass qualification floor",
    );
  }

  const candidateId = randomUUID();

  await dbInstance.insert(leadCandidates).values({
    id: candidateId,
    company_name: discovered.company_name,
    domain: discovered.domain ?? null,
    contact_email: input.contactEmail ?? null,
    contact_name: input.contactName ?? null,
    contact_role: input.contactRole ?? null,
    contact_phone: input.contactPhone ?? null,
    email_confidence: input.emailConfidence ?? null,
    viability_profile_json: enrichedProfile,
    saas_score: trackAssignment.saas.score,
    retainer_score: trackAssignment.retainer.score,
    qualified_track: trackAssignment.track,
    scoring_debug_json: {
      saas: trackAssignment.saas.breakdown,
      retainer: trackAssignment.retainer.breakdown,
      winner: trackAssignment.track,
      soft_adjustment: 0,
    },
    soft_adjustment: 0,
    lead_run_id: leadRunId,
    sourced_from: discovered.source,
    created_at: new Date(),
  });

  await logActivity({
    kind: "candidate_rescored",
    body: `Candidate created: ${discovered.company_name} → ${trackAssignment.track} (score ${trackAssignment.score})`,
    meta: {
      event: "created",
      candidate_id: candidateId,
      track: trackAssignment.track,
      saas_score: trackAssignment.saas.score,
      retainer_score: trackAssignment.retainer.score,
      source: discovered.source,
    },
  });

  return {
    candidateId,
    track: trackAssignment.track,
    score: trackAssignment.score,
  };
}
