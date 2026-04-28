import { requirePortalSession } from "@/lib/portal/require-session";
import { getPortalMode } from "@/lib/portal/mode";
import { SectionLocked } from "@/components/lite/portal/section-locked";
import { PortalMessagesView } from "@/components/lite/portal/messages-view";
import { fetchPortalThreads } from "./actions";

export default async function PortalMessagesPage() {
  const session = await requirePortalSession();
  const { mode } = await getPortalMode(session.contactId);

  if (mode === "pre_retainer") {
    return <SectionLocked sectionLabel="Messages" />;
  }

  const threads = await fetchPortalThreads();

  return <PortalMessagesView threads={threads} />;
}
