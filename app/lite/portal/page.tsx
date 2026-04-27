import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { getPortalSession } from "@/lib/portal/guard";

export default async function PortalIndexPage() {
  const session = await getPortalSession();
  if (!session?.contactId) {
    redirect("/lite/portal/login");
  }

  const contact = db
    .select({
      onboarding_welcome_seen_at_ms: contacts.onboarding_welcome_seen_at_ms,
    })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (!contact || contact.onboarding_welcome_seen_at_ms == null) {
    redirect("/lite/portal/welcome");
  }

  redirect("/lite/portal/home");
}
