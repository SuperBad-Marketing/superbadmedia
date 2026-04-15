/**
 * /lite/admin/products — SaaS product admin index.
 * Spec: docs/specs/saas-subscription-billing.md §8.1, §8.3.
 * Brief: sessions/sb-2-brief.md (SB-2a) + sessions/sb-2c-brief.md (SB-2c).
 * Visual rebuild: sessions/admin-polish-2-brief.md against mockup-admin-interior.html.
 * Admin-only; non-admins redirect to sign-in.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { listSaasProducts } from "@/lib/saas-products/queries";
import { getSaasHeadlineSignals } from "@/lib/saas-products/headline-signals";
import { killSwitches } from "@/lib/kill-switches";
import { HeadlineStrip } from "@/components/lite/saas-admin/headline-strip";
import type { SaasProductStatus } from "@/lib/db/schema/saas-products";

export const metadata: Metadata = {
  title: "SuperBad — Products",
  robots: { index: false, follow: false },
};

function formatCents(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_LABEL: Record<SaasProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export default async function ProductsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { archived } = await searchParams;
  const includeArchived = archived === "1";

  const headlinesEnabled = killSwitches.saas_headlines_enabled;
  const [products, signals] = await Promise.all([
    listSaasProducts({ includeArchived }),
    headlinesEnabled ? getSaasHeadlineSignals() : Promise.resolve(null),
  ]);

  const activeCount = products.filter((p) => p.row.status === "active").length;
  const isEmpty = products.length === 0;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Products
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Products
          </h1>
          <Link
            href="/lite/setup/admin/saas-product-setup"
            data-testid="products-new-cta"
            className="inline-flex h-10 items-center rounded-md px-4 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-95"
            style={{
              letterSpacing: "1.8px",
              background: "var(--color-brand-red)",
              boxShadow:
                "var(--surface-highlight), 0 0 0 1px rgba(178,40,72,0.35), 0 6px 20px -10px rgba(178,40,72,0.6)",
            }}
          >
            New product
          </Link>
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          What the customer picker sees.
          {isEmpty ? null : (
            <>
              {" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                {activeCount > 0
                  ? "the machine's humming."
                  : "still heating up."}
              </em>
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {products.length}
          </span>
          <span>product{products.length === 1 ? "" : "s"}</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">
            ·
          </span>
          <span>SaaS catalogue</span>
          {includeArchived ? (
            <>
              <span
                aria-hidden
                className="text-[color:var(--color-neutral-700)]"
              >
                ·
              </span>
              <span
                className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                incl. archived
              </span>
            </>
          ) : null}
        </div>
      </header>

      {signals ? (
        <HeadlineStrip signals={signals} />
      ) : (
        <section
          aria-label="Product summary"
          className="px-4 pb-4"
          data-testid="headlines-paused"
        >
          <p
            className="rounded-[10px] px-4 py-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{
              letterSpacing: "1.5px",
              background: "rgba(15, 15, 14, 0.45)",
              border: "1px solid rgba(253, 245, 230, 0.05)",
            }}
          >
            Headlines paused.
          </p>
        </section>
      )}

      <div className="flex items-center justify-end px-4 pb-3">
        <Link
          href={
            includeArchived
              ? "/lite/admin/products"
              : "/lite/admin/products?archived=1"
          }
          data-testid="products-archived-toggle"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.8px" }}
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>

      <section aria-label="Product list" className="px-4 pb-10">
        {isEmpty ? (
          <EmptyProducts />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {products.map(
              ({ row, tierCount, subscriberCount, mrrCents }) => (
                <li
                  key={row.id}
                  data-slot="product-card"
                  data-product-id={row.id}
                  className="group relative flex flex-col gap-3 rounded-[12px] px-5 py-[18px] transition-[transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)]"
                  style={{
                    background: "var(--color-surface-2)",
                    border: "1px solid transparent",
                    boxShadow: "var(--surface-highlight)",
                  }}
                >
                  <Link
                    href={`/lite/admin/products/${row.id}`}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-[family-name:var(--font-body)] text-[16px] font-medium leading-[1.3] text-[color:var(--color-brand-cream)]">
                          {row.name}
                        </div>
                        {row.description ? (
                          <div className="mt-1 line-clamp-1 text-[12px] text-[color:var(--color-neutral-500)]">
                            {row.description}
                          </div>
                        ) : null}
                      </div>
                      <StatusChip status={row.status} />
                    </div>

                    <div
                      className="grid grid-cols-3 gap-3 border-t pt-[10px]"
                      style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
                    >
                      <MetricCell
                        label="Subscribers"
                        value={String(subscriberCount)}
                      />
                      <MetricCell label="MRR" value={formatCents(mrrCents)} />
                      <MetricCell label="Tiers" value={String(tierCount)} />
                    </div>

                    <div>
                      {tierCount === 0 ? (
                        <div
                          className="flex h-[6px] items-center rounded-full pl-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                          style={{
                            letterSpacing: "1.2px",
                            background: "rgba(253, 245, 230, 0.04)",
                          }}
                          role="img"
                          aria-label="No tiers yet"
                        >
                          No tiers yet
                        </div>
                      ) : (
                        <div
                          className="flex h-[6px] gap-0.5 overflow-hidden rounded-full"
                          style={{ background: "rgba(253, 245, 230, 0.04)" }}
                        >
                          {Array.from({ length: tierCount }).map((_, i) => (
                            <span
                              key={i}
                              className="flex-1"
                              style={{
                                background: "rgba(244, 160, 176, 0.45)",
                              }}
                              aria-hidden
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusChip({ status }: { status: SaasProductStatus }) {
  const tone =
    status === "active"
      ? {
          background: "rgba(123, 174, 126, 0.14)",
          color: "var(--color-success)",
        }
      : status === "archived"
        ? {
            background: "rgba(128, 127, 115, 0.15)",
            color: "var(--color-neutral-500)",
          }
        : {
            background: "rgba(244, 160, 176, 0.10)",
            color: "var(--color-brand-pink)",
          };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{ letterSpacing: "1.5px", ...tone }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt
        className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </dt>
      <dd
        className="font-[family-name:var(--font-label)] text-[14px] tabular-nums text-[color:var(--color-neutral-300)]"
        style={{ letterSpacing: "0.5px" }}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyProducts() {
  return (
    <div
      className="rounded-[12px] px-8 py-10 text-center"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <p
        className="font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.2px" }}
      >
        No products yet.
      </p>
      <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
        the popcorn machine's cold.
      </p>
      <Link
        href="/lite/setup/admin/saas-product-setup"
        className="mt-6 inline-flex h-10 items-center rounded-md px-4 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition hover:opacity-95"
        style={{
          letterSpacing: "1.8px",
          background: "var(--color-brand-red)",
          boxShadow:
            "var(--surface-highlight), 0 0 0 1px rgba(178,40,72,0.35), 0 6px 20px -10px rgba(178,40,72,0.6)",
        }}
      >
        New product
      </Link>
    </div>
  );
}
