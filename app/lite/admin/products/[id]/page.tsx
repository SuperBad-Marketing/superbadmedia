/**
 * /lite/admin/products/[id] — SaaS product detail + archive surface.
 * Spec: docs/specs/saas-subscription-billing.md §8.3, §8.4.
 * Brief: sessions/sb-2c-brief.md (SB-2c).
 * Admin-only; non-admins redirect to sign-in.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { loadSaasProductDetail } from "@/lib/saas-products/queries";
import type { SaasProductStatus } from "@/lib/db/schema/saas-products";
import { StatusPillClient } from "./clients/status-pill-client";
import { ArchiveButtonClient } from "./clients/archive-button-client";

export const metadata: Metadata = {
  title: "SuperBad — Product",
  robots: { index: false, follow: false },
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stripeDashboardLink(stripeProductId: string): string {
  // Test-mode dashboard link; live-mode strips the "/test" segment. Andy
  // runs test mode pre-launch so this is the correct default.
  return `https://dashboard.stripe.com/test/products/${stripeProductId}`;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const detail = await loadSaasProductDetail(id);
  if (!detail) notFound();

  const { row, dimensions, tiers } = detail;
  const status: SaasProductStatus = row.status;

  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 pt-6 pb-3">
        <Link
          href="/lite/admin/products"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← All products
        </Link>
      </div>

      <header className="flex flex-col gap-3 px-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold">{row.name}</h1>
            <StatusPillClient status={status} />
          </div>
          {row.description ? (
            <p className="text-sm text-muted-foreground">{row.description}</p>
          ) : null}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <div>
              <dt className="inline">Slug: </dt>
              <dd className="inline font-mono text-foreground">{row.slug}</dd>
            </div>
            <div>
              <dt className="inline">Created: </dt>
              <dd className="inline text-foreground">
                {formatDate(row.created_at_ms)}
              </dd>
            </div>
            {row.stripe_product_id ? (
              <div>
                <dt className="inline">Stripe: </dt>
                <dd className="inline">
                  <a
                    href={stripeDashboardLink(row.stripe_product_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-foreground underline underline-offset-2 hover:opacity-80"
                  >
                    {row.stripe_product_id}
                  </a>
                </dd>
              </div>
            ) : (
              <div>
                <dt className="inline">Stripe: </dt>
                <dd className="inline text-muted-foreground">not synced</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex gap-2">
          {status === "active" ? (
            <ArchiveButtonClient productId={row.id} mode="archive" />
          ) : null}
          {status === "archived" ? (
            <ArchiveButtonClient productId={row.id} mode="unarchive" />
          ) : null}
        </div>
      </header>

      {status === "archived" ? (
        <div className="mx-4 mb-5 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Archived. Hidden from the customer picker. Existing subscribers keep
          billing at their current Prices — those stay active in Stripe.
          Un-archive to make it available again; new customers will subscribe
          to the current active Prices.
        </div>
      ) : null}

      <section aria-labelledby="dimensions-heading" className="px-4 pb-6">
        <h2
          id="dimensions-heading"
          className="mb-2 font-heading text-lg font-semibold"
        >
          Usage dimensions
        </h2>
        {dimensions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
            No dimensions configured.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dimensions.map((d) => (
              <li
                key={d.id}
                className="rounded-md border border-border bg-card p-3"
              >
                <p className="text-sm font-medium">{d.display_name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {d.dimension_key}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tiers-heading" className="px-4 pb-10">
        <h2
          id="tiers-heading"
          className="mb-2 font-heading text-lg font-semibold"
        >
          Tiers
        </h2>
        {tiers.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
            This product was never published. Complete the setup wizard.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {tiers.map(({ row: t, limits }) => {
              const flags = (t.feature_flags ?? {}) as Record<string, boolean>;
              const flagEntries = Object.entries(flags);
              return (
                <article
                  key={t.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                  data-tier-rank={t.tier_rank}
                >
                  <header className="flex items-baseline justify-between gap-2">
                    <h3 className="font-heading text-base font-semibold">
                      {t.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      Rank {t.tier_rank}
                    </span>
                  </header>

                  <div className="mt-2">
                    <p className="font-heading text-xl font-semibold">
                      {formatCents(t.monthly_price_cents_inc_gst)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / month inc. GST
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Setup fee: {formatCents(t.setup_fee_cents_inc_gst)}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Limits
                    </p>
                    {limits.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No dimensions.
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm">
                        {limits.map(({ dimension, limit }) => (
                          <li
                            key={dimension.id}
                            className="flex justify-between gap-2"
                          >
                            <span className="text-muted-foreground">
                              {dimension.display_name}
                            </span>
                            <span className="font-medium">
                              {limit === null || limit.limit_value === null
                                ? "Unlimited"
                                : limit.limit_value.toLocaleString("en-AU")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {flagEntries.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Feature flags
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {flagEntries.map(([k, v]) => (
                          <li
                            key={k}
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              v
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground line-through"
                            }`}
                          >
                            {k}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-3 border-t border-border pt-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Stripe Prices
                    </p>
                    <dl className="mt-1 space-y-0.5 text-xs">
                      <PriceRow label="Monthly" id={t.stripe_monthly_price_id} />
                      <PriceRow
                        label="Annual (monthly)"
                        id={t.stripe_annual_price_id}
                      />
                      <PriceRow
                        label="Annual (upfront)"
                        id={t.stripe_upfront_price_id}
                      />
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function PriceRow({ label, id }: { label: string; id: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground">
        {id ? id : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
