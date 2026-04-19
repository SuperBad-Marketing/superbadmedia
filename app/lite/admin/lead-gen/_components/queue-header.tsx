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
    <div
      className="mb-6 rounded-[12px] p-5 text-[13px] space-y-2"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid transparent",
      }}
    >
      {lastRun ? (
        <p className="text-[color:var(--color-neutral-300)]">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Today&apos;s run
          </span>{" "}
          <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
          {lastRun.time} — found{" "}
          <span className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "0.5px" }}>
            {lastRun.found}
          </span>{" "}
          → qualified{" "}
          <span className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "0.5px" }}>
            {lastRun.qualified}
          </span>{" "}
          → drafted{" "}
          <span className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "0.5px" }}>
            {lastRun.drafted}
          </span>{" "}
          <span className="text-[color:var(--color-neutral-500)]">
            (warmup cap {lastRun.warmupCap}/day)
          </span>
        </p>
      ) : (
        <p className="font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
          no runs yet.
        </p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[color:var(--color-neutral-300)]">
        {saas && (
          <p>
            <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.5px" }}>
              SaaS
            </span>{" "}
            <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
            {formatTrackLine(saas)}
          </p>
        )}

        {retainer && (
          <p>
            <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.5px" }}>
              Retainer
            </span>{" "}
            <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
            {formatTrackLine(retainer)}
          </p>
        )}
      </div>

      <p className="text-[color:var(--color-neutral-300)]">
        <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.5px" }}>
          Warmup
        </span>{" "}
        <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
        {warmup.isGraduated ? (
          <span>
            Graduated{" "}
            <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
            <span className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "0.5px" }}>
              {warmup.cap}
            </span>
            /day{" "}
            <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
            used {warmup.used}/{warmup.cap} today
          </span>
        ) : (
          <span>
            Week {warmup.currentWeek}{" "}
            <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
            <span className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "0.5px" }}>
              {warmup.cap}
            </span>
            /day{" "}
            <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
            used {warmup.used}/{warmup.cap} today
            {warmup.daysUntilNextRamp != null && (
              <>
                {" "}
                <span className="text-[color:var(--color-neutral-500)]">·</span>{" "}
                <span className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "0.5px" }}>
                  {warmup.daysUntilNextRamp}
                </span>{" "}
                day{warmup.daysUntilNextRamp === 1 ? "" : "s"} until next ramp
              </>
            )}
          </span>
        )}
      </p>
    </div>
  );
}
