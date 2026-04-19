import { requirePortalSession } from "@/lib/portal/require-session";
import { getPortalMode } from "@/lib/portal/mode";
import { PortalSectionPlaceholder } from "@/components/lite/portal/section-placeholder";

export default async function PortalPlanPage() {
  await requirePortalSession();

  return (
    <PortalSectionPlaceholder
      section="Your Plan"
      description="a bespoke 6-week marketing plan, built for you."
    />
  );
}
