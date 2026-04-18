import "server-only";
import { db } from "@/lib/db";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { desc, eq, inArray } from "drizzle-orm";

export type QueueDraft = Awaited<ReturnType<typeof getPendingDrafts>>[number];

export async function getPendingDrafts(trackFilter?: "saas" | "retainer") {
  const drafts = await db
    .select()
    .from(outreachDrafts)
    .where(
      inArray(outreachDrafts.status, ["pending_approval", "approved_queued"]),
    )
    .orderBy(desc(outreachDrafts.created_at));

  const candidateIds = drafts
    .map((d) => d.candidate_id)
    .filter((id): id is string => id != null);

  const candidates =
    candidateIds.length > 0
      ? await db
          .select()
          .from(leadCandidates)
          .where(inArray(leadCandidates.id, candidateIds))
      : [];

  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  const enriched = drafts.map((draft) => ({
    ...draft,
    candidate: draft.candidate_id
      ? candidateMap.get(draft.candidate_id) ?? null
      : null,
  }));

  if (!trackFilter) return enriched;
  return enriched.filter((d) => d.candidate?.qualified_track === trackFilter);
}
