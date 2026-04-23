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

const GREETING_LINES = [
  "Morning. Here's what's going.",
  "You're back. Okay.",
  "Afternoon.",
  "Right. Where were we.",
  "Here's the state of things.",
  "Let's see what we've got.",
  "One more day. Here's the brief.",
  "Back at it.",
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
  const greeting = pseudoRandomPick(GREETING_LINES, nowMs, 1);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-brand-orange)" }}
        >
          Daily Brief
        </p>
        <p
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-600)" }}
        >
          {slot}
        </p>
      </div>
      <p
        className="mt-3 font-[family-name:var(--font-body)] text-[13px]"
        style={{ color: "var(--color-neutral-500)" }}
      >
        {greeting}
      </p>
      <div className="mt-2">
        {fallback || !brief ? (
          <p
            className="font-[family-name:var(--font-narrative)] text-[18px] italic leading-relaxed"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {pseudoRandomPick(QUIET_FALLBACK_LINES, nowMs, 1)}
          </p>
        ) : (
          <p
            className="font-[family-name:var(--font-narrative)] text-[18px] leading-relaxed"
            style={{ color: "var(--color-neutral-200)" }}
          >
            {brief.prose}
          </p>
        )}
      </div>
    </div>
  );
}
