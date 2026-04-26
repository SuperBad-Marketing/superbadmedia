"use client";

import type { CockpitBriefRow } from "@/lib/db/schema/cockpit-briefs";
import type { CockpitBriefSlot } from "@/lib/db/schema/cockpit-briefs";

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
      </div>
      <div className="mt-4">
        {fallback || !brief ? (
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
            {brief.prose}
          </p>
        )}
      </div>
    </div>
  );
}
