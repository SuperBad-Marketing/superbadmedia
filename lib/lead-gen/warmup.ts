/**
 * Warmup ramp enforcement — spec §10.1, §10.2, §12.I.
 *
 * `enforceWarmupCap()` is the ONLY function that reads or writes
 * `resend_warmup_state`. Week progression is computed from `started_at`,
 * not manually advanced.
 *
 * Ramp: Week 1 → 5/day, Week 2 → 10, Week 3 → 15, Week 4 → 20, Week 5+ → 30.
 * Cap is per calendar day in Melbourne timezone, resets at midnight Melbourne.
 *
 * Owner: LG-6. Consumer: daily search (step 1), sequence runner (LG-9),
 * send step (LG-8), warmup progress metrics panel (LG-7).
 */

import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { resendWarmupState } from "@/lib/db/schema/resend-warmup-state";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { SUPERBAD_SENDER } from "./sender";
import { and, gte, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";

// §10.1 — The ramp. Non-overrideable.
const WARMUP_RAMP: Record<number, number> = {
  1: 5,
  2: 10,
  3: 15,
  4: 20,
};
const GRADUATED_CAP = 30;
const WARMUP_WEEKS = 4;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export interface WarmupCapResult {
  cap: number;
  used: number;
  remaining: number;
  can_send: boolean;
  current_week: number;
  is_graduated: boolean;
  days_until_next_ramp: number | null;
  scheduled_sequence_touches_today: number;
}

/**
 * Compute the current warmup state. Handles:
 *   - Week progression from `started_at`
 *   - Midnight Melbourne reset of `sent_today`
 *   - Accurate `used` count from `outreach_sends` for the current Melbourne day
 *
 * §12.I: this is the ONLY function that reads `resend_warmup_state`.
 */
export async function enforceWarmupCap(
  dbInstance = defaultDb,
): Promise<WarmupCapResult> {
  const row = await dbInstance
    .select()
    .from(resendWarmupState)
    .where(eq(resendWarmupState.id, "default"))
    .get();

  if (!row) {
    return {
      cap: 0,
      used: 0,
      remaining: 0,
      can_send: false,
      current_week: 0,
      is_graduated: false,
      days_until_next_ramp: null,
      scheduled_sequence_touches_today: 0,
    };
  }

  const now = Date.now();
  const startedAtMs =
    row.started_at instanceof Date ? row.started_at.getTime() : Number(row.started_at);

  // Compute current week from started_at
  const elapsedMs = now - startedAtMs;
  const elapsedWeeks = Math.floor(elapsedMs / MS_PER_WEEK);
  const currentWeek = Math.min(elapsedWeeks + 1, WARMUP_WEEKS + 1);
  const isGraduated = currentWeek > WARMUP_WEEKS;

  // Compute daily cap from ramp
  const dailyCap = isGraduated ? GRADUATED_CAP : (WARMUP_RAMP[currentWeek] ?? 5);

  // Compute Melbourne midnight boundaries for "today"
  const { todayStartMs, todayEndMs } = getMelbourneDayBounds(now);

  // Count actual sends today from outreach_sends (authoritative)
  const sendsToday = await dbInstance
    .select({ count: sql<number>`count(*)` })
    .from(outreachSends)
    .where(
      and(
        gte(outreachSends.sent_at, new Date(todayStartMs)),
        lt(outreachSends.sent_at, new Date(todayEndMs)),
      ),
    )
    .get();

  const used = sendsToday?.count ?? 0;

  // Count scheduled sequence touches due today (LG-9 will populate;
  // until then this returns 0)
  const scheduledTouchesToday = await countScheduledSequenceTouchesToday(
    todayStartMs,
    todayEndMs,
    dbInstance,
  );

  // Update the warmup state row if week or daily cap changed
  if (row.current_week !== currentWeek || row.daily_cap !== dailyCap) {
    await dbInstance
      .update(resendWarmupState)
      .set({
        current_week: currentWeek,
        daily_cap: dailyCap,
        sent_today: used,
        sent_today_reset_at: new Date(todayStartMs),
      })
      .where(eq(resendWarmupState.id, "default"));
  }

  // Reset sent_today if the stored reset date is from a previous Melbourne day
  const resetAtMs =
    row.sent_today_reset_at instanceof Date
      ? row.sent_today_reset_at.getTime()
      : Number(row.sent_today_reset_at);

  if (resetAtMs < todayStartMs) {
    await dbInstance
      .update(resendWarmupState)
      .set({
        sent_today: used,
        sent_today_reset_at: new Date(todayStartMs),
      })
      .where(eq(resendWarmupState.id, "default"));
  }

  const remaining = Math.max(0, dailyCap - used - scheduledTouchesToday);

  // Days until next ramp
  let daysUntilNextRamp: number | null = null;
  if (!isGraduated) {
    const nextWeekStartMs = startedAtMs + currentWeek * MS_PER_WEEK;
    daysUntilNextRamp = Math.max(
      0,
      Math.ceil((nextWeekStartMs - now) / (24 * 60 * 60 * 1000)),
    );
  }

  return {
    cap: dailyCap,
    used,
    remaining,
    can_send: remaining > 0,
    current_week: currentWeek,
    is_graduated: isGraduated,
    days_until_next_ramp: daysUntilNextRamp,
    scheduled_sequence_touches_today: scheduledTouchesToday,
  };
}

/**
 * Record that one outbound send happened. Increments `sent_today`.
 * Called by the send path after `sendEmail()` succeeds.
 *
 * §12.I: this is the ONLY function that writes `resend_warmup_state.sent_today`.
 */
export async function recordWarmupSend(dbInstance = defaultDb): Promise<void> {
  await dbInstance
    .update(resendWarmupState)
    .set({
      sent_today: sql`${resendWarmupState.sent_today} + 1`,
    })
    .where(eq(resendWarmupState.id, "default"));
}

/**
 * Initialise the warmup state row. Called once when Lead Gen is first
 * enabled (setup wizard completion).
 *
 * Idempotent — does nothing if the row already exists.
 */
export async function initWarmupState(dbInstance = defaultDb): Promise<void> {
  const existing = await dbInstance
    .select({ id: resendWarmupState.id })
    .from(resendWarmupState)
    .where(eq(resendWarmupState.id, "default"))
    .get();

  if (existing) return;

  const now = new Date();
  const { todayStartMs } = getMelbourneDayBounds(now.getTime());

  await dbInstance.insert(resendWarmupState).values({
    id: "default",
    sender_local_part: SUPERBAD_SENDER.local_part,
    sender_domain: SUPERBAD_SENDER.domain,
    started_at: now,
    current_week: 1,
    daily_cap: WARMUP_RAMP[1]!,
    sent_today: 0,
    sent_today_reset_at: new Date(todayStartMs),
    manual_override: false,
  });
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Get the Melbourne-timezone midnight-to-midnight bounds for a given
 * UTC timestamp. DST-safe via Intl.DateTimeFormat.
 */
export function getMelbourneDayBounds(nowMs: number): {
  todayStartMs: number;
  todayEndMs: number;
} {
  const now = new Date(nowMs);
  const melbFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = melbFmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const melbYear = parseInt(get("year"), 10);
  const melbMonth = parseInt(get("month"), 10) - 1;
  const melbDay = parseInt(get("day"), 10);

  // Build "today 00:00 Melbourne" in UTC
  const midnightMelbUtc = new Date(
    Date.UTC(melbYear, melbMonth, melbDay, 0, 0, 0, 0),
  );

  // Get Melbourne offset at this moment
  const offsetHours = getMelbourneOffsetHours(midnightMelbUtc);

  // 00:00 Melbourne = 00:00 - offset in UTC
  const todayStartMs = midnightMelbUtc.getTime() - offsetHours * 60 * 60 * 1000;
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000;

  return { todayStartMs, todayEndMs };
}

function getMelbourneOffsetHours(date: Date): number {
  const offsetStr = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;

  const match = offsetStr?.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1], 10) : 11; // fallback AEDT
}

/**
 * Count sequence follow-up tasks scheduled for today. Returns 0 until
 * LG-9 wires the sequence scheduler — there are no sequence task types yet.
 */
async function countScheduledSequenceTouchesToday(
  todayStartMs: number,
  todayEndMs: number,
  dbInstance: typeof defaultDb,
): Promise<number> {
  // LG-9 will add a sequence follow-up task type. Until then, count
  // pending outreach-related scheduled tasks due today.
  // The only lead-gen task type currently is `lead_gen_daily_search`,
  // which is NOT a sequence touch. When LG-9 adds the sequence task
  // type, this query will naturally pick it up.
  const result = await dbInstance
    .select({ count: sql<number>`count(*)` })
    .from(scheduled_tasks)
    .where(
      and(
        sql`${scheduled_tasks.task_type} LIKE 'lead_gen_sequence_%'`,
        eq(scheduled_tasks.status, "pending"),
        gte(scheduled_tasks.run_at_ms, todayStartMs),
        lt(scheduled_tasks.run_at_ms, todayEndMs),
      ),
    )
    .get();

  return result?.count ?? 0;
}
