import { requirePortalSession } from "@/lib/portal/require-session";
import { getPortalMode } from "@/lib/portal/mode";
import { SectionLocked } from "@/components/lite/portal/section-locked";
import { DataExportPanel } from "@/components/lite/portal/data-export-panel";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { contacts } from "@/lib/db/schema/contacts";

export default async function PortalDataExportPage() {
  const session = await requirePortalSession();
  const { mode } = await getPortalMode(session.contactId);

  if (mode === "pre_retainer") {
    return <SectionLocked sectionLabel="Download My Data" />;
  }

  const contact = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (contact) {
    await logActivity({
      companyId: contact.company_id,
      contactId: session.contactId,
      kind: "data_export_page_viewed",
      body: "Client viewed data export page",
    });
  }

  return <DataExportPanel />;
}
