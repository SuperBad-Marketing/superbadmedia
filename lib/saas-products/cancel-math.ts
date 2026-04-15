/**
 * SaaS cancel-flow arithmetic (SB-11).
 *
 * Spec: `docs/specs/saas-subscription-billing.md` §6.5.
 *
 * Pre-term SaaS exits charge one of two amounts:
 *   - **Pay remainder:** `monthly_cents × ceil((committed_until_date - now) / 30)`
 *   - **50% buyout:**    `floor(remainder_cents / 2)` — client-favourable
 *                         rounding (client pays less than a naïve half).
 *
 * SaaS pricing differs from retainer (Q21) in two ways: buyout is fixed
 * at 50% (spec §6.5) rather than per-quote, and rounding is `floor`
 * rather than `round` — so this module lives alongside the retainer
 * helper rather than wrapping it.
 *
 * Inputs are explicit (deal + tier columns resolved by the caller) to
 * keep the helper pure and trivially testable.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { AVG_MONTH_MS } from "@/lib/subscription/remainder";

export interface SaasExitMath {
  remaining_months: number;
  /** `monthly_cents × remaining_months`. Zero if the commitment has lapsed. */
  remainder_cents: number;
  /** `floor(remainder_cents / 2)`. Client-favourable for odd cents. */
  buyout_cents: number;
  /** The `committed_until_date_ms` the helper read from the deal. */
  committed_until_date_ms: number;
  /** The tier's monthly inc-GST price used for the calc. */
  monthly_cents: number;
}

export interface SaasExitMathInput {
  committed_until_date_ms: number;
  monthly_cents: number;
  now_ms?: number;
}

/**
 * Pure arithmetic — no DB touch. Exported for tests + the confirmation
 * screen copy ("You'll be charged $X,XXX").
 */
export function computeSaasExitMath(input: SaasExitMathInput): SaasExitMath {
  const now = input.now_ms ?? Date.now();
  const msRemaining = Math.max(0, input.committed_until_date_ms - now);
  const remaining_months = Math.ceil(msRemaining / AVG_MONTH_MS);
  const remainder_cents = remaining_months * input.monthly_cents;
  const buyout_cents = Math.floor(remainder_cents / 2);
  return {
    remaining_months,
    remainder_cents,
    buyout_cents,
    committed_until_date_ms: input.committed_until_date_ms,
    monthly_cents: input.monthly_cents,
  };
}

export class SaasExitMathError extends Error {
  code:
    | "deal_not_found"
    | "not_saas_deal"
    | "missing_commitment"
    | "missing_tier"
    | "missing_price";
  constructor(code: SaasExitMathError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * DB-backed lookup: loads a SaaS deal + its current tier's monthly
 * inc-GST price, then delegates to `computeSaasExitMath`. Throws if the
 * deal isn't a SaaS deal or is missing commitment/tier data.
 */
export async function loadSaasExitMath(
  dealId: string,
  opts: { now_ms?: number } = {},
): Promise<SaasExitMath> {
  const row = await db
    .select({
      id: deals.id,
      saas_product_id: deals.saas_product_id,
      saas_tier_id: deals.saas_tier_id,
      committed_until_date_ms: deals.committed_until_date_ms,
      monthly_cents: saas_tiers.monthly_price_cents_inc_gst,
    })
    .from(deals)
    .leftJoin(saas_tiers, eq(saas_tiers.id, deals.saas_tier_id))
    .where(eq(deals.id, dealId))
    .get();

  if (!row) throw new SaasExitMathError("deal_not_found", `deal ${dealId}`);
  if (!row.saas_product_id)
    throw new SaasExitMathError(
      "not_saas_deal",
      `deal ${dealId} is not a SaaS deal`,
    );
  if (row.committed_until_date_ms === null)
    throw new SaasExitMathError(
      "missing_commitment",
      `deal ${dealId} has no committed_until_date_ms`,
    );
  if (!row.saas_tier_id)
    throw new SaasExitMathError(
      "missing_tier",
      `deal ${dealId} has no saas_tier_id`,
    );
  if (row.monthly_cents === null)
    throw new SaasExitMathError(
      "missing_price",
      `tier ${row.saas_tier_id} has no monthly_price_cents_inc_gst`,
    );

  return computeSaasExitMath({
    committed_until_date_ms: row.committed_until_date_ms,
    monthly_cents: row.monthly_cents,
    now_ms: opts.now_ms,
  });
}
