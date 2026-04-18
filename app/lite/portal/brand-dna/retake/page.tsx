import { redirect } from "next/navigation";

import { getPortalSession } from "@/lib/portal/guard";
import { startRetake } from "@/lib/brand-dna/start-retake";

import { RetakeConfirmClient } from "./retake-confirm-client";

/**
 * Portal Brand DNA — retake trigger page.
 *
 * Shows a confirmation screen, then starts the retake (archives current
 * profile, creates a new version, redirects to the alignment gate).
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaRetakePage() {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  async function handleRetake() {
    "use server";

    const portalSession = await getPortalSession();
    if (!portalSession) {
      redirect("/lite/portal/recover");
    }

    const result = await startRetake(portalSession.contactId, {
      subjectType: "client",
      companyId: portalSession.clientId,
    });

    if (!result) {
      redirect("/lite/portal/brand-dna/profile");
    }

    redirect(`/lite/portal/brand-dna?retake=true`);
  }

  return <RetakeConfirmClient retakeAction={handleRetake} />;
}
