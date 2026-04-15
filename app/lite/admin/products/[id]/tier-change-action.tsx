"use server";

/**
 * SB-8 — admin tier-change + product-switch Server Actions.
 *
 * Brief names this path (`tier-change-action.tsx`) as the admin surface.
 * v1 scope ships the Server Action primitives only — a per-deal admin
 * detail page doesn't exist yet, so there's nothing to wire them into
 * from the product detail view. The actions are safe to import from any
 * future admin UI (deal detail page, subscriber list) as-is.
 *
 * Distinguishing features vs the subscriber Server Action:
 *   - `actor: "admin"` on every call → activity log attribution.
 *   - `overrideBlock` accepted → admins can push a downgrade through
 *     even when the pre-flight says current usage > new-tier limit.
 *   - Supports both `upgrade` and `downgrade` modes (the subscriber
 *     surface is upgrade-only per spec §6.6).
 */
import { auth } from "@/lib/auth/session";
import {
  applyTierChange,
  applyProductSwitch,
  type ApplyTierChangeResult,
  type ProductSwitchAppliedResult,
  TierChangeError,
} from "@/lib/saas-products/tier-change";
import type { DealBillingCadence } from "@/lib/db/schema/deals";

export interface AdminTierChangeInput {
  dealId: string;
  newTierId: string;
  mode: "upgrade" | "downgrade";
  overrideBlock?: boolean;
}

export interface AdminActionResult<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

async function assertAdmin(): Promise<AdminActionResult<never> | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "unauthorised" };
  }
  return null;
}

export async function adminApplyTierChangeAction(
  input: AdminTierChangeInput,
): Promise<AdminActionResult<ApplyTierChangeResult>> {
  const denied = await assertAdmin();
  if (denied) return denied;

  try {
    const result = await applyTierChange(input.dealId, input.newTierId, {
      mode: input.mode,
      overrideBlock: input.overrideBlock === true,
      actor: "admin",
    });
    return { ok: true, result };
  } catch (err) {
    if (err instanceof TierChangeError) {
      return { ok: false, error: err.code };
    }
    throw err;
  }
}

export interface AdminProductSwitchInput {
  dealId: string;
  newProductId: string;
  newTierId: string;
  newBillingCadence?: DealBillingCadence;
}

export async function adminApplyProductSwitchAction(
  input: AdminProductSwitchInput,
): Promise<AdminActionResult<ProductSwitchAppliedResult>> {
  const denied = await assertAdmin();
  if (denied) return denied;

  try {
    const result = await applyProductSwitch(input.dealId, {
      newProductId: input.newProductId,
      newTierId: input.newTierId,
      newBillingCadence: input.newBillingCadence,
      actor: "admin",
    });
    return { ok: true, result };
  } catch (err) {
    if (err instanceof TierChangeError) {
      return { ok: false, error: err.code };
    }
    throw err;
  }
}
