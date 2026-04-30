import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { getCredential } from "@/lib/integrations/getCredential";

export const metadata: Metadata = {
  title: "SuperBad — Integrations",
  robots: { index: false, follow: false },
};

type IntegrationDef = {
  vendorKey: string;
  label: string;
  description: string;
  wizardPath: string | null;
  envHint: string | null;
};

const INTEGRATIONS: IntegrationDef[] = [
  {
    vendorKey: "stripe-admin",
    label: "Stripe",
    description: "Payments, subscriptions, invoicing.",
    wizardPath: "/lite/setup/critical-flight/stripe-admin?from=settings",
    envHint: "STRIPE_SECRET_KEY",
  },
  {
    vendorKey: "resend",
    label: "Resend",
    description: "Transactional and marketing email.",
    wizardPath: "/lite/setup/critical-flight/resend?from=settings",
    envHint: "RESEND_API_KEY",
  },
  {
    vendorKey: "graph-api",
    label: "Microsoft Graph",
    description: "Inbox sync, calendar, email sending.",
    wizardPath: "/lite/setup/critical-flight/graph-api-admin?from=settings",
    envHint: "MS_GRAPH_CLIENT_ID",
  },
  {
    vendorKey: "anthropic",
    label: "Anthropic",
    description: "LLM calls — Brand DNA, content generation, outreach.",
    wizardPath: "/lite/setup/admin/api-key?vendor=anthropic",
    envHint: "ANTHROPIC_API_KEY",
  },
  {
    vendorKey: "openai",
    label: "OpenAI",
    description: "Embeddings, fallback generation.",
    wizardPath: "/lite/setup/admin/api-key?vendor=openai",
    envHint: null,
  },
  {
    vendorKey: "cloudinary",
    label: "Cloudinary",
    description: "Image hosting, gallery delivery.",
    wizardPath: "/lite/setup/admin/cloudinary",
    envHint: null,
  },
  {
    vendorKey: "twilio",
    label: "Twilio",
    description: "SMS notifications.",
    wizardPath: "/lite/setup/admin/twilio",
    envHint: null,
  },
  {
    vendorKey: "meta",
    label: "Meta",
    description: "Instagram publishing, insights, ads, and audience management.",
    wizardPath: "/lite/setup/admin/meta",
    envHint: "INSTAGRAM_APP_ID",
  },
  {
    vendorKey: "google-ads",
    label: "Google Ads",
    description: "Google ad campaigns.",
    wizardPath: "/lite/setup/admin/google-ads",
    envHint: null,
  },
  {
    vendorKey: "serpapi",
    label: "SerpAPI",
    description: "Search result data for lead generation.",
    wizardPath: "/lite/setup/admin/api-key?vendor=serpapi",
    envHint: "SERPAPI_API_KEY",
  },
  {
    vendorKey: "hunter-io",
    label: "Hunter.io",
    description: "Primary email discovery for lead gen contacts.",
    wizardPath: "/lite/setup/admin/api-key?vendor=hunter-io",
    envHint: null,
  },
  {
    vendorKey: "apify",
    label: "Apify",
    description: "Contact email scraping — fallback when Hunter.io has no match.",
    wizardPath: "/lite/setup/admin/api-key?vendor=apify",
    envHint: null,
  },
  {
    vendorKey: "higgsfield",
    label: "Higgsfield",
    description: "AI video generation — cinematic, motion design, social.",
    wizardPath: "/lite/setup/admin/api-key?vendor=higgsfield",
    envHint: null,
  },
  {
    vendorKey: "posthog",
    label: "PostHog",
    description: "Analytics, session recording, heatmaps.",
    wizardPath: "/lite/setup/admin/posthog",
    envHint: "NEXT_PUBLIC_POSTHOG_KEY",
  },
  {
    vendorKey: "openweather",
    label: "OpenWeather",
    description: "Weather data for cockpit tickers.",
    wizardPath: "/lite/setup/admin/openweather",
    envHint: "OPENWEATHER_API_KEY",
  },
  {
    vendorKey: "football-data",
    label: "Football-Data.org",
    description: "Live football scores for cockpit tickers.",
    wizardPath: "/lite/setup/admin/football-data",
    envHint: "FOOTBALL_DATA_API_KEY",
  },
  {
    vendorKey: "spotify",
    label: "Spotify",
    description: "Playlist picker and cockpit music embed.",
    wizardPath: "/lite/setup/admin/spotify",
    envHint: null,
  },
  {
    vendorKey: "medium",
    label: "Medium",
    description: "Blog syndication — auto-publish with canonical backlink.",
    wizardPath: "/lite/setup/admin/medium",
    envHint: "MEDIUM_INTEGRATION_TOKEN",
  },
  {
    vendorKey: "linkedin_articles",
    label: "LinkedIn Articles",
    description: "Blog syndication — share as LinkedIn article.",
    wizardPath: "/lite/setup/admin/linkedin_articles",
    envHint: "LINKEDIN_ACCESS_TOKEN",
  },
  {
    vendorKey: "ghost",
    label: "Ghost",
    description: "Blog syndication — publish to Ghost CMS.",
    wizardPath: "/lite/setup/admin/ghost",
    envHint: "GHOST_ADMIN_API_KEY",
  },
  {
    vendorKey: "beehiiv",
    label: "Beehiiv",
    description: "Blog syndication — publish to Beehiiv newsletter.",
    wizardPath: "/lite/setup/admin/beehiiv",
    envHint: "BEEHIIV_API_KEY",
  },
  {
    vendorKey: "wordpress",
    label: "WordPress.com",
    description: "Blog syndication — publish to WordPress site.",
    wizardPath: "/lite/setup/admin/wordpress",
    envHint: "WORDPRESS_ACCESS_TOKEN",
  },
];

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const connections = await db
    .select({
      vendor_key: integration_connections.vendor_key,
      status: integration_connections.status,
      connection_verified_at_ms:
        integration_connections.connection_verified_at_ms,
    })
    .from(integration_connections)
    .orderBy(integration_connections.vendor_key);

  type ConnectionStatus = "active" | "broken" | "none";
  const statusByVendor = new Map<string, ConnectionStatus>();

  const dbVendors = new Set<string>();
  for (const c of connections) {
    if (c.status === "active") dbVendors.add(c.vendor_key);
  }

  const credentialChecks = await Promise.all(
    INTEGRATIONS.map(async (integration) => {
      const cred = await getCredential(integration.vendorKey);
      return { vendorKey: integration.vendorKey, hasCred: cred !== null };
    }),
  );
  for (const { vendorKey, hasCred } of credentialChecks) {
    statusByVendor.set(vendorKey, hasCred ? "active" : "none");
  }

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          Settings{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Integrations
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Integrations
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          API connections and third-party services.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the pipes behind the walls.
          </em>
        </p>
      </header>

      <div className="grid gap-2 px-4 pb-8">
        {INTEGRATIONS.map((integration) => {
          const status = statusByVendor.get(integration.vendorKey) ?? "none";
          const isActive = status === "active";
          const isBroken = status === "broken";

          return (
            <div
              key={integration.vendorKey}
              className="flex items-center justify-between gap-4 rounded-xl border bg-[color:var(--color-neutral-900)] px-4 py-3"
              style={{
                borderColor: isBroken
                  ? "var(--color-brand-red)"
                  : "var(--color-neutral-700)",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-label)] text-[12px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]">
                    {integration.label}
                  </span>
                  <StatusDot status={status} />
                </div>
                <p className="mt-0.5 font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-400)]">
                  {integration.description}
                </p>
                {isBroken ? (
                  <p className="mt-0.5 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-red)]">
                    Credential missing — reconfigure or add{" "}
                    {integration.envHint ?? "env var"} to .env.local
                  </p>
                ) : integration.envHint && !isActive ? (
                  <p className="mt-0.5 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
                    env: {integration.envHint}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isActive ? (
                  <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
                    Connected
                  </span>
                ) : isBroken ? (
                  <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-brand-red)]">
                    Broken
                  </span>
                ) : null}
                {integration.wizardPath ? (
                  <Link
                    href={integration.wizardPath}
                    className={
                      "rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-all " +
                      (isActive
                        ? "border border-[color:var(--color-neutral-600)] bg-transparent text-[color:var(--color-neutral-400)] hover:border-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
                        : isBroken
                          ? "border border-[color:var(--color-brand-red)] bg-[color:var(--color-brand-red)]/10 text-[color:var(--color-brand-red)] hover:bg-[color:var(--color-brand-red)]/20"
                          : "border border-[color:var(--color-brand-pink)] bg-[color:var(--color-brand-pink)]/10 text-[color:var(--color-brand-pink)] hover:bg-[color:var(--color-brand-pink)]/20")
                    }
                  >
                    {isActive ? "Reconfigure" : isBroken ? "Reconnect" : "Set up"}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "active" | "broken" | "none" }) {
  const color =
    status === "active"
      ? "var(--color-brand-pink)"
      : status === "broken"
        ? "var(--color-brand-red)"
        : "var(--color-neutral-600)";
  const title =
    status === "active"
      ? "Connected"
      : status === "broken"
        ? "Broken — credential missing"
        : "Not connected";
  return (
    <span
      className="inline-block size-1.5 rounded-full"
      style={{ backgroundColor: color }}
      title={title}
    />
  );
}
