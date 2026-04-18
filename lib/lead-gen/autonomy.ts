/**
 * Earned-autonomy state machine for the lead generation approval queue.
 * Single write path to autonomy_state per §12.F — transitionAutonomyState()
 * is the ONLY function that mutates this table.
 *
 * Owner: LG-10. Consumer: approveDraft / rejectDraft actions, sequence runner.
 */

import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { autonomyState } from "@/lib/db/schema/autonomy-state";
import type { AutonomyStateRow } from "@/lib/db/schema/autonomy-state";
import { activity_log } from "@/lib/db/schema/activity-log";
import { killSwitches } from "@/lib/kill-switches";

export type AutonomyEvent =
  | "clean_approve"
  | "non_clean_approve"
  | "reject"
  | "maintenance_demote";

type Track = "saas" | "retainer";

async function getOrCreate(
  track: Track,
  db: typeof defaultDb,
): Promise<AutonomyStateRow> {
  const rows = await db
    .select()
    .from(autonomyState)
    .where(eq(autonomyState.track, track))
    .limit(1);

  if (rows.length > 0) return rows[0];

  await db.insert(autonomyState).values({ track }).onConflictDoNothing();

  const created = await db
    .select()
    .from(autonomyState)
    .where(eq(autonomyState.track, track))
    .limit(1);

  return created[0];
}

export async function transitionAutonomyState(
  track: Track,
  event: AutonomyEvent,
  db = defaultDb,
): Promise<AutonomyStateRow> {
  if (!killSwitches.lead_gen_enabled) {
    throw new Error("lead_gen_enabled kill-switch is off");
  }

  const row = await getOrCreate(track, db);
  const now = new Date();

  const updates: Partial<AutonomyStateRow> = {};
  let activityKind: "autonomy_graduated" | "autonomy_demoted" | null = null;
  let activityBody = "";
  const activityMeta: Record<string, unknown> = {
    track,
    event,
    from_mode: row.mode,
  };

  switch (row.mode) {
    case "manual":
    case "circuit_broken": {
      if (event === "clean_approve") {
        const newStreak = row.clean_approval_streak + 1;
        if (newStreak >= row.graduation_threshold) {
          updates.mode = "probation";
          updates.clean_approval_streak = 0;
          updates.probation_sends_remaining = row.probation_threshold;
          updates.last_graduated_at = now;
          if (row.mode === "circuit_broken") {
            updates.circuit_broken_at = null;
            updates.circuit_broken_reason = null;
          }
          activityKind = "autonomy_graduated";
          activityBody = `${track} track graduated from ${row.mode} to probation after ${newStreak} clean approvals`;
          activityMeta.to_mode = "probation";
          activityMeta.streak = newStreak;
        } else {
          updates.clean_approval_streak = newStreak;
        }
      } else if (event === "non_clean_approve" || event === "reject") {
        if (row.clean_approval_streak > 0) {
          updates.clean_approval_streak = 0;
        }
      }
      break;
    }

    case "probation": {
      if (event === "clean_approve") {
        const remaining =
          (row.probation_sends_remaining ?? row.probation_threshold) - 1;
        if (remaining <= 0) {
          updates.mode = "auto_send";
          updates.probation_sends_remaining = null;
          updates.last_graduated_at = now;
          activityKind = "autonomy_graduated";
          activityBody = `${track} track graduated from probation to auto_send`;
          activityMeta.to_mode = "auto_send";
        } else {
          updates.probation_sends_remaining = remaining;
        }
      } else if (
        event === "non_clean_approve" ||
        event === "reject" ||
        event === "maintenance_demote"
      ) {
        updates.mode = "manual";
        updates.clean_approval_streak = 0;
        updates.probation_sends_remaining = null;
        updates.last_demoted_at = now;
        activityKind = "autonomy_demoted";
        activityBody = `${track} track demoted from probation to manual (${event})`;
        activityMeta.to_mode = "manual";
      }
      break;
    }

    case "auto_send": {
      if (event === "reject") {
        updates.mode = "circuit_broken";
        updates.clean_approval_streak = 0;
        updates.circuit_broken_at = now;
        updates.circuit_broken_reason = "manual_reject";
        updates.last_demoted_at = now;
        activityKind = "autonomy_demoted";
        activityBody = `${track} track circuit broken via manual reject`;
        activityMeta.to_mode = "circuit_broken";
        activityMeta.reason = "manual_reject";
      } else if (
        event === "non_clean_approve" ||
        event === "maintenance_demote"
      ) {
        updates.mode = "manual";
        updates.clean_approval_streak = 0;
        updates.last_demoted_at = now;
        activityKind = "autonomy_demoted";
        activityBody = `${track} track demoted from auto_send to manual (${event})`;
        activityMeta.to_mode = "manual";
      }
      break;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(autonomyState)
      .set(updates)
      .where(eq(autonomyState.track, track));
  }

  if (activityKind) {
    await db.insert(activity_log).values({
      id: crypto.randomUUID(),
      kind: activityKind,
      body: activityBody,
      meta: activityMeta,
      created_at_ms: Date.now(),
    });
  }

  const updated = await db
    .select()
    .from(autonomyState)
    .where(eq(autonomyState.track, track))
    .limit(1);

  return updated[0];
}
