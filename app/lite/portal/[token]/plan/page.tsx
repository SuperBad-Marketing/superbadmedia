import { requirePortalSession } from "@/lib/portal/require-session";
import { getPlanForPortal } from "@/lib/six-week-plan/portal-queries";
import { PortalSectionPlaceholder } from "@/components/lite/portal/section-placeholder";
import { PlanView } from "@/components/lite/portal/plan-view";

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

  return <PlanView data={planData} portalToken={token} />;
}
