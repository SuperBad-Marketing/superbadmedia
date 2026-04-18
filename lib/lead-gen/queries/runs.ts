import "server-only";
import { db } from "@/lib/db";
import { leadRuns } from "@/lib/db/schema/lead-runs";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { desc, eq } from "drizzle-orm";

export async function getRecentRuns(limit = 30) {
  return db
    .select()
    .from(leadRuns)
    .orderBy(desc(leadRuns.run_started_at))
    .limit(limit);
}

export async function getCandidatesForRun(runId: string) {
  return db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.lead_run_id, runId))
    .orderBy(desc(leadCandidates.created_at));
}
