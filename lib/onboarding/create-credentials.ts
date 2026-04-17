/**
 * Onboarding credential creation — final onboarding step.
 *
 * Creates a `user` record (role="prospect") for the portal contact's email
 * if one doesn't already exist, then issues a subscriber magic link that
 * redirects to `/lite/portal` on redeem. The magic link click verifies
 * the email (`redeemSubscriberMagicLink` sets `emailVerified`), promotes
 * prospect→client, and establishes an Auth.js session.
 *
 * Spec: onboarding-and-segmentation.md §6.
 * Owner: OS-3.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as globalDb } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema/user";
import { contacts } from "@/lib/db/schema/contacts";
import { issueSubscriberMagicLink } from "@/lib/auth/subscriber-magic-link";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export interface CreateCredentialsInput {
  contactId: string;
  companyId: string;
}

export type CreateCredentialsResult =
  | { ok: true; userId: string; magicLinkUrl: string }
  | { ok: false; reason: "contact_not_found" | "email_missing" | "already_verified" };

/**
 * Create a user record for the contact (if needed) and issue a magic link
 * for email verification. Sends a transactional email with the link.
 */
export async function createOnboardingCredentials(
  input: CreateCredentialsInput,
  dbOverride?: AnyDb,
): Promise<CreateCredentialsResult> {
  const database = dbOverride ?? globalDb;
  const { contactId, companyId } = input;
  const now = Date.now();

  // Read the contact's email
  const contact = database
    .select({ id: contacts.id, email: contacts.email, name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  if (!contact) return { ok: false, reason: "contact_not_found" };
  if (!contact.email) return { ok: false, reason: "email_missing" };

  // Check for existing verified user — idempotent guard
  const existingVerified = database
    .select({ id: userTable.id, emailVerified: userTable.emailVerified })
    .from(userTable)
    .where(eq(userTable.email, contact.email))
    .get();

  if (existingVerified?.emailVerified != null) {
    return { ok: false, reason: "already_verified" };
  }

  // Create or find user record
  let userId: string;
  if (existingVerified) {
    // User exists but not verified — reuse
    userId = existingVerified.id;
  } else {
    // Create new prospect user
    userId = randomUUID();
    await database.insert(userTable).values({
      id: userId,
      email: contact.email,
      name: contact.name,
      role: "prospect",
      created_at_ms: now,
    });
  }

  // Issue a magic link that redirects to the portal on redeem
  const { url: rawUrl } = await issueSubscriberMagicLink(
    { userId, issuedFor: "onboarding_credentials" },
    database,
  );

  // Append redirect param so redeem lands at /lite/portal instead of /lite/onboarding
  const magicLinkUrl = `${rawUrl}&redirect=/lite/portal`;

  // Send the credential confirmation email
  const firstName = contact.name?.split(" ")[0] ?? "there";
  await sendEmail({
    to: contact.email,
    subject: "Confirm your email — this is how you'll log in",
    body: `<p>Hey ${firstName},</p><p>One last thing — tap the link below to confirm your email. This is how you'll log in from now on.</p><p><a href="${magicLinkUrl}">Confirm and log in</a></p><p>The link expires in 7 days. If you need a fresh one, just visit the portal and request a new login link.</p>`,
    classification: "transactional",
    purpose: "onboarding_credentials",
    tags: [
      { name: "type", value: "onboarding_credentials" },
      { name: "contact_id", value: contactId },
    ],
  });

  void logActivity({
    companyId,
    contactId,
    kind: "onboarding_credentials_created",
    body: `Credential creation email sent to ${contact.email}`,
    meta: { userId },
    createdBy: "onboarding",
  });

  return { ok: true, userId, magicLinkUrl };
}
