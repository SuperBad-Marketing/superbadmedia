/**
 * `/lite/setup/admin/[key]` — non-critical admin integration wizard route.
 *
 * Parallel tree to `/lite/setup/critical-flight/[key]`. Houses wizards that
 * aren't part of the first-run critical arc (spec §8.2) — admin surfaces
 * the user lands on from the integrations hub or from feature-triggered
 * interception (spec §8.4). SW-9 ships the first wizard (`pixieset-admin`);
 * future admin wizards (Meta Ads, Google Ads, Twilio, generic API-key)
 * add per-wizard client files + dispatcher branches here.
 *
 * Route-tree decision per SW-8 open thread: `/lite/setup/admin/[key]`
 * (not `/lite/setup/integrations/[key]`). Rationale: not every future
 * admin wizard is a vendor integration (warmup-ramp config, brand policy,
 * etc.); `admin` reads cleanly alongside `critical-flight`. Spec §5 is
 * patched in the same session to document this.
 *
 * Owner: SW-9.
 */
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { getWizard } from "@/lib/wizards/registry";
import { getWizardShellConfig } from "@/lib/wizards/shell-config";
import { PixiesetAdminClient } from "./clients/pixieset-admin-client";

// Side-effect import — registers every WizardDefinition via the barrel.
import "@/lib/wizards/defs";

export default async function AdminWizardPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/lite/login");

  const def = getWizard(key);
  if (!def) notFound();
  if (def.audience !== "admin") notFound();

  const { expiryDays } = await getWizardShellConfig();

  const outroCopy =
    typeof def.voiceTreatment.outroCopy === "string"
      ? def.voiceTreatment.outroCopy
      : def.voiceTreatment.outroCopy({});

  return (
    <div className="min-h-screen bg-background">
      {def.key === "pixieset-admin" ? (
        <PixiesetAdminClient
          audience={def.audience}
          steps={def.steps}
          outroCopy={outroCopy}
          expiryDays={expiryDays}
        />
      ) : (
        <div
          data-wizard-unknown
          className="flex min-h-full items-center justify-center px-6 py-12 text-sm text-muted-foreground"
        >
          Unknown admin wizard: {def.key}.
        </div>
      )}
    </div>
  );
}
