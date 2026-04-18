import { requirePortalSession } from "@/lib/portal/require-session";
import { getPortalMode } from "@/lib/portal/mode";
import { SectionLocked } from "@/components/lite/portal/section-locked";
import { PortalSectionPlaceholder } from "@/components/lite/portal/section-placeholder";

export default async function PortalDeliverablesPage() {
  const session = await requirePortalSession();
  const { mode } = await getPortalMode(session.contactId);

  if (mode === "pre_retainer") {
    return <PortalSectionPlaceholder section="Deliverables" description="your photos, video, and tasks — all in one place." />;
  }

  return <PortalSectionPlaceholder section="Deliverables" description="your photos, video, and tasks — all in one place." />;
}
