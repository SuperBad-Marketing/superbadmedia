"use client";

import { useRef, useState } from "react";
import type { PrivateNoteRow } from "@/lib/db/schema/private-notes";
import type { ActivityLogRow } from "@/lib/db/schema/activity-log";

type NoteEntry =
  | { source: "private"; row: PrivateNoteRow }
  | { source: "activity"; row: ActivityLogRow };

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

function getTimestamp(entry: NoteEntry): number {
  return entry.source === "private"
    ? entry.row.created_at_ms
    : entry.row.created_at_ms;
}

function getContent(entry: NoteEntry): string {
  return entry.source === "private" ? entry.row.content : entry.row.body;
}

function getId(entry: NoteEntry): string {
  return entry.row.id;
}

export function PrivateNotesFeed({
  privateNotes,
  activityNotes,
  contactId,
  addNoteAction,
  toggleVisibilityAction,
}: {
  privateNotes: PrivateNoteRow[];
  activityNotes: ActivityLogRow[];
  contactId: string;
  addNoteAction: (formData: FormData) => Promise<void>;
  toggleVisibilityAction: (formData: FormData) => Promise<void>;
}) {
  const [visibleToAi, setVisibleToAi] = useState(true);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const entries: NoteEntry[] = [
    ...privateNotes.map(
      (row): NoteEntry => ({ source: "private", row }),
    ),
    ...activityNotes.map(
      (row): NoteEntry => ({ source: "activity", row }),
    ),
  ].sort((a, b) => getTimestamp(b) - getTimestamp(a));

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addNoteAction(formData);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Private notes"
      className="rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div
        className="px-5 py-3"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.8px" }}
        >
          Private notes
        </h2>
      </div>

      {/* Add note form */}
      <form
        ref={formRef}
        action={handleSubmit}
        className="px-5 py-4"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
      >
        <input type="hidden" name="contactId" value={contactId} />
        <input
          type="hidden"
          name="visibleToAi"
          value={visibleToAi ? "true" : "false"}
        />
        <textarea
          name="content"
          placeholder="Add a note..."
          required
          rows={2}
          className="w-full resize-none rounded-[8px] border-none px-3 py-2.5 font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none focus:ring-1"
          style={{
            background: "rgba(253, 245, 230, 0.04)",
            caretColor: "var(--color-brand-pink)",
            // @ts-expect-error -- CSS custom property
            "--tw-ring-color": "rgba(244, 160, 176, 0.25)",
          }}
        />
        <div className="mt-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setVisibleToAi((v) => !v)}
            className="group flex items-center gap-2 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ letterSpacing: "1.2px" }}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-[4px] text-[10px] transition-colors duration-[180ms]"
              style={{
                background: visibleToAi
                  ? "rgba(244, 160, 176, 0.15)"
                  : "rgba(128, 127, 115, 0.15)",
                color: visibleToAi
                  ? "var(--color-brand-pink)"
                  : "var(--color-neutral-500)",
              }}
            >
              {visibleToAi ? "✓" : "✗"}
            </span>
            <span
              style={{
                color: visibleToAi
                  ? "var(--color-brand-pink)"
                  : "var(--color-neutral-500)",
              }}
            >
              Visible to AI
            </span>
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] disabled:opacity-50"
            style={{
              letterSpacing: "1.2px",
              background: "rgba(244, 160, 176, 0.12)",
              color: "var(--color-brand-pink)",
            }}
          >
            {pending ? "Saving..." : "Add note"}
          </button>
        </div>
      </form>

      {/* Notes feed */}
      {entries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            no notes yet. start typing.
          </p>
        </div>
      ) : (
        <div>
          {entries.map((entry) => (
            <NoteRow
              key={getId(entry)}
              entry={entry}
              contactId={contactId}
              toggleVisibilityAction={toggleVisibilityAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NoteRow({
  entry,
  contactId,
  toggleVisibilityAction,
}: {
  entry: NoteEntry;
  contactId: string;
  toggleVisibilityAction: (formData: FormData) => Promise<void>;
}) {
  const isPrivate = entry.source === "private";
  const ts = getTimestamp(entry);
  const content = getContent(entry);
  const [toggling, setToggling] = useState(false);

  async function handleToggle(formData: FormData) {
    setToggling(true);
    try {
      await toggleVisibilityAction(formData);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className="flex gap-3 px-5 py-3"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
    >
      <div className="flex w-4 shrink-0 justify-center pt-1.5">
        {isPrivate ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-neutral-500)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Private — not visible to AI"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "var(--color-brand-cream)",
              opacity: 0.5,
            }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[color:var(--color-neutral-500)]">
            {formatDate(ts)} at {formatTime(ts)}
          </span>
          {isPrivate && (
            <span
              className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1px" }}
            >
              private
            </span>
          )}
        </div>
        <p className="text-[13px] leading-[1.55] text-[color:var(--color-neutral-300)] whitespace-pre-wrap">
          {content}
        </p>
        <form action={handleToggle} className="mt-1">
          <input type="hidden" name="noteId" value={getId(entry)} />
          <input type="hidden" name="contactId" value={contactId} />
          <input
            type="hidden"
            name="currentlyPrivate"
            value={isPrivate ? "true" : "false"}
          />
          <button
            type="submit"
            disabled={toggling}
            className="font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-50"
            style={{
              letterSpacing: "1px",
              color: "var(--color-neutral-500)",
            }}
          >
            {toggling
              ? "..."
              : isPrivate
                ? "Make visible to AI"
                : "Make private"}
          </button>
        </form>
      </div>
    </div>
  );
}
