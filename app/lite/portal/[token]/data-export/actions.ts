"use server";

import { requirePortalSession } from "@/lib/portal/require-session";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { contacts } from "@/lib/db/schema/contacts";

export async function requestDataExport(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await requirePortalSession();

  const contact = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (!contact) {
    return { ok: false, error: "Contact not found" };
  }

  const idempotencyKey = `data_export_${contact.company_id}_${new Date().toISOString().split("T")[0]}`;

  const task = await enqueueTask({
    task_type: "client_data_export",
    runAt: Date.now(),
    payload: {
      company_id: contact.company_id,
      triggered_by: "client",
      contact_id: session.contactId,
    },
    idempotencyKey,
  });

  if (!task) {
    return { ok: false, error: "Export already requested today" };
  }

  await logActivity({
    companyId: contact.company_id,
    contactId: session.contactId,
    kind: "data_export_requested",
    body: "Client requested data export from portal",
    meta: { triggered_by: "client", task_id: task.id },
  });

  return { ok: true };
}
