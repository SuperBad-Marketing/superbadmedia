import { db } from "@/lib/db";
import { band_overrides } from "@/lib/db/schema/band-overrides";
import { logActivity } from "@/lib/activity-log";
import { getJobEntry, getEffectiveBands, type JobBands } from "./job-registry";

export interface AdjustBandsInput {
  job: string;
  per_call_ceiling_aud?: number | null;
  daily_ceiling_aud?: number | null;
  learned_band_multiplier?: number | null;
}

export interface AdjustBandsResult {
  previous: JobBands;
  current: JobBands;
}

/**
 * Persist a band override for a job and log the change to `activity_log`.
 * Only provided fields are overridden; null fields revert to registry default.
 */
export async function adjustBands(
  input: AdjustBandsInput,
): Promise<AdjustBandsResult> {
  const entry = getJobEntry(input.job);
  if (!entry) {
    throw new Error(`[band-editor] unknown job: ${input.job}`);
  }

  const previous = (await getEffectiveBands(input.job))!;

  const nowMs = Date.now();

  await db
    .insert(band_overrides)
    .values({
      job: input.job,
      per_call_ceiling_aud: input.per_call_ceiling_aud ?? null,
      daily_ceiling_aud: input.daily_ceiling_aud ?? null,
      learned_band_multiplier: input.learned_band_multiplier ?? null,
      updated_at_ms: nowMs,
    })
    .onConflictDoUpdate({
      target: band_overrides.job,
      set: {
        per_call_ceiling_aud: input.per_call_ceiling_aud ?? null,
        daily_ceiling_aud: input.daily_ceiling_aud ?? null,
        learned_band_multiplier: input.learned_band_multiplier ?? null,
        updated_at_ms: nowMs,
      },
    });

  const current = (await getEffectiveBands(input.job))!;

  await logActivity({
    kind: "band_adjusted",
    body: `Band adjusted for ${input.job}`,
    meta: {
      job: input.job,
      previous: {
        per_call_ceiling_aud: previous.per_call_ceiling_aud,
        daily_ceiling_aud: previous.daily_ceiling_aud,
        learned_band_multiplier: previous.learned_band_multiplier,
      },
      current: {
        per_call_ceiling_aud: current.per_call_ceiling_aud,
        daily_ceiling_aud: current.daily_ceiling_aud,
        learned_band_multiplier: current.learned_band_multiplier,
      },
    },
    createdBy: "admin",
  });

  return { previous, current };
}
