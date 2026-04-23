import "server-only";
import { db } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { desc, eq } from "drizzle-orm";

export async function getAllCandidates(limit = 200) {
  return db
    .select()
    .from(leadCandidates)
    .orderBy(desc(leadCandidates.created_at))
    .limit(limit);
}

export async function getCandidateById(id: string) {
  const [row] = await db
    .select()
    .from(leadCandidates)
    .where(eq(leadCandidates.id, id))
    .limit(1);
  return row ?? null;
}
