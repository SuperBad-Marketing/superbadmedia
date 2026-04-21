/**
 * @egg weekend_warrior
 * @register admin-roommate
 * @reads
 *   - activity_log (kind='admin_session_started', created_at_ms) WHERE today is Sat/Sun Melbourne
 *   - hidden_egg_fires (egg_id='weekend_warrior', user_id) WHERE fired_at_ms >= now() - 30d
 * @does_not_read
 *   - any client-scoped data
 * @cross_client_inference false
 * @evidence_fields [dayOfWeek, sessionCount, earliestMs]
 */

import { db } from "@/lib/db";
import { activity_log } from "@/lib/db/schema/activity-log";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { and, eq, gte } from "drizzle-orm";
import { getMelbourneDateISO } from "../melbourne-holidays";

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_SESSIONS = 3; // proxy for ~2h of activity (session pings)

function getMelbourneDayOfWeek(nowMs: number): number {
  const dateStr = new Date(nowMs).toLocaleDateString("en-US", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[dateStr] ?? -1;
}

export interface WeekendWarriorResult {
  shouldFire: boolean;
  evidence: {
    dayOfWeek: number;
    sessionCount: number;
    earliestMs: number | null;
  };
}

export async function evaluateWeekendWarrior(
  userId: string,
  nowMs: number = Date.now(),
): Promise<WeekendWarriorResult> {
  const noFire: WeekendWarriorResult = {
    shouldFire: false,
    evidence: { dayOfWeek: -1, sessionCount: 0, earliestMs: null },
  };

  const dow = getMelbourneDayOfWeek(nowMs);
  if (dow !== 0 && dow !== 6) return noFire;

  const recentFires = await db
    .select({ fired_at_ms: hidden_egg_fires.fired_at_ms })
    .from(hidden_egg_fires)
    .where(
      and(
        eq(hidden_egg_fires.egg_id, "weekend_warrior"),
        eq(hidden_egg_fires.user_id, userId),
        gte(hidden_egg_fires.fired_at_ms, nowMs - COOLDOWN_MS),
      ),
    )
    .limit(1);

  if (recentFires.length > 0) return noFire;

  const todayISO = getMelbourneDateISO(nowMs);
  const dayStartMs = new Date(`${todayISO}T00:00:00+10:00`).getTime();

  const sessions = await db
    .select({ created_at_ms: activity_log.created_at_ms })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.kind, "admin_session_started"),
        gte(activity_log.created_at_ms, dayStartMs),
      ),
    );

  if (sessions.length < MIN_SESSIONS) return noFire;

  const earliest = Math.min(...sessions.map((s) => s.created_at_ms));

  return {
    shouldFire: true,
    evidence: {
      dayOfWeek: dow,
      sessionCount: sessions.length,
      earliestMs: earliest,
    },
  };
}
