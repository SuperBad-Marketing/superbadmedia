/**
 * Kill-switch toggle for observatory jobs. Disables a job (sets
 * `jobDisabledUntil` on the registry entry) or re-enables it.
 *
 * The job registry's `jobDisabledUntil` field is checked by every
 * external-call wrapper before invoking the vendor SDK — a disabled
 * job returns a typed error to the caller.
 *
 * Spec: `docs/specs/cost-usage-observatory.md` §3.3.
 * Owner: COB-9 (Wave 21).
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { logActivity } from "@/lib/activity-log";
import { JOB_REGISTRY, isJobRegistered } from "./job-registry";

export interface ToggleKillSwitchInput {
  job: string;
  action: "disable" | "enable";
  anomalyId?: string;
}

export interface ToggleKillSwitchResult {
  success: boolean;
  job: string;
  action: "disable" | "enable";
  disabledUntil: number | null;
}

export async function toggleJobKillSwitch(
  input: ToggleKillSwitchInput,
): Promise<ToggleKillSwitchResult> {
  const { job, action, anomalyId } = input;

  if (!isJobRegistered(job)) {
    throw new Error(`Unknown job: ${job}`);
  }

  const entry = JOB_REGISTRY[job]!;
  const now = Date.now();

  if (action === "disable") {
    const disableUntil = now + 365 * 24 * 60 * 60 * 1000;
    entry.jobDisabledUntil = disableUntil;

    if (anomalyId) {
      await db
        .update(cost_anomalies)
        .set({ kill_switch_triggered_at_ms: now })
        .where(eq(cost_anomalies.id, anomalyId));
    }

    await logActivity({
      kind: "kill_switch_triggered",
      body: `Kill switch triggered for ${job}`,
      meta: { job, anomaly_id: anomalyId ?? null, disabled_until: disableUntil },
    });

    return { success: true, job, action, disabledUntil: disableUntil };
  }

  // enable
  const previousDisabledUntil = entry.jobDisabledUntil;
  entry.jobDisabledUntil = null;

  await logActivity({
    kind: "kill_switch_released",
    body: `Kill switch released for ${job}`,
    meta: { job, previous_disabled_until: previousDisabledUntil },
  });

  return { success: true, job, action, disabledUntil: null };
}
