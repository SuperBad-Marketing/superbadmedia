import { requirePortalSession } from "@/lib/portal/require-session";
import { getPlanForPortal } from "@/lib/six-week-plan/portal-queries";
import { PortalSectionPlaceholder } from "@/components/lite/portal/section-placeholder";
import { PlanView } from "@/components/lite/portal/plan-view";
import settings from "@/lib/settings";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PortalPlanPage({ params }: Props) {
  const { token } = await params;
  const session = await requirePortalSession();
  const planData = await getPlanForPortal(session.contactId);

  if (!planData) {
    return (
      <PortalSectionPlaceholder
        section="Your Plan"
        description="a bespoke 6-week marketing plan, built for you."
      />
    );
  }

  const revisionMinChars = await settings.get("plan.revision_note_min_chars");

  return <PlanView data={planData} portalToken={token} revisionMinChars={revisionMinChars} />;
}
