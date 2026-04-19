/**
 * Booking reminder handler — fires 24h and 2h before the trial shoot.
 *
 * Owner: IF-4.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { intro_funnel_bookings } from "@/lib/db/schema/intro-funnel-bookings";
import { sendEmail } from "@/lib/channels/email/send";
import { sendSms } from "@/lib/channels/sms/send";
import { generateIntroPortalLink } from "@/lib/intro-funnel/portal-link";
import { logActivity } from "@/lib/activity-log";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

async function handleBookingReminder(task: ScheduledTaskRow): Promise<void> {
  const payload = task.payload as {
    submissionId: string;
    bookingId: string;
    reminderType: "24h" | "2h";
  };

  const submission = db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, payload.submissionId))
    .get();
  if (!submission) return;

  const booking = db
    .select()
    .from(intro_funnel_bookings)
    .where(eq(intro_funnel_bookings.id, payload.bookingId))
    .get();
  if (!booking || booking.status !== "booked") return;

  const firstName =
    submission.submitted_name.split(" ")[0] || submission.submitted_name;

  const portalLink = await generateIntroPortalLink({
    contactId: submission.contact_id,
    submissionId: submission.id,
    introToken: submission.token,
    issuedFor: `booking_reminder_${payload.reminderType}`,
  });

  const tz = "Australia/Melbourne";
  const dateFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const dateStr = dateFmt.format(new Date(booking.slot_start_at_ms));
  const timeStr = timeFmt.format(new Date(booking.slot_start_at_ms));

  if (payload.reminderType === "24h") {
    await sendEmail({
      to: submission.submitted_email,
      subject: `Tomorrow — ${dateStr}`,
      body: `<p>Hey ${firstName},</p>
<p>Quick heads up — your shoot is tomorrow at <strong>${timeStr}</strong> (AEST).</p>
<p>No prep needed. Just show up as you are.</p>
<p><a href="${portalLink}">Open your portal →</a></p>
<p>— Andy</p>`,
      classification: "shoot_booking_confirmed",
      purpose: "booking_reminder_24h",
    });
  } else {
    await sendEmail({
      to: submission.submitted_email,
      subject: `${timeStr} — see you soon`,
      body: `<p>Hey ${firstName},</p>
<p>Couple of hours out. See you at <strong>${timeStr}</strong>.</p>
<p>If you need to find your portal later: <a href="${portalLink}">here</a>.</p>
<p>— Andy</p>`,
      classification: "shoot_booking_confirmed",
      purpose: "booking_reminder_2h",
    });

    if (submission.sms_opt_in) {
      await sendSms({
        to: submission.submitted_phone,
        body: `Hey ${firstName} — see you in a couple of hours. ${portalLink} — Andy`,
        submissionId: submission.id,
        dealId: submission.deal_id,
        purpose: "booking_reminder_2h_sms",
      });
    }
  }

  await logActivity({
    contactId: submission.contact_id,
    dealId: submission.deal_id,
    kind: "intro_funnel_state_transition",
    body: `Booking reminder sent (${payload.reminderType} before shoot)`,
    meta: { booking_id: payload.bookingId, reminder_type: payload.reminderType },
  });
}

export const INTRO_FUNNEL_BOOKING_REMINDER_HANDLERS: HandlerMap = {
  intro_funnel_booking_reminder: handleBookingReminder,
};
