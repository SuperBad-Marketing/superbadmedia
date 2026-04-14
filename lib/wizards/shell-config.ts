/**
 * Server-side bundler for the values the shell needs but shouldn't read
 * directly (client components can't await `settings.get`). Called from a
 * Server Component parent; the result is passed to <WizardShell> as props.
 *
 * Owner: SW-1. Consumers: every route/layout that renders a wizard.
 */

import settings from "@/lib/settings";

export type WizardShellConfig = {
  expiryDays: number;
};

export async function getWizardShellConfig(): Promise<WizardShellConfig> {
  const expiryDays = await settings.get("wizards.expiry_days");
  return { expiryDays };
}
