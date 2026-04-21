import { db } from "@/lib/db";
import { activity_log, type ActivityLogKind } from "@/lib/db/schema/activity-log";
import { and, gte, inArray, desc } from "drizzle-orm";

const ANDY_FACING_KINDS: ActivityLogKind[] = [
  "task_status_changed",
  "task_approved",
  "task_rejected",
  "quote_sent",
  "quote_accepted",
  "quote_expired",
  "invoice_sent",
  "invoice_overdue",
  "invoice_paid_online",
  "saas_subscription_created",
  "saas_subscription_cancelled",
  "saas_payment_failed_lockout",
  "saas_payment_recovered",
  "stage_change",
  "outreach_replied",
  "intro_funnel_paid",
  "intro_funnel_cancelled_refunded",
  "intro_funnel_no_show",
  "assessment_completed",
  "content_draft_approved",
  "content_post_published",
  "candidate_applied",
  "candidate_trial_delivered",
  "candidate_trial_reviewed",
  "referral_submitted",
];

export type AndyFacingEvent = {
  type: ActivityLogKind;
  entity: string;
  time: number;
  body: string;
};

export async function getAndyFacingActivitySince(
  sinceMs: number,
  limit = 50,
): Promise<AndyFacingEvent[]> {
  const rows = await db
    .select({
      kind: activity_log.kind,
      body: activity_log.body,
      created_at_ms: activity_log.created_at_ms,
      company_id: activity_log.company_id,
      deal_id: activity_log.deal_id,
    })
    .from(activity_log)
    .where(
      and(
        inArray(activity_log.kind, ANDY_FACING_KINDS),
        gte(activity_log.created_at_ms, sinceMs),
      ),
    )
    .orderBy(desc(activity_log.created_at_ms))
    .limit(limit);

  return rows.map((r) => ({
    type: r.kind,
    entity: r.company_id ?? r.deal_id ?? "system",
    time: r.created_at_ms,
    body: r.body,
  }));
}
