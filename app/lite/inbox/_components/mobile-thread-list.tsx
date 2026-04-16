"use client";

import * as React from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Archive, Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type {
  InboxAddressFilter,
  InboxListRow,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import {
  archiveThreadAction,
  setThreadKeepAction,
} from "../thread/actions";
import {
  newActionId,
  queueAction,
} from "@/lib/offline/inbox-cache";

export const SWIPE_THRESHOLD_PX = 80;
const SWIPE_SNAP_PX = 120;

/**
 * Mobile thread list (spec §4.5). One-line sender + one-line snippet +
 * time. Swipe-right keeps (pins); swipe-left archives (promotes to
 * noise). Below the pan-threshold the row springs back.
 *
 * Offline: if `navigator.onLine` is false, the swipe action is queued
 * in IndexedDB for replay on reconnect.
 */

function formatTimestamp(ms: number, now: number): string {
  const diff = now - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  const date = new Date(ms);
  if (diff < 7 * day) {
    return date.toLocaleDateString("en-AU", { weekday: "short" });
  }
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function buildHref({
  row,
  view,
  address,
  sort,
}: {
  row: InboxListRow;
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
}): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (address !== "all") params.set("address", address);
  if (sort !== "recent") params.set("sort", sort);
  if (row.kind === "thread") {
    params.set("thread", row.threadId);
  } else {
    params.set("draft", row.id.replace(/^draft_/, ""));
  }
  return `/lite/inbox?${params.toString()}`;
}

export function MobileThreadList({
  rows,
  view,
  address,
  sort,
  now,
  emptyCopy,
}: {
  rows: InboxListRow[];
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
  now: number;
  emptyCopy: { title: string; body?: string };
}) {
  const [removedIds, setRemovedIds] = React.useState<Set<string>>(new Set());

  const visibleRows = rows.filter((r) => !removedIds.has(r.id));

  if (visibleRows.length === 0) {
    return (
      <div
        role="status"
        className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
      >
        <span
          className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          {view}
        </span>
        <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
          {emptyCopy.title}
        </h2>
        {emptyCopy.body && (
          <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-brand-pink)]">
            {emptyCopy.body}
          </em>
        )}
      </div>
    );
  }

  function handleRemoved(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <ul role="list" aria-label="Threads" className="flex-1 overflow-y-auto">
      <AnimatePresence initial={false}>
        {visibleRows.map((row) => (
          <MobileThreadRow
            key={row.id}
            row={row}
            href={buildHref({ row, view, address, sort })}
            now={now}
            onArchived={() => handleRemoved(row.id)}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}

function MobileThreadRow({
  row,
  href,
  now,
  onArchived,
}: {
  row: InboxListRow;
  href: string;
  now: number;
  onArchived: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const [busy, setBusy] = React.useState(false);
  const [pinnedLocal, setPinnedLocal] = React.useState(row.keepPinned);

  const keepHint = useTransform(x, [0, SWIPE_THRESHOLD_PX, SWIPE_SNAP_PX], [0, 0.7, 1]);
  const archiveHint = useTransform(
    x,
    [-SWIPE_SNAP_PX, -SWIPE_THRESHOLD_PX, 0],
    [1, 0.7, 0],
  );

  async function handleKeep() {
    if (row.kind !== "thread" || busy) return;
    setBusy(true);
    const nextPinned = !pinnedLocal;
    setPinnedLocal(nextPinned);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueAction({
          id: newActionId(),
          type: "keep",
          payload: { threadId: row.threadId, pinned: nextPinned },
          created_at_ms: Date.now(),
        });
      } else {
        const result = await setThreadKeepAction({
          threadId: row.threadId,
          pinned: nextPinned,
        });
        if (!result.ok) {
          setPinnedLocal(!nextPinned);
        }
      }
    } catch {
      setPinnedLocal(!nextPinned);
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (row.kind !== "thread" || busy) return;
    setBusy(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueAction({
          id: newActionId(),
          type: "archive",
          payload: { threadId: row.threadId },
          created_at_ms: Date.now(),
        });
        onArchived();
      } else {
        const result = await archiveThreadAction({ threadId: row.threadId });
        if (result.ok) {
          onArchived();
        } else {
          setBusy(false);
          return;
        }
      }
    } catch {
      setBusy(false);
      return;
    }
  }

  function handleDragEnd(
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } },
  ) {
    const dx = info.offset.x;
    if (dx >= SWIPE_THRESHOLD_PX) {
      x.set(0);
      handleKeep();
    } else if (dx <= -SWIPE_THRESHOLD_PX) {
      x.set(0);
      handleArchive();
    } else {
      x.set(0);
    }
  }

  const timestamp = formatTimestamp(row.lastMessageAtMs, now);
  const isThread = row.kind === "thread";
  const canSwipe = isThread && !reducedMotion;

  return (
    <motion.li
      layout
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, x: -600 }}
      transition={houseSpring}
      className="relative list-none overflow-hidden border-b border-[color:var(--color-neutral-700)]"
    >
      {/* Swipe-reveal backgrounds */}
      {canSwipe && (
        <>
          <motion.div
            aria-hidden
            style={{ opacity: keepHint }}
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 flex w-32 items-center justify-start pl-5",
              "bg-[color:var(--color-accent-cta)]/25 text-[color:var(--color-accent-cta)]",
            )}
          >
            <Pin size={16} strokeWidth={1.75} aria-hidden />
            <span className="ml-2 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider">
              Keep
            </span>
          </motion.div>
          <motion.div
            aria-hidden
            style={{ opacity: archiveHint }}
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 flex w-32 items-center justify-end pr-5",
              "bg-[color:var(--color-brand-pink)]/20 text-[color:var(--color-brand-pink)]",
            )}
          >
            <span className="mr-2 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider">
              Archive
            </span>
            <Archive size={16} strokeWidth={1.75} aria-hidden />
          </motion.div>
        </>
      )}

      <motion.div
        drag={canSwipe ? "x" : false}
        dragElastic={0.12}
        dragConstraints={{ left: -SWIPE_SNAP_PX, right: SWIPE_SNAP_PX }}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-[1] bg-[color:var(--color-background)]"
      >
        <Link
          href={href}
          data-row-id={row.id}
          data-testid="mobile-thread-row"
          className={cn(
            "block px-4 py-3 outline-none",
            "transition-colors hover:bg-[color:var(--color-surface-2)]",
            "focus-visible:bg-[color:var(--color-surface-2)]",
          )}
        >
          <div className="flex items-baseline gap-2">
            <span
              data-testid="row-sender"
              className={cn(
                "truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]",
                row.isUnread
                  ? "font-semibold text-[color:var(--color-neutral-100)]"
                  : "text-[color:var(--color-neutral-300)]",
              )}
            >
              {row.senderLabel}
            </span>
            {pinnedLocal && (
              <Pin
                size={10}
                strokeWidth={1.75}
                aria-label="Pinned"
                className="shrink-0 text-[color:var(--color-brand-pink)]"
              />
            )}
            <span
              data-testid="row-time"
              className="ml-auto shrink-0 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]"
            >
              {timestamp}
            </span>
          </div>
          <div
            data-testid="row-snippet"
            className={cn(
              "mt-0.5 truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
              row.isUnread
                ? "text-[color:var(--color-neutral-100)]"
                : "text-[color:var(--color-neutral-500)]",
            )}
          >
            {row.subject ?? row.previewText ?? "(no subject)"}
          </div>
        </Link>
      </motion.div>
    </motion.li>
  );
}
