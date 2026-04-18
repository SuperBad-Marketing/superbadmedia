"use server";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal/guard";

export async function markTourComplete(): Promise<void> {
  const session = await getPortalSession();
  if (!session) return;

  await db
    .update(contacts)
    .set({ portal_last_visited_at_ms: Date.now() })
    .where(eq(contacts.id, session.contactId));
}
