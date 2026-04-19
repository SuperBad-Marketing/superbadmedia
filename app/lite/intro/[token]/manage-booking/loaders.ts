import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_bookings } from "@/lib/db/schema/intro-funnel-bookings";

export async function loadBookingForSubmission(submissionId: string) {
  const rows = await db
    .select()
    .from(intro_funnel_bookings)
    .where(eq(intro_funnel_bookings.submission_id, submissionId))
    .limit(1);
  return rows[0] ?? null;
}
