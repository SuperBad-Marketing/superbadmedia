/**
 * Server Action: request a fresh portal magic-link.
 *
 * Called from the recovery form. Always returns void — success and
 * "no account found" both resolve silently to prevent email enumeration.
 *
 * Owner: IF-4.
 */
"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { contacts } from "@/lib/db/schema/contacts";
import { issueMagicLink } from "@/lib/portal/issue-magic-link";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";

export async function requestPortalLink(email: string): Promise<void> {
  if (!email || typeof email !== "string") return;

  const normalised = email.trim().toLowerCase();

  const sub = db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.submitted_email, normalised))
    .get();

  if (!sub) {
    // Also try contacts table for client-management portal users
    const contact = db
      .select()
      .from(contacts)
      .where(eq(contacts.email, normalised))
      .get();

    if (contact) {
      const { url } = await issueMagicLink({
        contactId: contact.id,
        issuedFor: "recovery_form",
      });

      await sendEmail({
        to: normalised,
        subject: "Your SuperBad portal link",
        body: `<p>Hey,</p>
<p>Here's your fresh portal link — valid for 7 days.</p>
<p><a href="${url}">Open your portal →</a></p>
<p>— Andy</p>`,
        classification: "portal_magic_link_recovery",
        purpose: "portal_recovery_form",
      });
    }

    await logActivity({
      kind: "portal_recovery_form_submitted",
      body: `Recovery form submitted`,
      meta: { email: normalised, matched: !!contact },
    });

    return;
  }

  const { url } = await issueMagicLink({
    contactId: sub.contact_id,
    submissionId: sub.id,
    issuedFor: "recovery_form",
  });

  const firstName = sub.submitted_name.split(" ")[0] || sub.submitted_name;

  await sendEmail({
    to: normalised,
    subject: "Your SuperBad portal link",
    body: `<p>Hey ${firstName},</p>
<p>Here's your fresh portal link — valid for 7 days.</p>
<p><a href="${url}">Open your portal →</a></p>
<p>— Andy</p>`,
    classification: "portal_magic_link_recovery",
    purpose: "portal_recovery_form",
  });

  await logActivity({
    contactId: sub.contact_id,
    kind: "portal_recovery_form_submitted",
    body: `Recovery form submitted`,
    meta: { email: normalised, matched: true, submission_id: sub.id },
  });
}
