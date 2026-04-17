/**
 * `/lite/portal/onboarding/credentials` — Credential creation step.
 *
 * Final onboarding step for both retainer and SaaS. Shows the client's
 * pre-filled email and a confirm button. On confirmation, creates a user
 * record and sends a magic link for email verification.
 *
 * Portal-session-guarded. Redirects to `/lite/portal` if already verified
 * or if the session is invalid.
 *
 * Tab title: "SuperBad — one last thing" per spec §12.3 pattern.
 *
 * Owner: OS-3.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { user } from "@/lib/db/schema/user";
import { getPortalSession } from "@/lib/portal/guard";
import CredentialsClient from "./credentials-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SuperBad \u2014 one last thing",
  robots: { index: false, follow: false },
};

export default async function CredentialsPage() {
  const session = await getPortalSession();
  if (!session?.contactId) redirect("/lite/portal/recover");

  // Resolve contact
  const contact = db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      company_id: contacts.company_id,
    })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (!contact?.email || !contact.company_id) redirect("/lite/portal");

  // Already verified? Skip forward.
  const existingUser = db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, contact.email), isNotNull(user.emailVerified)))
    .get();

  if (existingUser) redirect("/lite/portal");

  const firstName = contact.name?.split(" ")[0] ?? "there";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <CredentialsClient
        email={contact.email}
        contactId={contact.id}
        companyId={contact.company_id}
        firstName={firstName}
      />
    </main>
  );
}
