import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { intro_funnel_bookings } from "@/lib/db/schema/intro-funnel-bookings";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { contacts } from "@/lib/db/schema/contacts";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const MS_24H = 24 * 60 * 60 * 1000;

export async function getIntroFunnelWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const upcomingBookings = await db
    .select({
      id: intro_funnel_bookings.id,
      slot_start_at_ms: intro_funnel_bookings.slot_start_at_ms,
      submission_id: intro_funnel_bookings.submission_id,
      submitted_name: intro_funnel_submissions.submitted_name,
    })
    .from(intro_funnel_bookings)
    .innerJoin(
      intro_funnel_submissions,
      eq(
        intro_funnel_bookings.submission_id,
        intro_funnel_submissions.id,
      ),
    )
    .where(
      and(
        eq(intro_funnel_bookings.status, "booked"),
        gte(intro_funnel_bookings.slot_start_at_ms, nowMs),
        lte(intro_funnel_bookings.slot_start_at_ms, nowMs + MS_24H),
      ),
    )
    .all();

  for (const b of upcomingBookings) {
    const hoursUntil = Math.round(
      (b.slot_start_at_ms - nowMs) / (60 * 60 * 1000),
    );
    items.push({
      id: `intro_funnel_prep_${b.id}`,
      label: `Shoot with ${b.submitted_name} — ${hoursUntil}h away`,
      href: `/lite/intro-funnel/bookings/${b.id}`,
      urgency: { kind: "time_sensitive", value: b.slot_start_at_ms },
      scope: "own",
      source: "intro-funnel",
    });
  }

  const awaitingReview = await db
    .select({
      id: intro_funnel_submissions.id,
      submitted_name: intro_funnel_submissions.submitted_name,
      updated_at_ms: intro_funnel_submissions.updated_at_ms,
    })
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.funnel_state, "questionnaire_complete"))
    .all();

  for (const s of awaitingReview) {
    items.push({
      id: `intro_funnel_questionnaire_${s.id}`,
      label: `${s.submitted_name} questionnaire — awaiting review`,
      href: `/lite/intro-funnel/submissions/${s.id}`,
      urgency: { kind: "age_of_wait", value: s.updated_at_ms },
      scope: "own",
      source: "intro-funnel",
    });
  }

  return items;
}
