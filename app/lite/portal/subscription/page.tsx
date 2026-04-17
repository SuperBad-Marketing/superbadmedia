/**
 * SB-11 — `/lite/portal/subscription`.
 *
 * Shared cancel surface for SaaS + retainer. SaaS spec §6 drives the
 * SaaS branches; retainer (Quote Builder §9.4) was not yet wired into
 * this path when SB-11 landed — retainer callers still reach their
 * existing surface (none yet). The branch switch below returns a stub
 * for non-SaaS deals; the retainer route-lift will replace it.
 *
 * Subscriber-gated via the NextAuth session (`role=client`). Kill
 * switch `saas_cancel_flow_enabled` controls the surface only.
 */
import { redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { killSwitches } from "@/lib/kill-switches";
import { loadSubscriberSummary } from "@/lib/saas-products/subscriber-summary";
import { listActiveSaasProducts } from "@/lib/saas-products/queries";
import {
  computeSaasExitMath,
  loadSaasExitMath,
  SaasExitMathError,
} from "@/lib/saas-products/cancel-math";
import { customerHasDefaultPaymentMethod } from "@/lib/stripe/payment-intents";
import { CANCEL_COPY } from "@/lib/portal/cancel-copy";
import { CancelClient } from "@/components/lite/portal/cancel/cancel-client";

export const dynamic = "force-dynamic";

function stringifyMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}

export default async function SubscriptionCancelPage() {
  if (!killSwitches.saas_cancel_flow_enabled) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-neutral-800">
        <h1 className="font-serif text-3xl text-neutral-900">Cancellation paused.</h1>
        <p className="mt-4 text-neutral-600">{CANCEL_COPY.killSwitchFallback}</p>
        <a
          href="/lite/portal"
          className="mt-8 inline-block rounded-full border border-neutral-300 px-5 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          {CANCEL_COPY.talkToUsLabel}
        </a>
      </main>
    );
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "client" || !session.user.email) {
    redirect("/lite/portal/recover");
  }
  const summary = await loadSubscriberSummary(session.user.email);
  if (!summary) {
    redirect("/lite/portal/recover");
  }
  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, summary.dealId))
    .get();
  if (!deal) redirect("/lite/portal/recover");

  // Retainer stub — this session ships SaaS only; retainer route-lift
  // is logged as PATCHES_OWED.
  if (!deal.saas_product_id) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-neutral-800">
        <h1 className="font-serif text-3xl text-neutral-900">Retainer changes.</h1>
        <p className="mt-4 text-neutral-600">
          Retainer subscriptions aren&apos;t wired into this surface yet. Reach out
          and we&apos;ll handle it directly.
        </p>
        <a
          href="/lite/portal"
          className="mt-8 inline-block rounded-full border border-neutral-300 px-5 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          {CANCEL_COPY.talkToUsLabel}
        </a>
      </main>
    );
  }

  // eslint-disable-next-line react-hooks/purity -- server component, runs once
  const nowMs = Date.now();
  const isPaused = deal.subscription_state === "paused";
  const preTerm =
    deal.committed_until_date_ms !== null &&
    deal.committed_until_date_ms > nowMs;

  // Math (pre-term only — post-term doesn't need it). Guarded.
  let math: Awaited<ReturnType<typeof loadSaasExitMath>> | null = null;
  if (preTerm) {
    try {
      math = await loadSaasExitMath(summary.dealId, { now_ms: nowMs });
    } catch (err) {
      if (!(err instanceof SaasExitMathError)) throw err;
      math = null;
    }
  }

  // Card-not-on-file: paid-exit disable. No customer id → treat as CNOF.
  const cardOnFile = deal.stripe_customer_id
    ? await customerHasDefaultPaymentMethod(deal.stripe_customer_id).catch(
        () => false,
      )
    : false;

  // Product-switch alternatives (skip if subscriber is on the only active product).
  const products = await listActiveSaasProducts();
  const alternativeProducts = products.filter(
    (p) => p.id !== deal.saas_product_id,
  );

  // Default tier per alternative product (smallest / top) — pick the
  // smallest as the safe soft-switch target.
  let alternativeProductTiers: Record<
    string,
    { id: string; name: string; monthly_cents: number }
  > = {};
  if (alternativeProducts.length > 0) {
    const altIds = alternativeProducts.map((p) => p.id);
    const tierRows = await db
      .select({
        id: saas_tiers.id,
        product_id: saas_tiers.product_id,
        name: saas_tiers.name,
        rank: saas_tiers.tier_rank,
        monthly: saas_tiers.monthly_price_cents_inc_gst,
      })
      .from(saas_tiers)
      .orderBy(asc(saas_tiers.tier_rank));
    alternativeProductTiers = Object.fromEntries(
      altIds
        .map((pid) => {
          const first = tierRows.find((t) => t.product_id === pid);
          if (!first) return null;
          return [
            pid,
            {
              id: first.id,
              name: first.name,
              monthly_cents: first.monthly,
            },
          ] as const;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    );
  }

  // Tier up/down lists for post-term branch.
  let higherTiers: Array<{ id: string; name: string; monthly_cents: number }> =
    [];
  let lowerTiers: Array<{ id: string; name: string; monthly_cents: number }> =
    [];
  if (deal.saas_tier_id && deal.saas_product_id) {
    const current = await db
      .select({ rank: saas_tiers.tier_rank })
      .from(saas_tiers)
      .where(eq(saas_tiers.id, deal.saas_tier_id))
      .get();
    if (current) {
      const siblings = await db
        .select({
          id: saas_tiers.id,
          name: saas_tiers.name,
          rank: saas_tiers.tier_rank,
          monthly: saas_tiers.monthly_price_cents_inc_gst,
        })
        .from(saas_tiers)
        .where(
          and(
            eq(saas_tiers.product_id, deal.saas_product_id),
            ne(saas_tiers.id, deal.saas_tier_id),
          ),
        )
        .orderBy(asc(saas_tiers.tier_rank));
      higherTiers = siblings
        .filter((s) => s.rank > current.rank)
        .map((s) => ({ id: s.id, name: s.name, monthly_cents: s.monthly }));
      lowerTiers = siblings
        .filter((s) => s.rank < current.rank)
        .map((s) => ({ id: s.id, name: s.name, monthly_cents: s.monthly }));
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-neutral-800">
      <CancelClient
        branch={isPaused ? "paused" : preTerm ? "pre_term" : "post_term"}
        dealId={summary.dealId}
        productName={summary.productName}
        tierName={summary.tierName ?? ""}
        committedUntilDateMs={deal.committed_until_date_ms}
        pauseUsedThisCommitment={Boolean(deal.pause_used_this_commitment)}
        math={
          math
            ? {
                remaining_months: math.remaining_months,
                remainder_cents: math.remainder_cents,
                buyout_cents: math.buyout_cents,
                remainder_label: stringifyMoney(math.remainder_cents),
                buyout_label: stringifyMoney(math.buyout_cents),
              }
            : null
        }
        cardOnFile={cardOnFile}
        alternativeProducts={alternativeProducts.map((p) => ({
          id: p.id,
          name: p.name,
          tier: alternativeProductTiers[p.id] ?? null,
        }))}
        higherTiers={higherTiers.map((t) => ({
          ...t,
          monthly_label: stringifyMoney(t.monthly_cents),
        }))}
        lowerTiers={lowerTiers.map((t) => ({
          ...t,
          monthly_label: stringifyMoney(t.monthly_cents),
        }))}
        copy={{ ...CANCEL_COPY }}
      />
    </main>
  );
}
