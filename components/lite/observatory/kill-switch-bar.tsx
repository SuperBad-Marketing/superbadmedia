"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { KillSwitchedJob } from "@/lib/observatory/queries/dashboard";
import { formatTimestamp } from "@/lib/format-timestamp";

export function KillSwitchBar({ jobs }: { jobs: KillSwitchedJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <section
      className="rounded-[var(--radius-generous)] p-4"
      style={{
        background: "rgba(178, 40, 72, 0.08)",
        border: "1px solid rgba(178, 40, 72, 0.2)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: "var(--color-error)" }}
        />
        <h2
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-error)" }}
        >
          Kill switches active
        </h2>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {jobs.map((j) => (
          <KillSwitchRow key={j.job} job={j} />
        ))}
      </div>
    </section>
  );
}

function KillSwitchRow({ job }: { job: KillSwitchedJob }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleResume() {
    setLoading(true);
    try {
      await fetch("/api/admin/observatory/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: job.job, action: "enable" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <span
          className="font-[family-name:var(--font-mono)] text-[13px]"
          style={{ color: "var(--color-neutral-900)" }}
        >
          {job.job}
        </span>
        <span
          className="ml-2 text-[11px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          paused until{" "}
          {formatTimestamp(job.disabled_until, undefined, {
            format: "datetime",
          })}
        </span>
      </div>
      <button
        onClick={handleResume}
        disabled={loading}
        className="shrink-0 rounded-[var(--radius-default)] px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors disabled:opacity-50"
        style={{
          letterSpacing: "1.5px",
          background: "var(--color-surface-2)",
          color: "var(--color-neutral-700)",
        }}
      >
        {loading ? "Resuming…" : "Resume"}
      </button>
    </div>
  );
}
