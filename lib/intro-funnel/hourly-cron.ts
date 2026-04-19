/**
 * Hourly cron handler for Intro Funnel time-based state transitions.
 *
 * Transitions:
 *   shoot_booked → shoot_approaching (48h before slot_start_at)
 *   shoot_approaching → shoot_morning_of (6am local on day of)
 *   shoot_morning_of → shoot_completed_awaiting_deliverables (1h after slot_end_at)
 *
 * Owner: IF-2.
 */
import { eq, and, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_submissions, type FunnelState } from "@/lib/db/schema/intro-funnel-submissions";
import { intro_funnel_bookings } from "@/lib/db/schema/intro-funnel-bookings";
import { logActivity } from "@/lib/activity-log";

const HOURS_48 = 48 * 60 * 60 * 1000;
const HOURS_1 = 60 * 60 * 1000;

function getMelbourneHour(): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
}

function getMelbourneDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

interface TransitionResult {
  transitioned: number;
  errors: string[];
}

export async function runIntroFunnelHourlyCron(): Promise<TransitionResult> {
  const now = Date.now();
  let transitioned = 0;
  const errors: string[] = [];

  // 1. shoot_booked → shoot_approaching (48h before slot_start_at)
  const bookedSubs = await db
    .select({
      submission: intro_funnel_submissions,
      booking: intro_funnel_bookings,
    })
    .from(intro_funnel_submissions)
    .innerJoin(
      intro_funnel_bookings,
      eq(intro_funnel_bookings.submission_id, intro_funnel_submissions.id),
    )
    .where(
      and(
        eq(intro_funnel_submissions.funnel_state, "shoot_booked"),
        eq(intro_funnel_bookings.status, "booked"),
      ),
    );

  for (const { submission, booking } of bookedSubs) {
    if (booking.slot_start_at_ms - now <= HOURS_48) {
      try {
        await transitionState(submission.id, submission.deal_id, "shoot_approaching");
        transitioned++;
      } catch (e) {
        errors.push(`shoot_approaching transition failed for ${submission.id}: ${e}`);
      }
    }
  }

  // 2. shoot_approaching → shoot_morning_of (6am local on day of shoot)
  const approachingSubs = await db
    .select({
      submission: intro_funnel_submissions,
      booking: intro_funnel_bookings,
    })
    .from(intro_funnel_submissions)
    .innerJoin(
      intro_funnel_bookings,
      eq(intro_funnel_bookings.submission_id, intro_funnel_submissions.id),
    )
    .where(
      and(
        eq(intro_funnel_submissions.funnel_state, "shoot_approaching"),
        eq(intro_funnel_bookings.status, "booked"),
      ),
    );

  const todayStr = getMelbourneDateStr();
  const melHour = getMelbourneHour();

  for (const { submission, booking } of approachingSubs) {
    const bookingDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(booking.slot_start_at_ms));

    if (bookingDateStr === todayStr && melHour >= 6) {
      try {
        await transitionState(submission.id, submission.deal_id, "shoot_morning_of");
        transitioned++;
      } catch (e) {
        errors.push(`shoot_morning_of transition failed for ${submission.id}: ${e}`);
      }
    }
  }

  // 3. shoot_morning_of → shoot_completed_awaiting_deliverables (1h after slot_end_at)
  const morningOfSubs = await db
    .select({
      submission: intro_funnel_submissions,
      booking: intro_funnel_bookings,
    })
    .from(intro_funnel_submissions)
    .innerJoin(
      intro_funnel_bookings,
      eq(intro_funnel_bookings.submission_id, intro_funnel_submissions.id),
    )
    .where(
      and(
        eq(intro_funnel_submissions.funnel_state, "shoot_morning_of"),
        eq(intro_funnel_bookings.status, "booked"),
      ),
    );

  for (const { submission, booking } of morningOfSubs) {
    if (now >= booking.slot_end_at_ms + HOURS_1) {
      try {
        await transitionState(
          submission.id,
          submission.deal_id,
          "shoot_completed_awaiting_deliverables",
        );
        await db
          .update(intro_funnel_bookings)
          .set({ status: "completed", updated_at_ms: now })
          .where(eq(intro_funnel_bookings.id, booking.id));
        transitioned++;
      } catch (e) {
        errors.push(`shoot_completed transition failed for ${submission.id}: ${e}`);
      }
    }
  }

  return { transitioned, errors };
}

async function transitionState(
  submissionId: string,
  dealId: string,
  newState: FunnelState,
): Promise<void> {
  const nowMs = Date.now();
  await db
    .update(intro_funnel_submissions)
    .set({ funnel_state: newState, last_activity_at_ms: nowMs })
    .where(eq(intro_funnel_submissions.id, submissionId));

  await logActivity({
    dealId,
    kind: "intro_funnel_state_transition",
    body: `Funnel state transitioned to ${newState}`,
    meta: { submission_id: submissionId, new_state: newState },
  });
}
