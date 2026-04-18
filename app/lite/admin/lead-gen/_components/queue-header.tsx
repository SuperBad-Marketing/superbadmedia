import type { QueueHeaderData } from "@/lib/lead-gen/queries";

interface QueueHeaderProps {
  data: QueueHeaderData;
}

export function QueueHeader({ data }: QueueHeaderProps) {
  const { lastRun, warmup } = data;

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
