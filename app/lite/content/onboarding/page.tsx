/**
 * Content Engine onboarding wizard page (CE-12).
 *
 * Three-step wizard inside <WizardShell>:
 *   1. Domain verification (DNS records)
 *   2. Seed keyword review (auto-derived, approve/tweak)
 *   3. Newsletter preferences (send window + optional CSV import + embed form)
 *
 * Spec: docs/specs/content-engine.md §3.3, §1.1.
 * Owner: CE-12.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { getWizardShellConfig } from "@/lib/wizards/shell-config";
import { ContentEngineOnboardingClient } from "./_components/onboarding-client";

export const metadata = {
  title: "Content Engine setup — SuperBad",
};

export default async function ContentEngineOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    redirect("/lite/login");
  }

  const sp = await searchParams;
  const shellConfig = await getWizardShellConfig();

  const allCompanies = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .limit(100);

  const requestedId = typeof sp.company === "string" ? sp.company : undefined;
  const selectedCompany = requestedId
    ? allCompanies.find((c) => c.id === requestedId)
    : allCompanies[0];

  return (
    <ContentEngineOnboardingClient
      expiryDays={shellConfig.expiryDays}
      companyId={selectedCompany?.id}
      companies={allCompanies}
    />
  );
}
