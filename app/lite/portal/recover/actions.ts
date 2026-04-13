/**
 * Server Action: request a fresh portal magic-link.
 *
 * Called from the recovery form. Always returns void — success and
 * "no account found" both resolve silently to prevent email enumeration.
 * The form shows a neutral "check your inbox" state regardless of outcome.
 *
 * NOTE: In A8, the contacts table does not yet exist (Sales Pipeline wave).
 * This action currently sends no email — it logs the attempt and returns.
 * IF-4 (Intro Funnel build session) will replace the stub with a real
 * `intro_funnel_submissions` lookup + `sendEmail()` call.
 * PATCHES_OWED: `a8_recovery_form_contacts_lookup_stub`.
 *
 * Owner: A8 (stub). Real implementation owner: IF-4.
 */
"use server";

export async function requestPortalLink(email: string): Promise<void> {
  // Stub: validate input, then silently succeed.
  // IF-4 replaces this with:
  //   1. Look up intro_funnel_submissions by submitted_email.
  //   2. If found, call issueMagicLink({ contactId: sub.contact_id, submissionId: sub.id }).
  //   3. Call sendEmail({ to: email, classification: "portal_magic_link_recovery", ... }).
  if (!email || typeof email !== "string") return;
  // Intentional no-op until contacts table exists.
}
