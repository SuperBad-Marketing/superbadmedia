/**
 * `/lite/setup/admin/[key]` — non-critical admin integration wizard route.
 *
 * Parallel tree to `/lite/setup/critical-flight/[key]`. Houses wizards that
 * aren't part of the first-run critical arc (spec §8.2) — admin surfaces
 * the user lands on from the integrations hub or from feature-triggered
 * interception (spec §8.4). SW-9 shipped the first wizard (`pixieset-admin`);
 * SW-10 adds `meta-ads` (oauth-consent pattern). Future admin wizards
 * (Google Ads, Twilio, generic API-key) add per-wizard client files +
 * dispatcher branches here.
 *
 * Route-tree decision per SW-9: `/lite/setup/admin/[key]` (not
 * `/lite/setup/integrations/[key]`). Rationale: not every future admin
 * wizard is a vendor integration.
 *
 * Owner: SW-9. Extended by SW-10 (meta-ads branch + Meta authorize URL).
 */
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { getWizard } from "@/lib/wizards/registry";
import { getWizardShellConfig } from "@/lib/wizards/shell-config";
import { META_OAUTH_SCOPES } from "@/lib/integrations/vendors/meta-ads";
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_AUTHORIZE_URL,
} from "@/lib/integrations/vendors/google-ads";
import { PixiesetAdminClient } from "./clients/pixieset-admin-client";
import { MetaAdsClient } from "./clients/meta-ads-client";
import { GoogleAdsClient } from "./clients/google-ads-client";
import { TwilioClient } from "./clients/twilio-client";

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

  // Test-only injection flag — strictly non-production. Per-wizard clients
  // that support it read `?testToken=…` from the URL only when this is true.
  const allowTestTokenInjection = process.env.NODE_ENV !== "production";

  if (def.key === "pixieset-admin") {
    return (
      <div className="min-h-screen bg-background">
        <PixiesetAdminClient
          audience={def.audience}
          steps={def.steps}
          outroCopy={outroCopy}
          expiryDays={expiryDays}
        />
      </div>
    );
  }

  if (def.key === "meta-ads") {
    const metaAuthorizeUrl = buildMetaAuthorizeUrl();
    return (
      <div className="min-h-screen bg-background">
        <MetaAdsClient
          audience={def.audience}
          steps={def.steps}
          outroCopy={outroCopy}
          expiryDays={expiryDays}
          authorizeUrl={metaAuthorizeUrl}
          allowTestTokenInjection={allowTestTokenInjection}
        />
      </div>
    );
  }

  if (def.key === "google-ads") {
    const googleAuthorizeUrl = buildGoogleAuthorizeUrl();
    return (
      <div className="min-h-screen bg-background">
        <GoogleAdsClient
          audience={def.audience}
          steps={def.steps}
          outroCopy={outroCopy}
          expiryDays={expiryDays}
          authorizeUrl={googleAuthorizeUrl}
          allowTestTokenInjection={allowTestTokenInjection}
        />
      </div>
    );
  }

  if (def.key === "twilio") {
    return (
      <div className="min-h-screen bg-background">
        <TwilioClient
          audience={def.audience}
          steps={def.steps}
          outroCopy={outroCopy}
          expiryDays={expiryDays}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div
        data-wizard-unknown
        className="flex min-h-full items-center justify-center px-6 py-12 text-sm text-muted-foreground"
      >
        Unknown admin wizard: {def.key}.
      </div>
    </div>
  );
}

/**
 * meta-ads-only: compute the Meta authorize URL from env. If
 * `META_ADS_CLIENT_ID` is unset (common in dev until Andy registers a Meta
 * app) the URL is a harmless "#". SW-10-b hardens the real oauth flow;
 * until then, the E2E testToken path bypasses this entirely.
 */
function buildMetaAuthorizeUrl(): string {
  const clientId = process.env.META_ADS_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  if (!clientId) return "#";
  const redirectUri = `${appUrl}/api/oauth/meta-ads/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: META_OAUTH_SCOPES.join(","),
  });
  return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
}

/**
 * google-ads-only: compute the Google authorize URL from env. If
 * `GOOGLE_ADS_CLIENT_ID` is unset (common in dev until Andy registers a
 * Google Cloud app) the URL is a harmless "#". SW-11-b hardens the real
 * oauth flow; until then the E2E testToken path bypasses this entirely.
 *
 * Google requires `access_type=offline` + `prompt=consent` for refresh
 * tokens; surfaced here for when SW-11-b wires the token exchange.
 */
function buildGoogleAuthorizeUrl(): string {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  if (!clientId) return "#";
  const redirectUri = `${appUrl}/api/oauth/google-ads/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}
