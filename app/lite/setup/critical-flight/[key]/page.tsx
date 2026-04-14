/**
 * `/lite/setup/critical-flight/[key]` — render-by-key critical-flight route.
 *
 * Server Component responsibilities:
 *   1. auth() guard — redirect to /lite/login if no session.
 *   2. Resolve the WizardDefinition via getWizard(key); 404 if unknown.
 *   3. Pass the serialisable slice (steps + voiceTreatment.outroCopy +
 *      audience) plus settings-sourced timings (expiry days, webhook
 *      timeout) to the client driver.
 *
 * Importing `@/lib/wizards/defs/stripe-admin` is the side-effect that
 * registers the definition. SW-5 ships only this branch; SW-5b / SW-6
 * add additional def imports as their wizards land.
 *
 * Owner: SW-5.
 */
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { getWizard } from "@/lib/wizards/registry";
import { getWizardShellConfig } from "@/lib/wizards/shell-config";
import settings from "@/lib/settings";
import { CriticalFlightClient } from "./critical-flight-client";

// Side-effect import — registers every WizardDefinition via the barrel.
import "@/lib/wizards/defs";

export default async function CriticalFlightWizardPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/lite/login");

  const def = getWizard(key);
  if (!def) notFound();

  const { expiryDays } = await getWizardShellConfig();
  const webhookProbeTimeoutMs = await settings.get(
    "wizards.webhook_probe_timeout_ms",
  );

  const outroCopy =
    typeof def.voiceTreatment.outroCopy === "string"
      ? def.voiceTreatment.outroCopy
      : def.voiceTreatment.outroCopy({});

  return (
    <div className="min-h-screen bg-background">
      <CriticalFlightClient
        wizardKey={def.key}
        audience={def.audience}
        steps={def.steps}
        outroCopy={outroCopy}
        expiryDays={expiryDays}
        webhookProbeTimeoutMs={webhookProbeTimeoutMs}
      />
    </div>
  );
}
