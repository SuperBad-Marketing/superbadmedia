/**
 * Pure view-model builder for `/get-started/pricing`.
 *
 * Takes the raw `PricingProduct[]` from `listActivePricingProducts()` and
 * produces the shape the page + clients consume. Extracting this into a
 * pure function keeps the route component thin and unit-testable without
 * a React Testing Library dep (G7: zero new npm packages; brief's
 * `.test.tsx` requirement re-homed to view-model tests per
 * `feedback_technical_decisions_claude_calls`).
 *
 * GST note: `monthly_price_cents_inc_gst` and `setup_fee_cents_inc_gst`
 * on `saas_tiers` are already GST-inclusive per the column name and
 * `feedback_felt_experience_wins`; no division or arithmetic here.
 *
 * Full Suite: if a product with `slug = FULL_SUITE_COPY.slug` exists in
 * the active set, it's pulled out of the per-product grid and surfaced
 * separately. Savings computation sums the *largest* tier's
 * `monthly_price_cents_inc_gst` across every other product and diffs
 * against the Full Suite's largest tier. If only Full Suite exists, the
 * savings line falls back.
 *
 * Owner: SB-3.
 */
import {
  FULL_SUITE_COPY,
  type TIER_RANK_FRAMING as TierRankFramingType,
} from "@/lib/content/pricing-page";
import type { PricingProduct, PricingTier } from "./queries";

/** Values of the `TIER_RANK_FRAMING` lookup, typed for the view model. */
export type TierFrame = (typeof TierRankFramingType)[1 | 2 | 3] | null;

export type TierCellViewModel = {
  tierId: string;
  name: string;
  tierRank: number;
  monthlyPriceCents: number;
  setupFeeCents: number;
  limitEntries: Array<{
    dimensionKey: string;
    displayName: string;
    /** `null` means unlimited per `project_tier_limits_protect_margin`. */
    limitValue: number | null;
    /** `true` if the (tier, dimension) row is entirely absent — defensive. */
    missing: boolean;
  }>;
  featureFlags: string[];
  /** `true` once the tier has a `stripe_monthly_price_id` populated. */
  available: boolean;
  checkoutHref: string;
};

export type ProductColumnViewModel = {
  productId: string;
  name: string;
  slug: string;
  description: string | null;
  tiers: TierCellViewModel[];
};

export type FullSuiteSavings =
  | { kind: "computed"; individualSumPerMonthCents: number; monthlySavingsCents: number }
  | { kind: "fallback" };

export type FullSuiteViewModel = {
  productId: string;
  name: string;
  description: string | null;
  tiers: TierCellViewModel[];
  savings: FullSuiteSavings;
};

export type PricingPageViewModel = {
  products: ProductColumnViewModel[];
  fullSuite: FullSuiteViewModel | null;
  isEmpty: boolean;
};

function enabledFlagKeys(flags: Record<string, boolean>): string[] {
  return Object.entries(flags)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
}

function buildTierCell(
  productSlug: string,
  tier: PricingTier,
  dimensionList: Array<{ id: string; dimension_key: string; display_name: string }>,
): TierCellViewModel {
  const limitEntries = dimensionList.map((d) => {
    const row = tier.limitsByDimensionId.get(d.id);
    return {
      dimensionKey: d.dimension_key,
      displayName: d.display_name,
      limitValue: row ? row.limit_value : null,
      missing: !row,
    };
  });

  return {
    tierId: tier.row.id,
    name: tier.row.name,
    tierRank: tier.row.tier_rank,
    monthlyPriceCents: tier.row.monthly_price_cents_inc_gst,
    setupFeeCents: tier.row.setup_fee_cents_inc_gst,
    limitEntries,
    featureFlags: enabledFlagKeys(tier.featureFlags),
    available: Boolean(tier.row.stripe_monthly_price_id),
    // SB-5 owns `/get-started/checkout`; we stub the href here and the
    // route resolves later. Spec §3.3 defines the checkout surface.
    checkoutHref: `/get-started/checkout?tier=${encodeURIComponent(tier.row.id)}&product=${encodeURIComponent(productSlug)}`,
  };
}

function topTierPriceCents(tiers: TierCellViewModel[]): number {
  if (tiers.length === 0) return 0;
  // Highest rank wins; ties broken by price (defensive — publish flow
  // guarantees unique ranks per product).
  let top = tiers[0];
  for (const t of tiers) {
    if (
      t.tierRank > top.tierRank ||
      (t.tierRank === top.tierRank &&
        t.monthlyPriceCents > top.monthlyPriceCents)
    ) {
      top = t;
    }
  }
  return top.monthlyPriceCents;
}

export function buildPricingPageViewModel(
  raw: PricingProduct[],
): PricingPageViewModel {
  if (raw.length === 0) {
    return { products: [], fullSuite: null, isEmpty: true };
  }

  const productColumns: ProductColumnViewModel[] = [];
  let fullSuiteRaw: PricingProduct | null = null;

  for (const p of raw) {
    if (p.row.slug === FULL_SUITE_COPY.slug) {
      fullSuiteRaw = p;
      continue;
    }
    productColumns.push({
      productId: p.row.id,
      name: p.row.name,
      slug: p.row.slug,
      description: p.row.description,
      tiers: p.tiers.map((t) => buildTierCell(p.row.slug, t, p.dimensions)),
    });
  }

  let fullSuite: FullSuiteViewModel | null = null;
  if (fullSuiteRaw) {
    const fsTiers = fullSuiteRaw.tiers.map((t) =>
      buildTierCell(fullSuiteRaw!.row.slug, t, fullSuiteRaw!.dimensions),
    );

    let savings: FullSuiteSavings;
    if (productColumns.length === 0) {
      savings = { kind: "fallback" };
    } else {
      const individualSum = productColumns.reduce(
        (sum, col) => sum + topTierPriceCents(col.tiers),
        0,
      );
      const fsTop = topTierPriceCents(fsTiers);
      const diff = individualSum - fsTop;
      if (diff > 0 && individualSum > 0) {
        savings = {
          kind: "computed",
          individualSumPerMonthCents: individualSum,
          monthlySavingsCents: diff,
        };
      } else {
        savings = { kind: "fallback" };
      }
    }

    fullSuite = {
      productId: fullSuiteRaw.row.id,
      name: fullSuiteRaw.row.name,
      description: fullSuiteRaw.row.description,
      tiers: fsTiers,
      savings,
    };
  }

  return {
    products: productColumns,
    fullSuite,
    isEmpty: productColumns.length === 0 && fullSuite === null,
  };
}

/** Cents → `"49"` / `"1,299"` / `"2,499.50"` — GST-inclusive input assumed. */
export function formatCentsAud(cents: number): string {
  const dollars = cents / 100;
  const hasFraction = cents % 100 !== 0;
  return dollars.toLocaleString("en-AU", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Rank → framing label; returns null on any rank outside 1–3. */
export function tierFrame(
  rank: number,
  framing: typeof TierRankFramingType,
): TierFrame {
  if (rank === 1) return framing[1];
  if (rank === 2) return framing[2];
  if (rank === 3) return framing[3];
  return null;
}

/**
 * Turn a snake_case feature-flag key into a readable bullet line.
 * `dark_mode_exports` → `Dark mode exports`. Keeps capital-S "SuperBad"
 * and other anointed token casing intact via a small preserve-list.
 */
const PRESERVE_CASING = new Set(["api", "ai", "llm", "gst", "roi", "pdf", "csv"]);

export function humaniseFlagKey(key: string): string {
  const parts = key.split(/[_-\s]+/).filter(Boolean);
  if (parts.length === 0) return key;
  return parts
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (PRESERVE_CASING.has(lower)) return lower.toUpperCase();
      if (i === 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(" ");
}
