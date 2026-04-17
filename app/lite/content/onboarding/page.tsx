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
import { getWizardShellConfig } from "@/lib/wizards/shell-config";
import { ContentEngineOnboardingClient } from "./_components/onboarding-client";

export const metadata = {
  title: "Content Engine setup — SuperBad",
};

export default async function ContentEngineOnboardingPage() {
  const shellConfig = await getWizardShellConfig();

  return (
    <ContentEngineOnboardingClient expiryDays={shellConfig.expiryDays} />
  );
}
