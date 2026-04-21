import settings from "@/lib/settings";
import { REGISTERED_JOB_KEYS, getJobEntry, getEffectiveBands, type Vendor } from "../job-registry";

export interface ObservatorySettings {
  threshold_1_aud: number | null;
  threshold_2_aud: number | null;
  threshold_3_aud: number | null;
  projection_alert_enabled: boolean;
  weekly_digest_enabled: boolean;
}

export interface JobBandRow {
  job: string;
  vendor: Vendor;
  description: string;
  per_call_ceiling_aud: number;
  daily_ceiling_aud: number;
  learned_band_multiplier: number;
  is_disabled: boolean;
}

export async function getObservatorySettings(): Promise<ObservatorySettings> {
  const [t1, t2, t3, projEnabled, digestEnabled] = await Promise.all([
    settings.get("observatory.monthly_threshold_1_aud"),
    settings.get("observatory.monthly_threshold_2_aud"),
    settings.get("observatory.monthly_threshold_3_aud"),
    settings.get("observatory.projection_alert_enabled"),
    settings.get("observatory.weekly_digest_enabled"),
  ]);

  return {
    threshold_1_aud: t1 != null ? Number(t1) : null,
    threshold_2_aud: t2 != null ? Number(t2) : null,
    threshold_3_aud: t3 != null ? Number(t3) : null,
    projection_alert_enabled: projEnabled !== false,
    weekly_digest_enabled: digestEnabled !== false,
  };
}

export async function getJobBandList(): Promise<JobBandRow[]> {
  const now = Date.now();
  const results: JobBandRow[] = [];

  for (const key of REGISTERED_JOB_KEYS) {
    const entry = getJobEntry(key);
    if (!entry) continue;
    const bands = await getEffectiveBands(key);
    results.push({
      job: key,
      vendor: entry.vendor,
      description: entry.description ?? key,
      per_call_ceiling_aud: bands?.per_call_ceiling_aud ?? 0,
      daily_ceiling_aud: bands?.daily_ceiling_aud ?? 0,
      learned_band_multiplier: bands?.learned_band_multiplier ?? 2,
      is_disabled: entry.jobDisabledUntil != null && entry.jobDisabledUntil > now,
    });
  }

  return results;
}
