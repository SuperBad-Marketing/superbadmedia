import { requirePortalSession } from "@/lib/portal/require-session";
import { getPortalMode } from "@/lib/portal/mode";
import { SectionLocked } from "@/components/lite/portal/section-locked";
import { PortalSectionPlaceholder } from "@/components/lite/portal/section-placeholder";

export default async function PortalPackagePage() {
  const session = await requirePortalSession();
  const { mode } = await getPortalMode(session.contactId);

  if (mode === "pre_retainer") {
    return <SectionLocked sectionLabel="Package" />;
  }

  return <PortalSectionPlaceholder section="Package" description="your subscription and billing details." />;
}
