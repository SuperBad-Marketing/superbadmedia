import { requirePortalSession } from "@/lib/portal/require-session";
import { getPortalMode } from "@/lib/portal/mode";
import { SectionLocked } from "@/components/lite/portal/section-locked";
import { PortalSectionPlaceholder } from "@/components/lite/portal/section-placeholder";

export default async function PortalMessagesPage() {
  const session = await requirePortalSession();
  const { mode } = await getPortalMode(session.contactId);

  if (mode === "pre_retainer") {
    return <SectionLocked sectionLabel="Messages" />;
  }

  return <PortalSectionPlaceholder section="Messages" description="your thread with Andy." />;
}
