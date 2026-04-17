/**
 * Outreach warmup cap enforcement.
 *
 * Implements the 4-week non-overrideable ramp from spec §10.1:
 *   Days  1–7:  5 sends/day
 *   Days  8–14: 10 sends/day
 *   Days 15–21: 15 sends/day
 *   Days 22–28: 20 sends/day
 *   Day  29+:   30 sends/day
 *
 * Read-only — no DB writes. Owner: LG-6. Consumer: LG-4 orchestrator.
 */

import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { resendWarmupState } from "@/lib/db/schema/resend-warmup-state";

export interface WarmupCapResult {
  cap: number;
  used: number;
  remaining: number;
  can_send: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DAY_1_DEFAULT: WarmupCapResult = {
  cap: 5,
  used: 0,
  remaining: 5,
  can_send: true,
};

function capForDaysElapsed(daysElapsed: number): number {
  if (daysElapsed < 7) return 5;
  if (daysElapsed < 14) return 10;
  if (daysElapsed < 21) return 15;
  if (daysElapsed < 28) return 20;
  return 30;
}

export async function enforceWarmupCap(
  dbInstance = defaultDb,
): Promise<WarmupCapResult> {
  const rows = await dbInstance
    .select()
    .from(resendWarmupState)
    .where(eq(resendWarmupState.id, "default"))
    .limit(1);

  if (rows.length === 0) {
    return DAY_1_DEFAULT;
  }

  const row = rows[0];
  const daysElapsed = Math.floor(
    (Date.now() - row.started_at.getTime()) / MS_PER_DAY,
  );
  const cap = capForDaysElapsed(daysElapsed);
  const used = row.sent_today;
  const remaining = Math.max(0, cap - used);

  return {
    cap,
    used,
    remaining,
    can_send: remaining > 0,
  };
}
