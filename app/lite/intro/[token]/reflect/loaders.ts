import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_reflections } from "@/lib/db/schema/intro-funnel-reflections";

export async function loadReflection(submissionId: string) {
  const rows = await db
    .select()
    .from(intro_funnel_reflections)
    .where(eq(intro_funnel_reflections.submission_id, submissionId))
    .limit(1);
  return rows[0] ?? null;
}
