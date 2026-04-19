/**
 * Reflection reminder handler — nudges prospect toward the post-shoot
 * reflection after deliverables are ready.
 *
 * Owner: IF-4.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { sendEmail } from "@/lib/channels/email/send";
import { generateIntroPortalLink } from "@/lib/intro-funnel/portal-link";
import { logActivity } from "@/lib/activity-log";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

async function handleReflectionReminder(task: ScheduledTaskRow): Promise<void> {
  const payload = task.payload as { submissionId: string };

  const submission = db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.id, payload.submissionId))
    .get();
  if (!submission) return;

  if (submission.funnel_state !== "deliverables_ready") return;

  const firstName =
    submission.submitted_name.split(" ")[0] || submission.submitted_name;

  const portalLink = await generateIntroPortalLink({
    contactId: submission.contact_id,
    submissionId: submission.id,
    introToken: submission.token,
    issuedFor: "reflection_reminder",
  });

  await sendEmail({
    to: submission.submitted_email,
    subject: "Your photos are ready — one more thing",
    body: `<p>Hey ${firstName},</p>
<p>Hope you've had a chance to look through your gallery. There's a quick reflection in your portal whenever you've got 5 minutes — it helps us figure out what's next.</p>
<p><a href="${portalLink}">Open your portal →</a></p>
<p>— Andy</p>`,
    classification: "reflection_ready",
    purpose: "reflection_reminder",
  });

  await logActivity({
    contactId: submission.contact_id,
    dealId: submission.deal_id,
    kind: "intro_funnel_state_transition",
    body: "Reflection reminder sent",
    meta: { submission_id: payload.submissionId },
  });
}

export const INTRO_FUNNEL_REFLECTION_REMINDER_HANDLERS: HandlerMap = {
  intro_funnel_reflection_reminder: handleReflectionReminder,
};
