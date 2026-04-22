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

  const magicLinkUrl = `${rawUrl}&redirect=/lite/portal/welcome`;

  const firstName = contact.name?.split(" ")[0] ?? "there";
  await sendEmail({
    to: contact.email,
    subject: `${firstName}, here's your login`,
    body: buildCredentialsEmailHtml(firstName, magicLinkUrl),
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

/**
 * Resend a portal login link for any contact — works whether or not
 * the user is already verified. For the "client lost their email" flow.
 */
export async function resendPortalLink(
  input: CreateCredentialsInput,
  dbOverride?: AnyDb,
): Promise<
  | { ok: true; magicLinkUrl: string }
  | { ok: false; reason: "contact_not_found" | "email_missing" }
> {
  const database = dbOverride ?? globalDb;
  const { contactId, companyId } = input;

  const contact = database
    .select({ id: contacts.id, email: contacts.email, name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();

  if (!contact) return { ok: false, reason: "contact_not_found" };
  if (!contact.email) return { ok: false, reason: "email_missing" };

  const existing = database
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, contact.email))
    .get();

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    userId = randomUUID();
    await database.insert(userTable).values({
      id: userId,
      email: contact.email,
      name: contact.name,
      role: "prospect",
      created_at_ms: Date.now(),
    });
  }

  const { url: rawUrl } = await issueSubscriberMagicLink(
    { userId, issuedFor: "portal_link_resend" },
    database,
  );

  const magicLinkUrl = `${rawUrl}&redirect=/lite/portal/welcome`;

  const firstName = contact.name?.split(" ")[0] ?? "there";
  await sendEmail({
    to: contact.email,
    subject: `${firstName}, here's your login link`,
    body: buildResendEmailHtml(firstName, magicLinkUrl),
    classification: "transactional",
    purpose: "portal_link_resend",
    tags: [
      { name: "type", value: "portal_link_resend" },
      { name: "contact_id", value: contactId },
    ],
  });

  void logActivity({
    companyId,
    contactId,
    kind: "email_sent",
    body: `Portal login link resent to ${contact.email}`,
    meta: { userId },
    createdBy: "admin",
  });

  return { ok: true, magicLinkUrl };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s: string): string {
  return esc(s).replace(/"/g, "&quot;");
}

function buildCredentialsEmailHtml(firstName: string, url: string): string {
  return `<div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #fdf5e6; background: #1a1a18;">
<p style="margin: 0 0 4px; font-size: 28px; font-weight: 700; letter-spacing: -0.3px; color: #fdf5e6;">SuperBad</p>
<p style="margin: 0 0 32px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #807f73;">Marketing that doesn't apologise</p>
<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.55; color: #c8c6ba;">Hey ${esc(firstName)},</p>
<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.55; color: #c8c6ba;">One last thing — tap the button below to confirm your email. This is how you'll log in from now on.</p>
<p style="margin: 24px 0;"><a href="${escAttr(url)}" style="display: inline-block; padding: 14px 28px; background: #c8312b; color: #fdf5e6; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px;">Log in to your portal</a></p>
<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: #807f73;">The link expires in 7 days. If you need a fresh one, just ask.</p>
<p style="margin: 32px 0 0; font-size: 14px; color: #c8c6ba;">Andy</p>
<p style="margin: 4px 0 0; font-size: 12px; color: #807f73;">SuperBad Marketing</p>
</div>`;
}

function buildResendEmailHtml(firstName: string, url: string): string {
  return `<div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #fdf5e6; background: #1a1a18;">
<p style="margin: 0 0 4px; font-size: 28px; font-weight: 700; letter-spacing: -0.3px; color: #fdf5e6;">SuperBad</p>
<p style="margin: 0 0 32px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #807f73;">Marketing that doesn't apologise</p>
<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.55; color: #c8c6ba;">Hey ${esc(firstName)},</p>
<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.55; color: #c8c6ba;">Here's a fresh login link for your portal.</p>
<p style="margin: 24px 0;"><a href="${escAttr(url)}" style="display: inline-block; padding: 14px 28px; background: #c8312b; color: #fdf5e6; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px;">Log in to your portal</a></p>
<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: #807f73;">This link expires in 7 days.</p>
<p style="margin: 32px 0 0; font-size: 14px; color: #c8c6ba;">Andy</p>
<p style="margin: 4px 0 0; font-size: 12px; color: #807f73;">SuperBad Marketing</p>
</div>`;
}
