import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";

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
    vendorKey: "stripe",
    label: "Stripe",
    description: "Payments, subscriptions, invoicing.",
    wizardPath: "/lite/setup/critical-flight/stripe-admin",
    envHint: "STRIPE_SECRET_KEY",
  },
  {
    vendorKey: "resend",
    label: "Resend",
    description: "Transactional and marketing email.",
    wizardPath: "/lite/setup/critical-flight/resend",
    envHint: "RESEND_API_KEY",
  },
  {
    vendorKey: "graph-api",
    label: "Microsoft Graph",
    description: "Inbox sync, calendar, email sending.",
    wizardPath: "/lite/setup/critical-flight/graph-api-admin",
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
    vendorKey: "meta-ads",
    label: "Meta Ads",
    description: "Facebook and Instagram ad campaigns.",
    wizardPath: "/lite/setup/admin/meta-ads",
    envHint: null,
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

  const statusByVendor = new Map<
    string,
    { status: string; verifiedAt: number }
  >();
  for (const c of connections) {
    const existing = statusByVendor.get(c.vendor_key);
    if (!existing || c.connection_verified_at_ms > existing.verifiedAt) {
      statusByVendor.set(c.vendor_key, {
        status: c.status,
        verifiedAt: c.connection_verified_at_ms,
      });
    }
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
          const conn = statusByVendor.get(integration.vendorKey);
          const isActive = conn?.status === "active";

          return (
            <div
              key={integration.vendorKey}
              className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-label)] text-[12px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]">
                    {integration.label}
                  </span>
                  <StatusDot active={isActive} />
                </div>
                <p className="mt-0.5 font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-400)]">
                  {integration.description}
                </p>
                {integration.envHint && !isActive ? (
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
                ) : null}
                {integration.wizardPath ? (
                  <Link
                    href={integration.wizardPath}
                    className="rounded-lg border border-[color:var(--color-neutral-600)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-300)] transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)]"
                  >
                    {isActive ? "Reconfigure" : "Set up"}
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

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-block size-1.5 rounded-full"
      style={{
        backgroundColor: active
          ? "var(--color-brand-pink)"
          : "var(--color-neutral-600)",
      }}
      title={active ? "Connected" : "Not connected"}
    />
  );
}
