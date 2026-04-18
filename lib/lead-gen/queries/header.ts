import "server-only";
import { db } from "@/lib/db";
import { leadRuns } from "@/lib/db/schema/lead-runs";
import { desc } from "drizzle-orm";
import { enforceWarmupCap } from "../warmup";
import { getAutonomyStates, type AutonomyStateView } from "../autonomy";

export interface TrackAutonomySummary {
  track: "saas" | "retainer";
  mode: string;
  streak: number;
  graduationThreshold: number;
  probationRemaining: number | null;
  probationThreshold: number;
}

export interface QueueHeaderData {
  lastRun: {
    time: string;
    found: number;
    qualified: number;
    drafted: number;
    warmupCap: number;
  } | null;
  warmup: {
    currentWeek: number;
    cap: number;
    used: number;
    daysUntilNextRamp: number | null;
    isGraduated: boolean;
  };
  tracks: TrackAutonomySummary[];
}

export async function getQueueHeaderData(): Promise<QueueHeaderData> {
  const [[lastRun], warmupState, autonomyStates] = await Promise.all([
    db
      .select()
      .from(leadRuns)
      .orderBy(desc(leadRuns.run_started_at))
      .limit(1),
    enforceWarmupCap(),
    getAutonomyStates(),
  ]);

  const toSummary = (s: AutonomyStateView): TrackAutonomySummary => ({
    track: s.track,
    mode: s.mode,
    streak: s.streak,
    graduationThreshold: s.graduationThreshold,
    probationRemaining: s.probationRemaining,
    probationThreshold: s.probationThreshold,
  });

  return {
    lastRun: lastRun
      ? {
          time: new Date(lastRun.run_started_at as unknown as number)
            .toLocaleTimeString("en-AU", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone: "Australia/Melbourne",
            }),
          found: lastRun.found_count,
          qualified: lastRun.qualified_count,
          drafted: lastRun.drafted_count,
          warmupCap: lastRun.effective_cap_at_run,
        }
      : null,
    warmup: {
      currentWeek: warmupState.current_week,
      cap: warmupState.cap,
      used: warmupState.used,
      daysUntilNextRamp: warmupState.days_until_next_ramp,
      isGraduated: warmupState.is_graduated,
    },
    tracks: autonomyStates.map(toSummary),
  };
}
