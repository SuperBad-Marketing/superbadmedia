"use client";

import * as React from "react";
import type { CockpitBriefRow } from "@/lib/db/schema/cockpit-briefs";
import type { CockpitBriefSlot } from "@/lib/db/schema/cockpit-briefs";
import { regenerateBriefAction } from "@/app/lite/cockpit/actions";

const QUIET_FALLBACK_LINES = [
  "Nothing on fire. Rare day.",
  "All quiet. Go make something.",
  "Inbox zero. Rail empty. You know what to do.",
  "The business is breathing. You should too.",
  "No fires, no flags. Just a Tuesday.",
  "Quiet morning. Suspicious, but welcome.",
  "Nothing needs you right now. That's the goal.",
  "Lite has nothing to report. Enjoy it.",
  "Everything's ticking over. Go get a coffee.",
  "No dramas. That's the update.",
];

function pseudoRandomPick(pool: string[], seedMs: number, windowDays: number): string {
  const dayIndex = Math.floor(seedMs / (86400000 * windowDays));
  return pool[dayIndex % pool.length];
}

export function BriefPanel({
  brief,
  slot,
  fallback,
}: {
  brief: CockpitBriefRow | null;
  slot: CockpitBriefSlot;
  fallback: boolean;
}) {
  const nowMs = Date.now();
  const [refreshing, setRefreshing] = React.useState(false);
  const [localProse, setLocalProse] = React.useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await regenerateBriefAction();
      if (res.ok && !res.quiet && "prose" in res && res.prose) {
        setLocalProse(res.prose);
      }
    } finally {
      setRefreshing(false);
    }
  }

  const displayProse = localProse ?? brief?.prose;
  const showFallback = !displayProse && (fallback || !brief);

  return (
    <div>
      <div className="flex items-center gap-3">
        <p
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-brand-orange)" }}
        >
          Daily Brief
        </p>
        <span
          aria-hidden
          className="inline-block size-[3px] rounded-full"
          style={{ backgroundColor: "var(--color-neutral-600)" }}
        />
        <p
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-600)" }}
        >
          {slot}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors duration-150 hover:bg-white/5 disabled:opacity-40"
          style={{ letterSpacing: "1.2px", color: "var(--color-neutral-500)" }}
          title="Regenerate brief"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={refreshing ? "animate-spin" : ""}
          >
            <path d="M21.5 2v6h-6" />
            <path d="M2.5 22v-6h6" />
            <path d="M2.8 13.6a9 9 0 0 0 17.8-1.2" />
            <path d="M21.2 10.4A9 9 0 0 0 3.4 11.6" />
          </svg>
          {refreshing ? "Generating…" : "Refresh"}
        </button>
      </div>
      <div className="mt-4">
        {showFallback ? (
          <p
            className="text-pretty font-[family-name:var(--font-narrative)] text-[20px] italic leading-relaxed"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {pseudoRandomPick(QUIET_FALLBACK_LINES, nowMs, 1)}
          </p>
        ) : (
          <p
            className="text-pretty font-[family-name:var(--font-narrative)] text-[20px] leading-relaxed"
            style={{ color: "var(--color-neutral-200)" }}
          >
            {displayProse}
          </p>
        )}
      </div>
    </div>
  );
}
