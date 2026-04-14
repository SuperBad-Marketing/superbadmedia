import type { DealBillingCadence } from "@/lib/db/schema/deals";

/**
 * Average month length used for remaining-cycle arithmetic. Retainer
 * commitments are measured in whole months; using a calendar-aware
 * month count would be more precise but the 30-day approximation is
 * good enough for remainder computation and keeps the helper pure +
 * deterministic (no timezone surface area).
 */
export const AVG_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface RemainderInput {
  committed_until_date_ms: number;
  billing_cadence: DealBillingCadence;
  monthly_cents: number;
  /** Percentage (0–100) used to compute the buyout amount. Q21 pins this
   * to 50; the quote row carries it as a per-quote invariant so the
   * helper reads it explicitly rather than relying on a magic default. */
  buyout_percentage: number;
  /** Override for tests. Defaults to `Date.now()`. */
  now_ms?: number;
}

export interface RemainderResult {
  remaining_months: number;
  /** Charge for option 2 — pay remainder in full. */
  full_cents: number;
  /** Charge for option 3 — buyout at `buyout_percentage`. */
  buyout_cents: number;
}

/**
 * Pure arithmetic helper for the Q21 early-cancel flow.
 *
 * - `monthly` + `annual_monthly`: client still owes every remaining
 *   committed cycle — `full_cents = remaining_months × monthly_cents`.
 * - `annual_upfront`: already paid upfront for the committed term, so
 *   the remainder is zero regardless of how long is left on the clock.
 *   The Client Portal wave should skip the charge step entirely in
 *   that branch; this helper just reports zero so the UI can decide.
 *
 * Buyout rounds to the nearest cent. Negative remaining time clamps
 * to zero — if the commitment has already lapsed, there's nothing
 * left to buy out (and the caller shouldn't be on this flow at all).
 */
export function computeEarlyCancelRemainder(
  input: RemainderInput,
): RemainderResult {
  const now = input.now_ms ?? Date.now();
  const msRemaining = Math.max(0, input.committed_until_date_ms - now);
  const remaining_months = Math.ceil(msRemaining / AVG_MONTH_MS);

  if (input.billing_cadence === "annual_upfront") {
    return { remaining_months, full_cents: 0, buyout_cents: 0 };
  }

  const full_cents = remaining_months * input.monthly_cents;
  const buyout_cents = Math.round(
    (full_cents * input.buyout_percentage) / 100,
  );
  return { remaining_months, full_cents, buyout_cents };
}
