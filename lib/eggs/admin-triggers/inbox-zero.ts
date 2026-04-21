/**
 * @egg inbox_zero
 * @register admin-roommate
 * @reads
 *   - cockpit waiting items count (via getWaitingItems contract)
 *   - hidden_egg_fires (egg_id='inbox_zero', user_id) WHERE fired_at_ms >= now() - 30d
 * @does_not_read
 *   - any client-scoped data
 * @cross_client_inference false
 * @evidence_fields [clearedAt]
 */

import { db } from "@/lib/db";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { and, eq, gte, sql } from "drizzle-orm";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import settings from "@/lib/settings";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface InboxZeroResult {
  shouldFire: boolean;
  evidence: {
    clearedAt: number | null;
  };
}

export async function evaluateInboxZero(
  userId: string,
  nowMs: number = Date.now(),
): Promise<InboxZeroResult> {
  const noFire: InboxZeroResult = {
    shouldFire: false,
    evidence: { clearedAt: null },
  };

  const cooldownDays = await settings.get("surprise.per_egg_cooldown_days");
  const cooldownMs = cooldownDays * MS_PER_DAY;
  const recentFires = await db
    .select({ fired_at_ms: hidden_egg_fires.fired_at_ms })
    .from(hidden_egg_fires)
    .where(
      and(
        eq(hidden_egg_fires.egg_id, "inbox_zero"),
        eq(hidden_egg_fires.user_id, userId),
        gte(hidden_egg_fires.fired_at_ms, nowMs - cooldownMs),
      ),
    )
    .limit(1);

  if (recentFires.length > 0) return noFire;

  const pendingTasks = await db
    .select({ count: sql<number>`count(*)` })
    .from(scheduled_tasks)
    .where(eq(scheduled_tasks.status, "pending"));

  const pendingCount = pendingTasks[0]?.count ?? 1;
  if (pendingCount > 0) return noFire;

  return {
    shouldFire: true,
    evidence: { clearedAt: nowMs },
  };
}
