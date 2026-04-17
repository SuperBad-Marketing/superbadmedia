"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { getPortalSession } from "@/lib/portal/guard";
import { logActivity } from "@/lib/activity-log";

/**
 * Mark the welcome screen as seen for the current portal session's contact.
 * One-shot — subsequent calls are no-ops.
 */
export async function markWelcomeSeen(): Promise<{ ok: boolean }> {
  const session = await getPortalSession();
  if (!session?.contactId) return { ok: false };

  const contact = db
    .select({ onboarding_welcome_seen_at_ms: contacts.onboarding_welcome_seen_at_ms })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (contact?.onboarding_welcome_seen_at_ms != null) {
    return { ok: true }; // already seen — no-op
  }

  db.update(contacts)
    .set({ onboarding_welcome_seen_at_ms: Date.now(), updated_at_ms: Date.now() })
    .where(eq(contacts.id, session.contactId))
    .run();

  void logActivity({
    contactId: session.contactId,
    kind: "onboarding_started",
    body: "Welcome screen seen",
  });

  return { ok: true };
}
