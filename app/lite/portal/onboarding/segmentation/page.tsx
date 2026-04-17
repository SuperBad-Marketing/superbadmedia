/**
 * `/lite/portal/onboarding/segmentation` — Revenue Segmentation questionnaire.
 *
 * SaaS-only. Renders after Brand DNA completion in the onboarding sequence.
 * Portal-session-guarded. Redirects to `/lite/portal` if already completed
 * or if the session is invalid.
 *
 * Tab title: "SuperBad — almost there" per spec §12.3.
 *
 * Owner: OS-2.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { getPortalSession } from "@/lib/portal/guard";
import { SegmentationClient } from "./segmentation-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SuperBad \u2014 almost there",
  robots: { index: false, follow: false },
};

export default async function RevSegPage() {
  const session = await getPortalSession();
  if (!session?.contactId) redirect("/lite/portal/recover");

  // Resolve company
  const contact = db
    .select({ company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (!contact?.company_id) redirect("/lite/portal");

  // Already completed? Skip forward.
  const company = db
    .select({
      revenue_segmentation_completed_at_ms:
        companies.revenue_segmentation_completed_at_ms,
    })
    .from(companies)
    .where(eq(companies.id, contact.company_id))
    .get();

  if (company?.revenue_segmentation_completed_at_ms != null) {
    redirect("/lite/portal");
  }

  return <SegmentationClient />;
}
