"use client";

import type { VideoJobRow } from "@/lib/db/schema/video-jobs";

export function CreditDashboard({ jobs }: { jobs: VideoJobRow[] }) {
  const completedJobs = jobs.filter((j) => j.status === "ready");
  const totalCredits = completedJobs.reduce(
    (sum, j) => sum + (j.credits_used ?? 0),
    0,
  );
  const totalVideos = completedJobs.length;
  const avgGenTime =
    completedJobs.length > 0
      ? Math.round(
          completedJobs.reduce((sum, j) => sum + (j.generation_ms ?? 0), 0) /
            completedJobs.length /
            1000,
        )
      : 0;

  const byType = completedJobs.reduce(
    (acc, j) => {
      acc[j.video_type] = (acc[j.video_type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div
      className="rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] p-4"
    >
      <span
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        Usage
      </span>
      <div className="mt-3 grid grid-cols-3 gap-4">
        <Stat label="Credits used" value={totalCredits.toString()} />
        <Stat label="Videos" value={totalVideos.toString()} />
        <Stat label="Avg gen time" value={avgGenTime > 0 ? `${avgGenTime}s` : "—"} />
      </div>
      {Object.keys(byType).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, count]) => (
            <span
              key={type}
              className="rounded-md px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1px] text-[color:var(--color-neutral-400)]"
              style={{ backgroundColor: "rgba(253, 245, 230, 0.04)" }}
            >
              {type.replace("_", " ")} × {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-display)] text-[24px] leading-none text-[color:var(--color-brand-cream)]">
        {value}
      </div>
      <div className="mt-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
        {label}
      </div>
    </div>
  );
}
