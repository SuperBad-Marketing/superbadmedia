import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal/guard";
import { getChatHistory, getTodayChatCount, getDailyLimit } from "@/lib/portal/chat";
import { getBundleHubState } from "@/lib/portal/bundle-hub";
import { getPortalMode } from "@/lib/portal/mode";
import { logActivity } from "@/lib/activity-log";
import { ChatHome } from "@/components/lite/portal/chat-home";
import { BundleHub } from "@/components/lite/portal/bundle-hub";
import { BrandDnaGate } from "@/components/lite/portal/brand-dna-gate";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PortalHomePage({ params }: Props) {
  const { token } = await params;
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const [contactRow] = await db
    .select({
      name: contacts.name,
      portal_last_visited_at_ms: contacts.portal_last_visited_at_ms,
      bundled_hub_seen_at_ms: contacts.bundled_hub_seen_at_ms,
      onboarding_welcome_seen_at_ms: contacts.onboarding_welcome_seen_at_ms,
    })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  if (!contactRow) {
    redirect("/lite/portal/recover");
  }

  const modeResult = await getPortalMode(session.contactId);

  if (modeResult.mode === "retainer") {
    if (!modeResult.brandDnaComplete) {
      await logActivity({
        contactId: session.contactId,
        kind: "retainer_mode_brand_dna_gate_entered",
        body: JSON.stringify({
          client_id: session.contactId,
          contact_id: session.contactId,
        }),
      });

      return (
        <BrandDnaGate
          portalToken={token}
          contactFirstName={contactRow.name.split(" ")[0]}
        />
      );
    }

    const isDirectReferralEntrant =
      !session.submissionId &&
      contactRow.onboarding_welcome_seen_at_ms === null;
    if (isDirectReferralEntrant) {
      redirect(`/lite/portal/welcome?token=${token}`);
    }
  }

  const hubState = await getBundleHubState(session.contactId);

  if (hubState.showHub) {
    return (
      <BundleHub
        portalToken={token}
        hasGallery={hubState.hasGallery}
        hasPlan={hubState.hasPlan}
      />
    );
  }

  const isRetainerConverter =
    modeResult.mode === "retainer" && modeResult.brandDnaComplete;
  const bundleHubWasSeen = contactRow.bundled_hub_seen_at_ms !== null;
  const tourSeen =
    contactRow.portal_last_visited_at_ms !== null ||
    isRetainerConverter ||
    bundleHubWasSeen;

  const isKickoff =
    isRetainerConverter && !modeResult.retainerKickoffSaid;

  const [history, todayCount, dailyLimit] = await Promise.all([
    getChatHistory(session.contactId),
    getTodayChatCount(session.contactId),
    getDailyLimit(session.contactId),
  ]);

  return (
    <ChatHome
      contactName={contactRow.name}
      initialMessages={history}
      initialRemainingToday={Math.max(0, dailyLimit - todayCount)}
      dailyLimit={dailyLimit}
      tourSeen={tourSeen}
      kickoffVariant={isKickoff}
    />
  );
}
