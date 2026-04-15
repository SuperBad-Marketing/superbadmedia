"use server";

/**
 * SB-8 — subscriber-initiated tier change Server Action.
 *
 * Called from the at-cap upgrade CTA on the onboarding dashboard.
 * Verifies the authed subscriber owns the deal, enforces upgrade-only
 * from this surface (downgrades live in the portal cancel/change flow
 * per spec §6.6), and delegates to `applyTierChange`.
 *
 * Subscribers cannot override the pre-flight block; returning the
 * `blocked: true` result is sufficient (the dashboard rarely hits this
 * path because the upgrade is always up — but the server primitive is
 * authoritative).
 */
import { auth } from "@/lib/auth/session";
import { loadSubscriberSummary } from "@/lib/saas-products/subscriber-summary";
import {
  applyTierChange,
  type ApplyTierChangeResult,
  TierChangeError,
} from "@/lib/saas-products/tier-change";

export interface TierChangeActionResult {
  ok: boolean;
  result?: ApplyTierChangeResult;
  error?: string;
}

export async function requestSubscriberUpgradeAction(
  newTierId: string,
): Promise<TierChangeActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "client" || !session.user.email) {
    return { ok: false, error: "unauthorised" };
  }
  const summary = await loadSubscriberSummary(session.user.email);
  if (!summary) return { ok: false, error: "no_subscription" };

  try {
    const result = await applyTierChange(summary.dealId, newTierId, {
      mode: "upgrade",
      actor: "subscriber",
    });
    return { ok: true, result };
  } catch (err) {
    if (err instanceof TierChangeError) {
      return { ok: false, error: err.code };
    }
    throw err;
  }
}
