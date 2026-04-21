/**
 * @egg first_client_won
 * @register admin-roommate
 * @reads
 *   - deals (stage='won') — count of all-time won deals
 *   - hidden_egg_fires (egg_id='first_client_won') — one-shot check
 * @does_not_read
 *   - any client-scoped data beyond deal stage
 * @cross_client_inference false
 * @evidence_fields [dealId, wonAt]
 */

import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { eq, and, desc } from "drizzle-orm";

export interface FirstClientWonResult {
  shouldFire: boolean;
  evidence: {
    dealId: string | null;
    wonAt: number | null;
  };
}

export async function evaluateFirstClientWon(
  userId: string,
  _nowMs: number = Date.now(),
): Promise<FirstClientWonResult> {
  const noFire: FirstClientWonResult = {
    shouldFire: false,
    evidence: { dealId: null, wonAt: null },
  };

  const alreadyFired = await db
    .select({ id: hidden_egg_fires.id })
    .from(hidden_egg_fires)
    .where(eq(hidden_egg_fires.egg_id, "first_client_won"))
    .limit(1);

  if (alreadyFired.length > 0) return noFire;

  const wonDeals = await db
    .select({
      id: deals.id,
      updated_at_ms: deals.updated_at_ms,
    })
    .from(deals)
    .where(eq(deals.stage, "won"))
    .orderBy(desc(deals.updated_at_ms))
    .limit(2);

  if (wonDeals.length !== 1) return noFire;

  return {
    shouldFire: true,
    evidence: {
      dealId: wonDeals[0].id,
      wonAt: wonDeals[0].updated_at_ms,
    },
  };
}
