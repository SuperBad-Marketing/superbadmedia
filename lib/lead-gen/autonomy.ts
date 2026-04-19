import { db as defaultDb } from "@/lib/db";
import {
  autonomyState,
  type AutonomyMode,
  type AutonomyStateRow,
} from "@/lib/db/schema/autonomy-state";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { eq, and, desc, sql } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";

type Track = "saas" | "retainer";

export type AutonomyEvent =
  | { type: "clean_approval" }
  | { type: "minor_edit_approval" }
  | { type: "non_clean_approval" }
  | { type: "rejection" }
  | { type: "hard_bounce"; sendId: string }
  | { type: "spam_complaint"; sendId: string }
  | { type: "fast_unsubscribe"; sendId: string }
  | { type: "drift_flag_on_auto_send"; draftId: string }
  | { type: "probation_send_completed" }
  | { type: "auto_send_completed" };

export interface AutonomyTransitionResult {
  previousMode: AutonomyMode;
  newMode: AutonomyMode;
  streak: number;
  transitioned: boolean;
  reason?: string;
}

const AUTO_SEND_DELAY_MS = 15 * 60 * 1000;

export { AUTO_SEND_DELAY_MS };

export async function getAutonomyRow(
  track: Track,
  dbInstance = defaultDb,
): Promise<AutonomyStateRow> {
  const [row] = await dbInstance
    .select()
    .from(autonomyState)
    .where(eq(autonomyState.track, track))
    .limit(1);

  if (row) return row;

  await dbInstance.insert(autonomyState).values({ track }).onConflictDoNothing();
  const [fresh] = await dbInstance
    .select()
    .from(autonomyState)
    .where(eq(autonomyState.track, track))
    .limit(1);
  return fresh!;
}

export async function transitionAutonomyState(
  track: Track,
  event: AutonomyEvent,
  dbInstance = defaultDb,
): Promise<AutonomyTransitionResult> {
  const row = await getAutonomyRow(track, dbInstance);
  const previousMode = row.mode as AutonomyMode;

  switch (event.type) {
    case "clean_approval":
    case "minor_edit_approval":
      return handleCleanApproval(track, row, dbInstance);
    case "non_clean_approval":
      return handleNonCleanApproval(track, row, dbInstance);
    case "rejection":
      return handleRejection(track, row, dbInstance);
    case "hard_bounce":
    case "spam_complaint":
    case "fast_unsubscribe":
    case "drift_flag_on_auto_send":
      return handleCircuitBreaker(track, row, event, dbInstance);
    case "probation_send_completed":
      return handleProbationSendCompleted(track, row, dbInstance);
    case "auto_send_completed":
      return handleAutoSendCompleted(track, row, dbInstance);
    default:
      return { previousMode, newMode: previousMode, streak: row.clean_approval_streak, transitioned: false };
  }
}

async function handleCleanApproval(
  track: Track,
  row: AutonomyStateRow,
  dbInstance: typeof defaultDb,
): Promise<AutonomyTransitionResult> {
  const previousMode = row.mode as AutonomyMode;
  const newStreak = row.clean_approval_streak + 1;

  if (previousMode === "manual" && newStreak >= row.graduation_threshold) {
    const now = Date.now();
    await dbInstance
      .update(autonomyState)
      .set({
        mode: "probation",
        clean_approval_streak: newStreak,
        probation_sends_remaining: row.probation_threshold,
        last_graduated_at: new Date(now),
      })
      .where(eq(autonomyState.track, track));

    await logActivity({
      kind: "autonomy_graduated",
      body: `${track} track entered probation after ${newStreak} clean approvals`,
      meta: { track, from: "manual", to: "probation", streak: newStreak },
    });

    return { previousMode, newMode: "probation", streak: newStreak, transitioned: true, reason: `Streak ${newStreak} hit graduation threshold ${row.graduation_threshold}` };
  }

  await dbInstance
    .update(autonomyState)
    .set({ clean_approval_streak: newStreak })
    .where(eq(autonomyState.track, track));

  return { previousMode, newMode: previousMode, streak: newStreak, transitioned: false };
}

async function handleNonCleanApproval(
  track: Track,
  row: AutonomyStateRow,
  dbInstance: typeof defaultDb,
): Promise<AutonomyTransitionResult> {
  const previousMode = row.mode as AutonomyMode;

  if (previousMode === "manual") {
    if (row.clean_approval_streak > 0) {
      await dbInstance
        .update(autonomyState)
        .set({ clean_approval_streak: 0 })
        .where(eq(autonomyState.track, track));
    }
    return { previousMode, newMode: "manual", streak: 0, transitioned: false, reason: "Non-clean approval reset streak" };
  }

  if (previousMode === "probation" || previousMode === "auto_send") {
    await dbInstance
      .update(autonomyState)
      .set({
        mode: "manual",
        clean_approval_streak: 0,
        probation_sends_remaining: null,
        last_demoted_at: new Date(),
      })
      .where(eq(autonomyState.track, track));

    await logActivity({
      kind: "autonomy_demoted",
      body: `${track} track demoted from ${previousMode} to manual — non-clean approval`,
      meta: { track, from: previousMode, to: "manual", reason: "non_clean_approval" },
    });

    return { previousMode, newMode: "manual", streak: 0, transitioned: true, reason: "Non-clean approval during autonomy" };
  }

  return { previousMode, newMode: previousMode, streak: row.clean_approval_streak, transitioned: false };
}

async function handleRejection(
  track: Track,
  row: AutonomyStateRow,
  dbInstance: typeof defaultDb,
): Promise<AutonomyTransitionResult> {
  const previousMode = row.mode as AutonomyMode;

  const updates: Partial<typeof autonomyState.$inferInsert> = {
    clean_approval_streak: 0,
  };

  if (previousMode === "probation" || previousMode === "auto_send") {
    updates.mode = "manual";
    updates.probation_sends_remaining = null;
    updates.last_demoted_at = new Date();

    await logActivity({
      kind: "autonomy_demoted",
      body: `${track} track demoted from ${previousMode} to manual — rejection`,
      meta: { track, from: previousMode, to: "manual", reason: "rejection" },
    });
  }

  await dbInstance
    .update(autonomyState)
    .set(updates)
    .where(eq(autonomyState.track, track));

  const newMode = updates.mode ?? previousMode;
  return { previousMode, newMode: newMode as AutonomyMode, streak: 0, transitioned: newMode !== previousMode, reason: "Rejection" };
}

async function handleCircuitBreaker(
  track: Track,
  row: AutonomyStateRow,
  event: AutonomyEvent & { type: "hard_bounce" | "spam_complaint" | "fast_unsubscribe" | "drift_flag_on_auto_send" },
  dbInstance: typeof defaultDb,
): Promise<AutonomyTransitionResult> {
  const previousMode = row.mode as AutonomyMode;
  const now = Date.now();

  const reasonMap: Record<string, string> = {
    hard_bounce: "Hard bounce on auto-send",
    spam_complaint: "Spam complaint",
    fast_unsubscribe: "Unsubscribe within 60 seconds of send",
    drift_flag_on_auto_send: "Drift flag on auto-send draft",
  };

  await dbInstance
    .update(autonomyState)
    .set({
      mode: "manual",
      clean_approval_streak: 0,
      probation_sends_remaining: null,
      circuit_broken_at: new Date(now),
      circuit_broken_reason: event.type,
      last_demoted_at: new Date(now),
    })
    .where(eq(autonomyState.track, track));

  await logActivity({
    kind: "autonomy_circuit_broken",
    body: `${track} track circuit broken: ${reasonMap[event.type]}`,
    meta: {
      track,
      from: previousMode,
      to: "manual",
      reason: event.type,
      ...("sendId" in event ? { send_id: event.sendId } : {}),
      ...("draftId" in event ? { draft_id: event.draftId } : {}),
    },
  });

  return {
    previousMode,
    newMode: "manual",
    streak: 0,
    transitioned: true,
    reason: reasonMap[event.type],
  };
}

async function handleProbationSendCompleted(
  track: Track,
  row: AutonomyStateRow,
  dbInstance: typeof defaultDb,
): Promise<AutonomyTransitionResult> {
  const previousMode = row.mode as AutonomyMode;
  if (previousMode !== "probation") {
    return { previousMode, newMode: previousMode, streak: row.clean_approval_streak, transitioned: false };
  }

  const remaining = (row.probation_sends_remaining ?? 1) - 1;

  if (remaining <= 0) {
    await dbInstance
      .update(autonomyState)
      .set({
        mode: "auto_send",
        probation_sends_remaining: 0,
        last_graduated_at: new Date(),
      })
      .where(eq(autonomyState.track, track));

    await logActivity({
      kind: "autonomy_graduated",
      body: `${track} track graduated from probation to auto_send`,
      meta: { track, from: "probation", to: "auto_send" },
    });

    return { previousMode, newMode: "auto_send", streak: row.clean_approval_streak, transitioned: true, reason: "Probation complete" };
  }

  await dbInstance
    .update(autonomyState)
    .set({ probation_sends_remaining: remaining })
    .where(eq(autonomyState.track, track));

  return { previousMode, newMode: "probation", streak: row.clean_approval_streak, transitioned: false, reason: `${remaining} probation sends remaining` };
}

async function handleAutoSendCompleted(
  track: Track,
  row: AutonomyStateRow,
  dbInstance: typeof defaultDb,
): Promise<AutonomyTransitionResult> {
  const previousMode = row.mode as AutonomyMode;
  if (previousMode !== "auto_send") {
    return { previousMode, newMode: previousMode, streak: row.clean_approval_streak, transitioned: false };
  }

  const maintenanceOk = await checkMaintenanceFloor(track, row, dbInstance);

  if (!maintenanceOk) {
    await dbInstance
      .update(autonomyState)
      .set({
        mode: "manual",
        clean_approval_streak: 0,
        last_demoted_at: new Date(),
      })
      .where(eq(autonomyState.track, track));

    await logActivity({
      kind: "autonomy_demoted",
      body: `${track} track demoted from auto_send to manual — maintenance floor breached`,
      meta: { track, from: "auto_send", to: "manual", reason: "maintenance_floor" },
    });

    return { previousMode, newMode: "manual", streak: 0, transitioned: true, reason: "Maintenance floor breached" };
  }

  return { previousMode, newMode: "auto_send", streak: row.clean_approval_streak, transitioned: false };
}

async function checkMaintenanceFloor(
  track: Track,
  row: AutonomyStateRow,
  dbInstance: typeof defaultDb,
): Promise<boolean> {
  const windowSize = row.rolling_window_size;
  const floorPct = row.maintenance_floor_pct;

  const recentSends = await dbInstance
    .select({
      draftId: outreachSends.draft_id,
    })
    .from(outreachSends)
    .innerJoin(outreachDrafts, eq(outreachSends.draft_id, outreachDrafts.id))
    .innerJoin(leadCandidates, eq(outreachDrafts.candidate_id, leadCandidates.id))
    .where(eq(leadCandidates.qualified_track, track))
    .orderBy(desc(outreachSends.sent_at))
    .limit(windowSize);

  if (recentSends.length < windowSize) return true;

  const draftIds = recentSends.map((s) => s.draftId);

  const cleanCount = await dbInstance
    .select({ count: sql<number>`count(*)` })
    .from(outreachDrafts)
    .where(
      and(
        sql`${outreachDrafts.id} IN (${sql.join(draftIds.map((id) => sql`${id}`), sql`,`)})`,
        eq(outreachDrafts.approval_kind, "manual"),
      ),
    );

  const clean = Number(cleanCount[0]?.count ?? 0);
  const rate = (clean / windowSize) * 100;

  return rate >= floorPct;
}

export interface AutonomyStateView {
  track: Track;
  mode: AutonomyMode;
  streak: number;
  graduationThreshold: number;
  probationRemaining: number | null;
  probationThreshold: number;
  rollingWindowSize: number;
  maintenanceFloorPct: number;
  circuitBrokenAt: Date | null;
  circuitBrokenReason: string | null;
  lastGraduatedAt: Date | null;
  lastDemotedAt: Date | null;
}

export async function getAutonomyStates(
  dbInstance = defaultDb,
): Promise<AutonomyStateView[]> {
  const rows = await dbInstance
    .select()
    .from(autonomyState)
    .orderBy(autonomyState.track);

  return rows.map((r) => ({
    track: r.track as Track,
    mode: r.mode as AutonomyMode,
    streak: r.clean_approval_streak,
    graduationThreshold: r.graduation_threshold,
    probationRemaining: r.probation_sends_remaining,
    probationThreshold: r.probation_threshold,
    rollingWindowSize: r.rolling_window_size,
    maintenanceFloorPct: r.maintenance_floor_pct,
    circuitBrokenAt: r.circuit_broken_at,
    circuitBrokenReason: r.circuit_broken_reason,
    lastGraduatedAt: r.last_graduated_at,
    lastDemotedAt: r.last_demoted_at,
  }));
}
