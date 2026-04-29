"use server";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { intro_funnel_bookings } from "@/lib/db/schema/intro-funnel-bookings";
import { intro_funnel_payments } from "@/lib/db/schema/intro-funnel-payments";
import { calendar_bookings } from "@/lib/db/schema/calendar";
import { deals } from "@/lib/db/schema/deals";
import { contacts } from "@/lib/db/schema/contacts";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { generateIcs } from "@/lib/intro-funnel/ics";
import { computeAvailableSlots } from "@/lib/intro-funnel/calendar";
import { maybeRegenerateBrief } from "@/lib/cockpit/brief-triggers";
import { generateIntroPortalLink } from "@/lib/intro-funnel/portal-link";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

const MAX_RESCHEDULES = 2;
const RESCHEDULE_MINIMUM_HOURS = 48;

interface BookResult {
  ok: boolean;
  error?: string;
  bookingId?: string;
}

export async function bookSlotAction(
  token: string,
  slotStartMs: number,
  slotEndMs: number,
): Promise<BookResult> {
  const sub = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.token, token))
    .limit(1);

  if (!sub[0]) return { ok: false, error: "Submission not found" };
  const submission = sub[0];

  if (submission.funnel_state !== "paid") {
    return { ok: false, error: "Payment required before booking" };
  }

  // Re-validate slot availability to prevent races
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const available = await computeAvailableSlots(now, windowEnd);
  const slotValid = available.some(
    (s) => s.startMs === slotStartMs && s.endMs === slotEndMs,
  );

  if (!slotValid) {
    return { ok: false, error: "Slot no longer available" };
  }

  const paymentRows = await db
    .select()
    .from(intro_funnel_payments)
    .where(
      and(
        eq(intro_funnel_payments.submission_id, submission.id),
        eq(intro_funnel_payments.status, "succeeded"),
      ),
    )
    .limit(1);

  if (!paymentRows[0]) return { ok: false, error: "No confirmed payment" };

  const bookingId = randomUUID();
  const calBookingId = randomUUID();
  const nowMs = Date.now();

  await db.insert(intro_funnel_bookings).values({
    id: bookingId,
    submission_id: submission.id,
    deal_id: submission.deal_id,
    payment_id: paymentRows[0].id,
    slot_start_at_ms: slotStartMs,
    slot_end_at_ms: slotEndMs,
    status: "booked",
    reschedule_count: 0,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db.insert(calendar_bookings).values({
    id: calBookingId,
    booking_type: "intro_funnel_shoot",
    start_at_ms: slotStartMs,
    end_at_ms: slotEndMs,
    subject_ref_table: "intro_funnel_bookings",
    subject_ref_id: bookingId,
    status: "active",
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  await db
    .update(intro_funnel_submissions)
    .set({
      funnel_state: "shoot_booked",
      last_activity_at_ms: nowMs,
    })
    .where(eq(intro_funnel_submissions.id, submission.id));

  await logActivity({
    companyId: null,
    contactId: submission.contact_id,
    dealId: submission.deal_id,
    kind: "shoot_booked",
    body: `Trial shoot booked for ${new Date(slotStartMs).toLocaleDateString("en-AU")}`,
    meta: { booking_id: bookingId, slot_start_ms: slotStartMs },
  });

  maybeRegenerateBrief("intro_funnel_booking_confirmed", {
    submission_id: submission.id,
    booking_id: bookingId,
    slot_start_ms: slotStartMs,
  }).catch(() => {});

  // Send confirmation email with .ics
  const contactRows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, submission.contact_id))
    .limit(1);
  const contact = contactRows[0];

  if (contact) {
    const tz = "Australia/Melbourne";
    const dateFmt = new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeFmt = new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const dateStr = dateFmt.format(new Date(slotStartMs));
    const timeStr = timeFmt.format(new Date(slotStartMs));
    const firstName = submission.submitted_name.split(" ")[0];
    const portalLink = await generateIntroPortalLink({
      contactId: submission.contact_id,
      submissionId: submission.id,
      introToken: token,
      issuedFor: "shoot_booking_confirmed",
    });
    const plainPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/lite/intro/${token}`;

    const icsContent = generateIcs({
      uid: `${bookingId}@superbadmedia.com.au`,
      summary: "Trial Shoot — SuperBad Marketing",
      description: `Your trial shoot with Andy. Portal: ${plainPortalUrl}`,
      location: "Your place of business — we'll confirm closer to the day",
      startMs: slotStartMs,
      endMs: slotEndMs,
      organizerName: "Andy Robinson",
      organizerEmail: "andy@superbadmedia.com.au",
      attendeeName: submission.submitted_name,
      attendeeEmail: submission.submitted_email,
    });

    await sendEmail({
      to: submission.submitted_email,
      subject: `${dateStr} — you're locked in`,
      body: `<p>Hey ${firstName},</p>
<p>Your shoot's booked for <strong>${dateStr}</strong> at <strong>${timeStr}</strong> (AEST).</p>
<p><strong>Where:</strong> Your place — we'll confirm the location closer to the day.<br/>
<strong>How long:</strong> About an hour.<br/>
<strong>What to wear:</strong> Whatever you'd normally wear at work. Seriously.</p>
<p>Between now and then, we'll be doing our homework on your business. You don't need to prepare anything.</p>
<p>If something comes up, you can reschedule from your portal — we just need 48 hours' notice.</p>
<p><a href="${portalLink}">Open your portal →</a></p>
<p>— Andy</p>
<p style="font-size:12px;color:#999;">P.S. Calendar invite attached. Add it, or don't — we'll remind you either way.</p>`,
      classification: "shoot_booking_confirmed",
      purpose: "Trial shoot booking confirmation",
      attachments: [
        {
          filename: "trial-shoot.ics",
          content: Buffer.from(icsContent, "utf-8"),
        },
      ],
    });
  }

  // Notify Andy
  const melbTz = "Australia/Melbourne";
  const adminDateStr = new Intl.DateTimeFormat("en-AU", { timeZone: melbTz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(slotStartMs));
  const adminTimeStr = new Intl.DateTimeFormat("en-AU", { timeZone: melbTz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(slotStartMs));
  await sendEmail({
    to: "andy@superbadmedia.com.au",
    subject: `New booking — ${submission.submitted_name} — ${adminDateStr}`,
    body: `<p><strong>${submission.submitted_name}</strong> just booked a trial shoot.</p>
<p><strong>When:</strong> ${adminDateStr} at ${adminTimeStr} (AEST)</p>
<p><strong>Business:</strong> ${submission.submitted_business_name}</p>
<p><strong>Email:</strong> ${submission.submitted_email}</p>
<p><strong>Phone:</strong> ${submission.submitted_phone}</p>`,
    classification: "transactional",
    purpose: "Admin notification — trial shoot booked",
  }).catch(() => {});

  // Schedule booking reminders (24h and 2h before shoot)
  const HOURS_24 = 24 * 60 * 60 * 1000;
  const HOURS_2 = 2 * 60 * 60 * 1000;
  const reminderPayload = { submissionId: submission.id, bookingId };

  if (slotStartMs - nowMs > HOURS_24) {
    await enqueueTask({
      task_type: "intro_funnel_booking_reminder",
      runAt: slotStartMs - HOURS_24,
      payload: { ...reminderPayload, reminderType: "24h" },
      idempotencyKey: `booking_reminder_24h_${bookingId}`,
    });
  }
  if (slotStartMs - nowMs > HOURS_2) {
    await enqueueTask({
      task_type: "intro_funnel_booking_reminder",
      runAt: slotStartMs - HOURS_2,
      payload: { ...reminderPayload, reminderType: "2h" },
      idempotencyKey: `booking_reminder_2h_${bookingId}`,
    });
  }

  return { ok: true, bookingId };
}

export async function rescheduleAction(
  token: string,
  newStartMs: number,
  newEndMs: number,
): Promise<BookResult> {
  const sub = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.token, token))
    .limit(1);

  if (!sub[0]) return { ok: false, error: "Submission not found" };
  const submission = sub[0];

  const bookingRows = await db
    .select()
    .from(intro_funnel_bookings)
    .where(
      and(
        eq(intro_funnel_bookings.submission_id, submission.id),
        eq(intro_funnel_bookings.status, "booked"),
      ),
    )
    .limit(1);

  if (!bookingRows[0]) return { ok: false, error: "No active booking" };
  const booking = bookingRows[0];

  if (booking.reschedule_count >= MAX_RESCHEDULES) {
    return {
      ok: false,
      error: "Maximum reschedules reached. Please contact Andy directly.",
    };
  }

  const hoursUntilNew =
    (newStartMs - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilNew < RESCHEDULE_MINIMUM_HOURS) {
    return {
      ok: false,
      error: "New slot must be at least 48 hours away",
    };
  }

  // Re-validate new slot
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const available = await computeAvailableSlots(now, windowEnd);
  const slotValid = available.some(
    (s) => s.startMs === newStartMs && s.endMs === newEndMs,
  );

  if (!slotValid) {
    return { ok: false, error: "Slot no longer available" };
  }

  const nowMs = Date.now();

  await db
    .update(intro_funnel_bookings)
    .set({
      slot_start_at_ms: newStartMs,
      slot_end_at_ms: newEndMs,
      reschedule_count: booking.reschedule_count + 1,
      status: "booked",
      updated_at_ms: nowMs,
    })
    .where(eq(intro_funnel_bookings.id, booking.id));

  await db
    .update(calendar_bookings)
    .set({
      start_at_ms: newStartMs,
      end_at_ms: newEndMs,
      updated_at_ms: nowMs,
    })
    .where(
      and(
        eq(calendar_bookings.subject_ref_table, "intro_funnel_bookings"),
        eq(calendar_bookings.subject_ref_id, booking.id),
      ),
    );

  await db
    .update(intro_funnel_submissions)
    .set({ last_activity_at_ms: nowMs })
    .where(eq(intro_funnel_submissions.id, submission.id));

  await logActivity({
    contactId: submission.contact_id,
    dealId: submission.deal_id,
    kind: "shoot_rescheduled",
    body: `Shoot rescheduled to ${new Date(newStartMs).toLocaleDateString("en-AU")} (attempt ${booking.reschedule_count + 1}/${MAX_RESCHEDULES})`,
    meta: {
      booking_id: booking.id,
      old_start_ms: booking.slot_start_at_ms,
      new_start_ms: newStartMs,
      reschedule_count: booking.reschedule_count + 1,
    },
  });

  // Send reschedule confirmation email with new .ics
  const firstName = submission.submitted_name.split(" ")[0];
  const portalLink = await generateIntroPortalLink({
    contactId: submission.contact_id,
    submissionId: submission.id,
    introToken: token,
    issuedFor: "shoot_reschedule_confirmed",
  });
  const plainPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/lite/intro/${token}`;
  const tz = "Australia/Melbourne";
  const dateFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const dateStr = dateFmt.format(new Date(newStartMs));
  const timeStr = timeFmt.format(new Date(newStartMs));

  const icsContent = generateIcs({
    uid: `${booking.id}@superbadmedia.com.au`,
    summary: "Trial Shoot — SuperBad Marketing (Rescheduled)",
    description: `Your rescheduled trial shoot with Andy. Portal: ${plainPortalUrl}`,
    location: "Your place of business",
    startMs: newStartMs,
    endMs: newEndMs,
    organizerName: "Andy Robinson",
    organizerEmail: "andy@superbadmedia.com.au",
    attendeeName: submission.submitted_name,
    attendeeEmail: submission.submitted_email,
  });

  await sendEmail({
    to: submission.submitted_email,
    subject: `Rescheduled — ${dateStr}`,
    body: `<p>Hey ${firstName},</p>
<p>Your shoot's been moved to <strong>${dateStr}</strong> at <strong>${timeStr}</strong> (AEST).</p>
<p>Everything else stays the same. Updated calendar invite attached.</p>
<p><a href="${portalLink}">Open your portal →</a></p>
<p>— Andy</p>`,
    classification: "shoot_reschedule_confirmed",
    purpose: "Trial shoot reschedule confirmation",
    attachments: [
      {
        filename: "trial-shoot-rescheduled.ics",
        content: Buffer.from(icsContent, "utf-8"),
      },
    ],
  });

  const oldDateStr = dateFmt.format(new Date(booking.slot_start_at_ms));
  await sendEmail({
    to: "andy@superbadmedia.com.au",
    subject: `Shoot rescheduled — ${submission.submitted_name} → ${dateStr}`,
    body: `<p><strong>${submission.submitted_name}</strong> (${submission.submitted_business_name}) rescheduled their shoot.</p>
<p><strong>Was:</strong> ${oldDateStr}</p>
<p><strong>Now:</strong> ${dateStr} at ${timeStr} (AEST)</p>
<p><strong>Reschedule:</strong> ${booking.reschedule_count + 1} of ${MAX_RESCHEDULES}</p>`,
    classification: "transactional",
    purpose: "Admin notification — trial shoot rescheduled",
  }).catch(() => {});

  return { ok: true, bookingId: booking.id };
}

export async function cancelBookingAction(
  token: string,
): Promise<BookResult> {
  const sub = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.token, token))
    .limit(1);

  if (!sub[0]) return { ok: false, error: "Submission not found" };
  const submission = sub[0];

  const bookingRows = await db
    .select()
    .from(intro_funnel_bookings)
    .where(
      and(
        eq(intro_funnel_bookings.submission_id, submission.id),
        eq(intro_funnel_bookings.status, "booked"),
      ),
    )
    .limit(1);

  if (!bookingRows[0]) return { ok: false, error: "No active booking" };
  const booking = bookingRows[0];

  const hoursUntilShoot =
    (booking.slot_start_at_ms - Date.now()) / (1000 * 60 * 60);

  const nowMs = Date.now();

  await db
    .update(intro_funnel_bookings)
    .set({
      status: "cancelled",
      cancelled_at_ms: nowMs,
      cancelled_by: "customer",
      cancelled_reason_code: hoursUntilShoot < 48 ? "late_cancel" : "customer_cancel",
      updated_at_ms: nowMs,
    })
    .where(eq(intro_funnel_bookings.id, booking.id));

  await db
    .update(calendar_bookings)
    .set({ status: "cancelled", updated_at_ms: nowMs })
    .where(
      and(
        eq(calendar_bookings.subject_ref_table, "intro_funnel_bookings"),
        eq(calendar_bookings.subject_ref_id, booking.id),
      ),
    );

  const lostReason =
    hoursUntilShoot < 48
      ? "intro_funnel_cancelled_no_refund"
      : "intro_funnel_cancelled_refunded";

  await db
    .update(intro_funnel_submissions)
    .set({
      funnel_state: "paid",
      last_activity_at_ms: nowMs,
    })
    .where(eq(intro_funnel_submissions.id, submission.id));

  await logActivity({
    contactId: submission.contact_id,
    dealId: submission.deal_id,
    kind: "shoot_cancelled",
    body: `Booking cancelled by customer (${hoursUntilShoot < 48 ? "late — inside 48h" : "within refund window"})`,
    meta: {
      booking_id: booking.id,
      hours_until_shoot: Math.round(hoursUntilShoot),
      refund_eligible: hoursUntilShoot >= 48,
    },
  });

  const tz = "Australia/Melbourne";
  const cancelDateStr = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long",
  }).format(new Date(booking.slot_start_at_ms));
  await sendEmail({
    to: "andy@superbadmedia.com.au",
    subject: `Shoot cancelled — ${submission.submitted_name}`,
    body: `<p><strong>${submission.submitted_name}</strong> (${submission.submitted_business_name}) cancelled their shoot.</p>
<p><strong>Was:</strong> ${cancelDateStr}</p>
<p><strong>Notice:</strong> ${hoursUntilShoot < 48 ? "Late cancel — inside 48h window" : "Within refund window"}</p>`,
    classification: "transactional",
    purpose: "Admin notification — trial shoot cancelled",
  }).catch(() => {});

  return { ok: true };
}
