/**
 * `/lite/setup/admin/[key]` — non-critical admin integration wizard route.
 *
 * Parallel tree to `/lite/setup/critical-flight/[key]`. Houses wizards that
 * aren't part of the first-run critical arc (spec §8.2) — admin surfaces
 * the user lands on from the integrations hub or from feature-triggered
 * interception (spec §8.4).
 *
 * Dispatcher: CLIENT_MAP of wizard-key → renderer. SW-13 landed this
 * refactor (brief §4 Option A) when the generic `api-key` wizard
 * introduced the fourth distinct props shape + the first *dynamically
 * selected* wizard (vendor picked via `?vendor=…`). Replaced the prior
 * if-chain (SW-9 through SW-12). Adding a new wizard = add one
 * `CLIENT_MAP` row; no growing chain.
 *
 * Route-tree decision per SW-9: `/lite/setup/admin/[key]` (not
 * `/lite/setup/integrations/[key]`). Rationale: not every future admin
 * wizard is a vendor integration.
 *
 * Owner: SW-9. Dispatcher refactored by SW-13.
 */
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { getWizard } from "@/lib/wizards/registry";
import type {
  WizardAudience,
  WizardStepDefinition,
} from "@/lib/wizards/types";
import { getWizardShellConfig } from "@/lib/wizards/shell-config";
import { META_OAUTH_SCOPES } from "@/lib/integrations/vendors/meta-ads";
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_AUTHORIZE_URL,
} from "@/lib/integrations/vendors/google-ads";
import {
  isApiKeyVendor,
  getApiKeyVendorProfile,
} from "@/lib/wizards/defs/api-key";
import { PixiesetAdminClient } from "./clients/pixieset-admin-client";
import { MetaAdsClient } from "./clients/meta-ads-client";
import { GoogleAdsClient } from "./clients/google-ads-client";
import { TwilioClient } from "./clients/twilio-client";
import { ApiKeyClient } from "./clients/api-key-client";
import { SaasProductSetupClient } from "./clients/saas-product-setup-client";

// Side-effect import — registers every WizardDefinition via the barrel.
import "@/lib/wizards/defs";

/**
 * Common props every per-wizard client accepts. Per-wizard extras
 * (authorize URLs, vendor profiles) are added by the client's renderer.
 */
type CommonClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

type DispatcherArgs = {
  common: CommonClientProps;
  allowTestTokenInjection: boolean;
  searchParams: Record<string, string | string[] | undefined>;
};

type ClientRenderer = (args: DispatcherArgs) => ReactNode;

const CLIENT_MAP: Record<string, ClientRenderer> = {
  "pixieset-admin": ({ common }) => <PixiesetAdminClient {...common} />,
  "meta-ads": ({ common, allowTestTokenInjection }) => (
    <MetaAdsClient
      {...common}
      authorizeUrl={buildMetaAuthorizeUrl()}
      allowTestTokenInjection={allowTestTokenInjection}
    />
  ),
  "google-ads": ({ common, allowTestTokenInjection }) => (
    <GoogleAdsClient
      {...common}
      authorizeUrl={buildGoogleAuthorizeUrl()}
      allowTestTokenInjection={allowTestTokenInjection}
    />
  ),
  twilio: ({ common }) => <TwilioClient {...common} />,
  "saas-product-setup": ({ common }) => <SaasProductSetupClient {...common} />,
  "api-key": ({ common, searchParams }) => {
    const raw =
      typeof searchParams.vendor === "string" ? searchParams.vendor : "";
    if (!isApiKeyVendor(raw)) return null;
    const profile = getApiKeyVendorProfile(raw);
    return (
      <ApiKeyClient
        {...common}
        vendor={profile.vendor}
        vendorLabel={profile.label}
      />
    );
  },
};

export default async function AdminWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/lite/login");

  const def = getWizard(key);
  if (!def) notFound();
  if (def.audience !== "admin") notFound();

  // api-key wizard: unknown/missing `?vendor=` → 404.
  if (def.key === "api-key") {
    const raw = typeof sp.vendor === "string" ? sp.vendor : "";
    if (!isApiKeyVendor(raw)) notFound();
  }

  const { expiryDays } = await getWizardShellConfig();

  const outroCopy =
    typeof def.voiceTreatment.outroCopy === "string"
      ? def.voiceTreatment.outroCopy
      : def.voiceTreatment.outroCopy({});

  // Test-only injection flag — strictly non-production. Per-wizard clients
  // that support it read `?testToken=…` from the URL only when this is true.
  const allowTestTokenInjection = process.env.NODE_ENV !== "production";

  const common: CommonClientProps = {
    audience: def.audience,
    steps: def.steps,
    outroCopy,
    expiryDays,
  };

  const renderer = CLIENT_MAP[def.key];
  const rendered = renderer
    ? renderer({ common, allowTestTokenInjection, searchParams: sp })
    : null;

  if (rendered) {
    return <div className="min-h-screen bg-background">{rendered}</div>;
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
