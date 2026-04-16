"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  InboxAddressFilter,
  InboxListRow,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import { ThreadListRow } from "./thread-list-row";
import { EmptyState } from "./empty-state";

const SORT_LABELS: Record<InboxSortOrder, string> = {
  recent: "Most recent",
  unread_first: "Unread first",
  priority_first: "Priority first",
};

function buildRowHref({
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

function buildSortHref({
  view,
  address,
  selectedThreadId,
  selectedDraftId,
  sort,
}: {
  view: InboxView;
  address: InboxAddressFilter;
  selectedThreadId: string | null;
  selectedDraftId: string | null;
  sort: InboxSortOrder;
}): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (address !== "all") params.set("address", address);
  if (sort !== "recent") params.set("sort", sort);
  if (selectedThreadId) params.set("thread", selectedThreadId);
  if (selectedDraftId) params.set("draft", selectedDraftId);
  return `/lite/inbox?${params.toString()}`;
}

export function ThreadList({
  rows,
  view,
  address,
  sort,
  selectedThreadId,
  selectedDraftId,
  hasMore,
  now,
}: {
  rows: InboxListRow[];
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
  selectedThreadId: string | null;
  selectedDraftId: string | null;
  hasMore: boolean;
  now: number;
}) {
  const [sortOpen, setSortOpen] = React.useState(false);
  const sortButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!sortOpen) return;
    function handle(e: MouseEvent) {
      if (!sortButtonRef.current) return;
      if (!sortButtonRef.current.parentElement?.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [sortOpen]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[color:var(--color-neutral-700)] px-5 py-3">
        <div className="flex flex-col">
          <span
            className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            View
          </span>
          <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)] capitalize">
            {view}
          </span>
        </div>
        <div className="relative">
          <button
            ref={sortButtonRef}
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2 py-1",
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]",
              "outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
              "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
            )}
          >
            <ArrowUpDown size={12} strokeWidth={1.5} aria-hidden />
            {SORT_LABELS[sort]}
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.ul
                role="menu"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={cn(
                  "absolute right-0 top-full z-10 mt-1 min-w-[12rem]",
                  "rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] py-1 shadow-lg",
                )}
              >
                {(Object.keys(SORT_LABELS) as InboxSortOrder[]).map((opt) => {
                  const href = buildSortHref({
                    view,
                    address,
                    selectedThreadId,
                    selectedDraftId,
                    sort: opt,
                  });
                  const isActive = opt === sort;
                  return (
                    <li key={opt} role="none">
                      <a
                        role="menuitemradio"
                        aria-checked={isActive}
                        href={href}
                        onClick={() => setSortOpen(false)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5",
                          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                          "text-[color:var(--color-neutral-300)]",
                          "hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
                          isActive && "text-[color:var(--color-neutral-100)]",
                        )}
                      >
                        <Check
                          size={12}
                          strokeWidth={2}
                          aria-hidden
                          className={cn(
                            "shrink-0 text-[color:var(--color-accent-cta)]",
                            !isActive && "opacity-0",
                          )}
                        />
                        {SORT_LABELS[opt]}
                      </a>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState view={view} />
      ) : (
        <ul
          role="list"
          aria-label="Threads"
          className="flex-1 overflow-y-auto"
        >
          {rows.map((row) => {
            const isSelected =
              row.kind === "thread"
                ? row.threadId === selectedThreadId
                : row.id.replace(/^draft_/, "") === selectedDraftId;
            return (
              <ThreadListRow
                key={row.id}
                row={row}
                isSelected={isSelected}
                selectHref={buildRowHref({ row, view, address, sort })}
                now={now}
              />
            );
          })}
          {hasMore && (
            <li className="px-5 py-3 text-center">
              <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]">
                More threads off-screen — pagination lands post-UI-8.
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
