/**
 * Funnel history lookup for cold re-engagement drafts — spec §14.6 (Q12).
 *
 * When a prospect who abandoned the intro funnel re-enters the cold
 * outreach pool, `generateDraft()` calls `fetchFunnelHistory()` to
 * inject their prior journey as prompt context. No special template —
 * Claude decides the re-engagement angle from what it sees.
 */

import { eq, and } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { twilio_sms_log } from "@/lib/db/schema/twilio-sms-log";

export interface FunnelHistory {
  businessName: string;
  shape: string;
  sectionsCompleted: number;
  signalTags: string[];
  abandonedAtMs: number;
  daysSinceAbandonment: number;
  hadSmsReplies: boolean;
  questionnaireSummary: Record<string, unknown> | null;
}

export async function fetchFunnelHistory(
  email: string,
  dbInstance = defaultDb,
  nowMs = Date.now(),
): Promise<FunnelHistory | null> {
  const submissions = await dbInstance
    .select()
    .from(intro_funnel_submissions)
    .where(
      and(
        eq(intro_funnel_submissions.submitted_email, email.toLowerCase()),
        eq(intro_funnel_submissions.abandon_sequence_state, "demoted"),
      ),
    );

  if (submissions.length === 0) return null;

  const sub = submissions.reduce((latest, s) =>
    s.updated_at_ms > latest.updated_at_ms ? s : latest,
  );

  const inboundSms = await dbInstance
    .select({ id: twilio_sms_log.id })
    .from(twilio_sms_log)
    .where(
      and(
        eq(twilio_sms_log.submission_id, sub.id),
        eq(twilio_sms_log.direction, "inbound"),
      ),
    )
    .limit(1);

  const signalTags = Array.isArray(sub.signal_tags_json)
    ? (sub.signal_tags_json as string[])
    : [];

  return {
    businessName: sub.submitted_business_name,
    shape: sub.shape.replace(/_/g, " "),
    sectionsCompleted: sub.questionnaire_sections_completed,
    signalTags,
    abandonedAtMs: sub.updated_at_ms,
    daysSinceAbandonment: Math.floor(
      (nowMs - sub.updated_at_ms) / (24 * 60 * 60 * 1000),
    ),
    hadSmsReplies: inboundSms.length > 0,
    questionnaireSummary:
      sub.questionnaire_answers_json as Record<string, unknown> | null,
  };
}
