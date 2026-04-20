/**
 * @egg crt_turn_off
 * @register admin-roommate
 * @reads
 *   - activity_log (kind='admin_session_started', created_at_ms) WHERE created_at_ms >= now() - 7d
 *   - hidden_egg_fires (egg_id='crt_turn_off', user_id) WHERE fired_at_ms >= now() - 30d
 * @does_not_read
 *   - any client-scoped data (brand_dna, context_summaries, messages, quotes, invoices)
 *   - any non-admin user data
 * @cross_client_inference false
 * @evidence_fields [lateNightDates, distinctDayCount]
 */

import { db } from "@/lib/db";
import { activity_log } from "@/lib/db/schema/activity-log";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { and, eq, gte, sql } from "drizzle-orm";
import { getMelbourneHour, getMelbourneDateISO } from "../melbourne-holidays";

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIRED_LATE_NIGHTS = 3;
const LATE_HOUR_START = 1; // 01:00 Melbourne (spec says after 01:30, we check >=01:30 via minute)
const LATE_HOUR_END = 5; // before 05:00 Melbourne

export interface CrtTurnOffResult {
  shouldFire: boolean;
  evidence: {
    lateNightDates: string[];
    distinctDayCount: number;
  };
}

export async function evaluateCrtTurnOff(
  userId: string,
  nowMs: number = Date.now(),
): Promise<CrtTurnOffResult> {
  const noFire: CrtTurnOffResult = {
    shouldFire: false,
    evidence: { lateNightDates: [], distinctDayCount: 0 },
  };

  const recentFires = await db
    .select({ fired_at_ms: hidden_egg_fires.fired_at_ms })
    .from(hidden_egg_fires)
    .where(
      and(
        eq(hidden_egg_fires.egg_id, "crt_turn_off"),
        eq(hidden_egg_fires.user_id, userId),
        gte(hidden_egg_fires.fired_at_ms, nowMs - COOLDOWN_MS),
      ),
    )
    .limit(1);

  if (recentFires.length > 0) return noFire;

  const cutoffMs = nowMs - LOOKBACK_MS;
  const sessions = await db
    .select({
      created_at_ms: activity_log.created_at_ms,
    })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.kind, "admin_session_started"),
        gte(activity_log.created_at_ms, cutoffMs),
      ),
    );

  const lateNightDates = new Set<string>();

  for (const session of sessions) {
    const hour = getMelbourneHour(session.created_at_ms);
    const minuteStr = new Date(session.created_at_ms).toLocaleString("en-AU", {
      timeZone: "Australia/Melbourne",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const [h, m] = minuteStr.split(":").map(Number);

    const isLate =
      (h === 1 && m >= 30) || (h >= 2 && h < LATE_HOUR_END);

    if (isLate) {
      const dateISO = getMelbourneDateISO(session.created_at_ms);
      lateNightDates.add(dateISO);
    }
  }

  const dates = Array.from(lateNightDates).sort();

  if (dates.length < REQUIRED_LATE_NIGHTS) return noFire;

  return {
    shouldFire: true,
    evidence: {
      lateNightDates: dates,
      distinctDayCount: dates.length,
    },
  };
}
