import { requirePortalSession } from "@/lib/portal/require-session";
import { DeliverablesList } from "@/components/lite/portal/deliverables-list";
import { DeliverablesHeader } from "@/components/lite/portal/deliverables-header";
import { getTasksForClientPortal } from "@/lib/tasks/portal";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";

export default async function PortalDeliverablesPage() {
  const session = await requirePortalSession();

  const [contact] = await db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  const companyId = contact?.company_id;

  const tasks = companyId
    ? await getTasksForClientPortal(companyId, {
        kind: ["client_deliverable", "client_task"],
      })
    : [];

  if (companyId) {
    void logActivity({
      contactId: session.contactId,
      companyId,
      kind: "deliverables_viewed",
      body: `Portal deliverables viewed (${tasks.length} items)`,
    });
  }

  const completedCount = tasks.filter(
    (t) => t.status === "delivered" || t.status === "done",
  ).length;
  const eyebrow =
    tasks.length > 0
      ? `${completedCount} of ${tasks.length} complete`
      : "your room";

  return (
    <div className="mx-auto max-w-[780px] px-4 md:px-8">
      <DeliverablesHeader eyebrow={eyebrow} />
      <DeliverablesList tasks={tasks} />
    </div>
  );
}
