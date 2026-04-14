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

  // graph-api-admin-only: compute the Microsoft authorize URL from env.
  // If MS_GRAPH_CLIENT_ID / MS_GRAPH_TENANT_ID are unset (common in dev
  // until Andy registers an Azure app) the URL is a harmless "#". SW-7-b
  // hardens the real oauth flow; until then, the E2E testToken path
  // bypasses this entirely.
  const graphAuthorizeUrl = buildGraphAuthorizeUrl();

  // Test-only injection flag — strictly non-production. The graph-api-admin
  // client reads `?testToken=…` from the URL only when this flag is true.
  // Gated here so production pages never set it.
  const allowTestTokenInjection = process.env.NODE_ENV !== "production";

  return (
    <div className="min-h-screen bg-background">
      <CriticalFlightClient
        wizardKey={def.key}
        audience={def.audience}
        steps={def.steps}
        outroCopy={outroCopy}
        expiryDays={expiryDays}
        webhookProbeTimeoutMs={webhookProbeTimeoutMs}
        graphAuthorizeUrl={graphAuthorizeUrl}
        allowTestTokenInjection={allowTestTokenInjection}
      />
    </div>
  );
}

function buildGraphAuthorizeUrl(): string {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const tenantId = process.env.MS_GRAPH_TENANT_ID ?? "common";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  if (!clientId) return "#";
  const redirectUri = `${appUrl}/api/oauth/graph-api/callback`;
  const scopes = [
    "offline_access",
    "User.Read",
    "Mail.Send",
    "Calendars.Read",
  ].join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scopes,
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}
