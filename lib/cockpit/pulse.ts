import { db } from "@/lib/db";
import { activity_log } from "@/lib/db/schema/activity-log";
import { gte, sql } from "drizzle-orm";
import { melbourneStartAndEndOfDay } from "@/lib/time/melbourne";

export interface PulseData {
  actionsOvernight: number;
  emailsSent: number;
  contentScheduled: number;
}

export async function getOvernightPulse(nowMs: number = Date.now()): Promise<PulseData> {
  const { startMs } = melbourneStartAndEndOfDay(nowMs);

  const rows = await db
    .select({
      kind: activity_log.kind,
      count: sql<number>`count(*)`,
    })
    .from(activity_log)
    .where(gte(activity_log.created_at_ms, startMs))
    .groupBy(activity_log.kind)
    .all();

  let total = 0;
  let emailsSent = 0;
  let contentScheduled = 0;

  for (const r of rows) {
    total += r.count;
    if (r.kind === "outreach_sent" || r.kind === "email_sent") {
      emailsSent += r.count;
    }
    if (r.kind === "content_post_published" || r.kind === "content_draft_approved") {
      contentScheduled += r.count;
    }
  }

  return {
    actionsOvernight: total,
    emailsSent,
    contentScheduled,
  };
}
