/**
 * /lite/admin/products — SaaS product admin index.
 * Spec: docs/specs/saas-subscription-billing.md §8.1.
 * Brief: sessions/sb-2-brief.md (SB-2a).
 * Admin-only; non-admins redirect to sign-in.
 *
 * Summary cards + product list + "New product" CTA → saas-product-setup
 * wizard. Subscriber / MRR / churn fields all read 0 in SB-2a (no
 * subscribers exist yet); SB-7/SB-8 wire real values.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import {
  listSaasProducts,
  getSaasProductSummaryCounts,
} from "@/lib/saas-products/queries";
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

const STATUS_CLASSES: Record<SaasProductStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  archived: "bg-muted/60 text-muted-foreground line-through",
};

export default async function ProductsAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [products, summary] = await Promise.all([
    listSaasProducts(),
    getSaasProductSummaryCounts(),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <div className="flex items-start justify-between gap-4 px-4 pt-6 pb-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"} · SaaS
            catalogue.
          </p>
        </div>
        <Link
          href="/lite/setup/admin/saas-product-setup"
          data-testid="products-new-cta"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          New product
        </Link>
      </div>

      <section
        aria-label="Product summary"
        className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SummaryCard label="Active subscribers" value={String(summary.activeSubscribers)} />
        <SummaryCard label="Total MRR" value={formatCents(summary.mrrCents)} />
        <SummaryCard label="New this month" value={String(summary.newThisMonth)} />
        <SummaryCard label="Churn this month" value={String(summary.churnThisMonth)} />
      </section>

      <section aria-label="Product list" className="px-4 pb-10">
        {products.length === 0 ? (
          <EmptyProducts />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {products.map(({ row, tierCount, subscriberCount, mrrCents }) => (
              <li
                key={row.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
                data-product-id={row.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg font-semibold">
                      {row.name}
                    </h2>
                    {row.description ? (
                      <p className="text-sm text-muted-foreground">
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[row.status]}`}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <div>
                    <dt>Subscribers</dt>
                    <dd className="text-sm text-foreground">{subscriberCount}</dd>
                  </div>
                  <div>
                    <dt>MRR</dt>
                    <dd className="text-sm text-foreground">{formatCents(mrrCents)}</dd>
                  </div>
                  <div>
                    <dt>Tiers</dt>
                    <dd className="text-sm text-foreground">{tierCount}</dd>
                  </div>
                </dl>

                <div className="mt-3">
                  {tierCount === 0 ? (
                    <div
                      role="img"
                      aria-label="No tiers yet"
                      className="flex h-2 items-center rounded-full bg-muted text-[10px] text-muted-foreground"
                    >
                      <span className="pl-2">No tiers yet</span>
                    </div>
                  ) : (
                    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
                      {Array.from({ length: tierCount }).map((_, i) => (
                        <span
                          key={i}
                          className="flex-1 bg-primary/60"
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function EmptyProducts() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
      <p className="font-heading text-lg">No products yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The popcorn machine is off.
      </p>
      <Link
        href="/lite/setup/admin/saas-product-setup"
        className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
      >
        New product
      </Link>
    </div>
  );
}
