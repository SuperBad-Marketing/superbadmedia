import type { ActivityLogRow } from "@/lib/db/schema/activity-log";
import type { PrivateNoteRow } from "@/lib/db/schema/private-notes";

type TimelineEntry =
  | { source: "activity"; row: ActivityLogRow }
  | { source: "private_note"; row: PrivateNoteRow };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const KIND_COLOR: Record<string, string> = {
  note: "var(--color-brand-cream)",
  stage_change: "var(--color-brand-orange)",
  email_sent: "var(--color-brand-pink)",
  email_received: "var(--color-brand-pink)",
  payment_received: "var(--color-success)",
  invoice_generated: "var(--color-neutral-300)",
  invoice_sent: "var(--color-neutral-300)",
  quote_sent: "var(--color-brand-pink)",
  quote_accepted: "var(--color-success)",
  trial_shoot_booked: "var(--color-brand-orange)",
};

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-neutral-500)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Private note"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ActivityEntry({ entry }: { entry: ActivityLogRow }) {
  const color = KIND_COLOR[entry.kind] ?? "var(--color-neutral-500)";
  return (
    <div
      className="flex gap-3 px-5 py-3"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
    >
      <div className="flex w-4 shrink-0 justify-center pt-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color, opacity: 0.7 }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.2px", color }}
          >
            {kindLabel(entry.kind)}
          </span>
          <span className="text-[10px] text-[color:var(--color-neutral-500)]">
            {formatDate(entry.created_at_ms)} at {formatTime(entry.created_at_ms)}
          </span>
        </div>
        <p className="text-[13px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          {entry.body}
        </p>
      </div>
    </div>
  );
}

function PrivateNoteEntry({ note }: { note: PrivateNoteRow }) {
  return (
    <div
      className="flex gap-3 px-5 py-3"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
    >
      <div className="flex w-4 shrink-0 justify-center pt-1">
        <LockIcon />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "1.2px",
              color: "var(--color-neutral-500)",
            }}
          >
            Private note
          </span>
          <span className="text-[10px] text-[color:var(--color-neutral-500)]">
            {formatDate(note.created_at_ms)} at {formatTime(note.created_at_ms)}
          </span>
        </div>
        <p className="text-[13px] leading-[1.55] text-[color:var(--color-neutral-300)] whitespace-pre-wrap">
          {note.content}
        </p>
      </div>
    </div>
  );
}

export function ActivityTab({
  activities,
  privateNotes,
}: {
  activities: ActivityLogRow[];
  privateNotes?: PrivateNoteRow[];
}) {
  const timeline: TimelineEntry[] = [
    ...activities.map(
      (row): TimelineEntry => ({ source: "activity", row }),
    ),
    ...(privateNotes ?? []).map(
      (row): TimelineEntry => ({ source: "private_note", row }),
    ),
  ].sort((a, b) => {
    const tsA = a.source === "activity" ? a.row.created_at_ms : a.row.created_at_ms;
    const tsB = b.source === "activity" ? b.row.created_at_ms : b.row.created_at_ms;
    return tsB - tsA;
  });

  if (timeline.length === 0) {
    return (
      <div className="px-4 pb-10">
        <div className="px-8 py-10 text-center">
          <p
            className="font-[family-name:var(--font-display)] leading-none text-[color:var(--color-brand-cream)]"
            style={{ fontSize: "24px", letterSpacing: "-0.2px" }}
          >
            No activity yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            a blank page. everyone starts somewhere.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10">
      <div
        className="overflow-hidden rounded-[12px]"
        style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
      >
        <div
          className="flex items-baseline justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
        >
          <h2
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.8px" }}
          >
            Activity
          </h2>
          <span
            className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {timeline.length}
          </span>
        </div>
        <div>
          {timeline.map((entry) =>
            entry.source === "activity" ? (
              <ActivityEntry key={`a-${entry.row.id}`} entry={entry.row} />
            ) : (
              <PrivateNoteEntry key={`pn-${entry.row.id}`} note={entry.row} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
