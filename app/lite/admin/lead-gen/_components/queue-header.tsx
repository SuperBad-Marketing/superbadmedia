import type { QueueHeaderData } from "@/lib/lead-gen/queries";
import type { TrackAutonomySummary } from "@/lib/lead-gen/queries/header";

interface QueueHeaderProps {
  data: QueueHeaderData;
}

const MODE_LABELS: Record<string, string> = {
  manual: "manual",
  probation: "probation",
  auto_send: "auto-send",
  circuit_broken: "circuit broken",
};

function formatTrackLine(t: TrackAutonomySummary): string {
  const mode = MODE_LABELS[t.mode] ?? t.mode;
  if (t.mode === "probation" && t.probationRemaining != null) {
    return `${mode} · ${t.probationThreshold - t.probationRemaining}/${t.probationThreshold} probation`;
  }
  if (t.mode === "manual") {
    return `${mode} · ${t.streak}/${t.graduationThreshold} toward graduation`;
  }
  return mode;
}

export function QueueHeader({ data }: QueueHeaderProps) {
  const { lastRun, warmup, tracks } = data;
  const saas = tracks.find((t) => t.track === "saas");
  const retainer = tracks.find((t) => t.track === "retainer");

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface-1 p-4 text-sm font-mono space-y-1">
      {lastRun ? (
        <p>
          Today&apos;s run: {lastRun.time} — found {lastRun.found} →
          qualified {lastRun.qualified} → drafted {lastRun.drafted} (warmup
          cap {lastRun.warmupCap}/day)
        </p>
      ) : (
        <p className="text-muted-foreground">No runs yet.</p>
      )}

      {saas && (
        <p>
          SaaS: {formatTrackLine(saas)}
        </p>
      )}

      {retainer && (
        <p>
          Retainer: {formatTrackLine(retainer)}
        </p>
      )}

      <p>
        Warmup:{" "}
        {warmup.isGraduated ? (
          <span>
            Graduated · {warmup.cap}/day · used {warmup.used}/{warmup.cap}{" "}
            today
          </span>
        ) : (
          <span>
            Week {warmup.currentWeek} · {warmup.cap}/day · used{" "}
            {warmup.used}/{warmup.cap} today
            {warmup.daysUntilNextRamp != null && (
              <>
                {" "}
                · {warmup.daysUntilNextRamp} day
                {warmup.daysUntilNextRamp === 1 ? "" : "s"} until next ramp
              </>
            )}
          </span>
        )}
      </p>
    </div>
  );
}
