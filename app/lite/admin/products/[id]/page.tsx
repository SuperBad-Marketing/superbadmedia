/**
 * /lite/admin/products/[id] — SaaS product detail + archive surface.
 * Spec: docs/specs/saas-subscription-billing.md §8.3, §8.4.
 * Brief: sessions/sb-2c-brief.md (SB-2c).
 * Visual rebuild: sessions/admin-polish-2-brief.md against mockup-admin-interior.html.
 * Admin-only; non-admins redirect to sign-in.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { loadSaasProductDetail } from "@/lib/saas-products/queries";
import { getSaasHeadlineSignalsForProduct } from "@/lib/saas-products/headline-signals";
import { killSwitches } from "@/lib/kill-switches";
import { HeadlineStrip } from "@/components/lite/saas-admin/headline-strip";
import type { SaasProductStatus } from "@/lib/db/schema/saas-products";
import { StatusPillClient } from "./clients/status-pill-client";
import { ArchiveButtonClient } from "./clients/archive-button-client";

export const metadata: Metadata = {
  title: "SuperBad — Product",
  robots: { index: false, follow: false },
};

function formatMoneyParts(cents: number): { integer: string; fractional: string | null } {
  const whole = Math.trunc(cents / 100);
  const frac = cents % 100;
  const integer = whole.toLocaleString("en-AU");
  const fractional = frac === 0 ? null : `.${String(frac).padStart(2, "0")}`;
  return { integer, fractional };
}

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

function muttersByStatus(status: SaasProductStatus): string {
  if (status === "active") return "the machine's running.";
  if (status === "archived") return "benched, not deleted.";
  return "still heating up.";
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

  const headlinesEnabled = killSwitches.saas_headlines_enabled;
  const signals = headlinesEnabled
    ? await getSaasHeadlineSignalsForProduct(id)
    : null;

  const { row, dimensions, tiers } = detail;
  const status: SaasProductStatus = row.status;

  return (
    <div>
      <div className="px-4 pt-6 pb-3">
        <Link
          href="/lite/admin/products"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.8px" }}
        >
          ← All products
        </Link>
      </div>

      <header className="px-4 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Products · {row.name}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "-0.4px" }}
              >
                {row.name}
              </h1>
              <StatusPillClient status={status} />
            </div>
            <p className="max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
              {status === "active"
                ? `Live since ${formatDate(row.created_at_ms)}.`
                : status === "archived"
                  ? `Archived.`
                  : `Drafted ${formatDate(row.created_at_ms)}.`}{" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                {muttersByStatus(status)}
              </em>
            </p>
            {row.description ? (
              <p className="max-w-[640px] text-[13px] text-[color:var(--color-neutral-500)]">
                {row.description}
              </p>
            ) : null}
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[color:var(--color-neutral-500)]">
              <div className="flex items-center gap-2">
                <dt
                  className="font-[family-name:var(--font-label)] uppercase"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Slug
                </dt>
                <dd className="font-mono text-[color:var(--color-neutral-300)]">
                  {row.slug}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt
                  className="font-[family-name:var(--font-label)] uppercase"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Created
                </dt>
                <dd className="text-[color:var(--color-neutral-300)]">
                  {formatDate(row.created_at_ms)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt
                  className="font-[family-name:var(--font-label)] uppercase"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Stripe
                </dt>
                <dd>
                  {row.stripe_product_id ? (
                    <a
                      href={stripeDashboardLink(row.stripe_product_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[color:var(--color-neutral-300)] underline underline-offset-2 transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                    >
                      {row.stripe_product_id}
                    </a>
                  ) : (
                    <span className="italic text-[color:var(--color-neutral-500)]">
                      not synced
                    </span>
                  )}
                </dd>
              </div>
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
        </div>
      </header>

      {status === "archived" ? (
        <div
          className="mx-4 mb-5 flex flex-col gap-1 rounded-[10px] px-4 py-3"
          style={{
            background: "rgba(15, 15, 14, 0.45)",
            border: "1px solid rgba(253, 245, 230, 0.05)",
          }}
          role="status"
        >
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Archived · product state
          </div>
          <p className="text-[14px] text-[color:var(--color-neutral-300)]">
            Hidden from the customer picker. Existing subscribers keep
            billing at their current Prices — those stay active in Stripe.
          </p>
          <p className="text-[12px] italic text-[color:var(--color-neutral-500)]">
            Un-archive to make it available again; new customers subscribe to
            the current active Prices.
          </p>
        </div>
      ) : null}

      {signals ? <HeadlineStrip signals={signals} scoped /> : null}

      <section aria-labelledby="dimensions-heading" className="px-4 pb-6">
        <h2
          id="dimensions-heading"
          className="mb-3 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.8px" }}
        >
          Usage dimensions
        </h2>
        {dimensions.length === 0 ? (
          <p
            className="rounded-[10px] px-4 py-3 text-[13px] italic text-[color:var(--color-neutral-500)]"
            style={{
              background: "rgba(15, 15, 14, 0.45)",
              border: "1px dashed rgba(128, 127, 115, 0.35)",
            }}
          >
            Nothing metered. Nothing gated.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dimensions.map((d) => (
              <li
                key={d.id}
                className="rounded-[12px] px-4 py-3"
                style={{
                  background: "var(--color-surface-2)",
                  boxShadow: "var(--surface-highlight)",
                }}
              >
                <p className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                  {d.display_name}
                </p>
                <p className="mt-1 font-mono text-[11px] text-[color:var(--color-neutral-500)]">
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
          className="mb-3 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.8px" }}
        >
          Tiers
        </h2>
        {tiers.length === 0 ? (
          <p
            className="rounded-[10px] px-4 py-3 text-[13px] italic text-[color:var(--color-neutral-500)]"
            style={{
              background: "rgba(15, 15, 14, 0.45)",
              border: "1px dashed rgba(128, 127, 115, 0.35)",
            }}
          >
            This product was never published. Complete the setup wizard.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {tiers.map(({ row: t, limits }) => {
              const flags = (t.feature_flags ?? {}) as Record<string, boolean>;
              const flagEntries = Object.entries(flags);
              const price = formatMoneyParts(t.monthly_price_cents_inc_gst);
              return (
                <article
                  key={t.id}
                  data-tier-rank={t.tier_rank}
                  className="flex flex-col gap-4 rounded-[12px] px-5 py-[18px]"
                  style={{
                    background: "var(--color-surface-2)",
                    boxShadow: "var(--surface-highlight)",
                  }}
                >
                  <header className="flex items-baseline justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-body)] text-[16px] font-medium text-[color:var(--color-brand-cream)]">
                      {t.name}
                    </h3>
                    <span
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{ letterSpacing: "1.5px" }}
                    >
                      Rank {t.tier_rank}
                    </span>
                  </header>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                        style={{ letterSpacing: "1.5px" }}
                      >
                        AUD
                      </span>
                      <span
                        className="font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)] tabular-nums"
                        style={{ letterSpacing: "-0.2px" }}
                      >
                        {price.integer}
                        {price.fractional ? (
                          <span className="text-[color:var(--color-neutral-300)]">
                            {price.fractional}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[12px] text-[color:var(--color-neutral-500)]">
                        / mo inc. GST
                      </span>
                    </div>
                    <p
                      className="mt-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{ letterSpacing: "1.5px" }}
                    >
                      Setup {formatCents(t.setup_fee_cents_inc_gst)}
                    </p>
                  </div>

                  <div>
                    <p
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{ letterSpacing: "1.5px" }}
                    >
                      Limits
                    </p>
                    {limits.length === 0 ? (
                      <p className="mt-1 text-[12px] italic text-[color:var(--color-neutral-500)]">
                        No dimensions.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-[13px]">
                        {limits.map(({ dimension, limit }) => (
                          <li
                            key={dimension.id}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span className="text-[color:var(--color-neutral-500)]">
                              {dimension.display_name}
                            </span>
                            <span
                              className="font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]"
                              style={{ letterSpacing: "0.5px" }}
                            >
                              {limit === null || limit.limit_value === null
                                ? "∞"
                                : limit.limit_value.toLocaleString("en-AU")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {flagEntries.length > 0 ? (
                    <div>
                      <p
                        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                        style={{ letterSpacing: "1.5px" }}
                      >
                        Feature flags
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {flagEntries.map(([k, v]) => (
                          <li
                            key={k}
                            className="inline-flex items-center rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[10px] uppercase"
                            style={{
                              letterSpacing: "1.5px",
                              background: v
                                ? "rgba(123, 174, 126, 0.14)"
                                : "rgba(128, 127, 115, 0.12)",
                              color: v
                                ? "var(--color-success)"
                                : "var(--color-neutral-500)",
                              textDecoration: v ? "none" : "line-through",
                              textDecorationColor: v
                                ? undefined
                                : "rgba(212, 210, 194, 0.25)",
                            }}
                          >
                            {k}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div
                    className="border-t pt-[10px]"
                    style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
                  >
                    <p
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{ letterSpacing: "1.5px" }}
                    >
                      Stripe Prices
                    </p>
                    <dl className="mt-2 space-y-1 text-[11px]">
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
    </div>
  );
}

function PriceRow({ label, id }: { label: string; id: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[color:var(--color-neutral-500)]">{label}</dt>
      <dd>
        {id ? (
          <span className="font-mono text-[color:var(--color-neutral-300)]">
            {id}
          </span>
        ) : (
          <span className="text-[color:var(--color-neutral-500)]">—</span>
        )}
      </dd>
    </div>
  );
}
