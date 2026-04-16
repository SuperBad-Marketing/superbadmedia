"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type {
  InboxAddressFilter,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import type {
  ConversationPayload,
  ConversationThread,
} from "../_queries/list-conversation";
import { isConversationThreadUnread } from "./conversation-view-helpers";
import { ChannelIconOnly } from "./thread-list-row";
import { ConversationStream } from "./conversation-stream";

function formatThreadHeaderTimestamp(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildCloseHref(
  view: InboxView,
  address: InboxAddressFilter,
  sort: InboxSortOrder,
  threadId: string | null,
): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (address !== "all") params.set("address", address);
  if (sort !== "recent") params.set("sort", sort);
  if (threadId) params.set("thread", threadId);
  return `/lite/inbox?${params.toString()}`;
}

function buildThreadHref(
  view: InboxView,
  address: InboxAddressFilter,
  sort: InboxSortOrder,
  threadId: string,
): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (address !== "all") params.set("address", address);
  if (sort !== "recent") params.set("sort", sort);
  params.set("thread", threadId);
  return `/lite/inbox?${params.toString()}`;
}

export function ConversationView({
  data,
  view,
  address,
  sort,
  returnThreadId,
}: {
  data: ConversationPayload;
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
  returnThreadId: string | null;
}) {
  const reducedMotion = useReducedMotion();

  const initialExpanded = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const entry of data.threads) {
      map[entry.thread.id] = isConversationThreadUnread(entry.thread);
    }
    return map;
  }, [data.threads]);

  const [expanded, setExpanded] =
    React.useState<Record<string, boolean>>(initialExpanded);

  const threadCount = data.threads.length;
  const unreadCount = data.threads.filter((e) =>
    isConversationThreadUnread(e.thread),
  ).length;

  return (
    <motion.div
      key={data.contact.id}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0.18 } : houseSpring}
      className="flex h-full flex-col"
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-[color:var(--color-neutral-700)] px-6 py-4">
        <Link
          href={buildCloseHref(view, address, sort, returnThreadId)}
          aria-label="Back to thread"
          className={cn(
            "mt-1 inline-flex items-center gap-1 rounded-sm px-2 py-1",
            "font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase",
            "text-[color:var(--color-neutral-300)] outline-none",
            "transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
            "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-background)]",
          )}
          style={{ letterSpacing: "1.5px" }}
        >
          <ArrowLeft size={12} strokeWidth={1.75} aria-hidden />
          Back
        </Link>

        <div className="flex flex-col gap-0.5">
          <span
            className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Conversation
          </span>
          <h1
            className="font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            {data.contact.name}
          </h1>
          {data.company && (
            <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]">
              {data.company.name}
            </span>
          )}
        </div>

        {threadCount > 0 && (
          <div className="ml-auto flex flex-col items-end gap-0.5 text-right">
            <span
              className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {threadCount === 1 ? "1 thread" : `${threadCount} threads`}
            </span>
            {unreadCount === 0 && (
              <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-small)] text-[color:var(--color-brand-pink)]">
                All caught up across {threadCount === 1 ? "this one" : `${threadCount} threads`}.
              </em>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {threadCount === 0 ? (
          <ConversationEmpty />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {data.threads.map((entry) => (
              <ConversationThreadBlock
                key={entry.thread.id}
                entry={entry}
                isExpanded={expanded[entry.thread.id] ?? false}
                onToggle={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [entry.thread.id]: !(prev[entry.thread.id] ?? false),
                  }))
                }
                openHref={buildThreadHref(view, address, sort, entry.thread.id)}
                reducedMotion={reducedMotion}
              />
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

function ConversationThreadBlock({
  entry,
  isExpanded,
  onToggle,
  openHref,
  reducedMotion,
}: {
  entry: ConversationThread;
  isExpanded: boolean;
  onToggle: () => void;
  openHref: string;
  reducedMotion: boolean | null;
}) {
  const { thread, messages: threadMessages } = entry;
  const latestTimestamp = thread.last_message_at_ms;
  const subject = thread.subject ?? "(no subject)";
  const panelId = `conversation-thread-panel-${thread.id}`;

  return (
    <li className="list-none rounded-sm border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          className={cn(
            "flex items-center gap-2 rounded-sm px-1.5 py-1 outline-none",
            "transition-colors hover:bg-[color:var(--color-surface-2)]",
            "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-surface-1)]",
          )}
        >
          <motion.span
            aria-hidden
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={reducedMotion ? { duration: 0 } : houseSpring}
            className="text-[color:var(--color-neutral-300)]"
          >
            <ChevronDown size={14} strokeWidth={1.75} />
          </motion.span>
          <ChannelIconOnly
            channel={thread.channel_of_origin}
            className="text-[color:var(--color-neutral-500)]"
          />
        </button>

        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]",
              isConversationThreadUnread(thread)
                ? "font-semibold text-[color:var(--color-neutral-100)]"
                : "text-[color:var(--color-neutral-300)]",
            )}
          >
            {subject}
          </span>
          <span
            className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {formatThreadHeaderTimestamp(latestTimestamp)} ·{" "}
            {threadMessages.length === 1
              ? "1 message"
              : `${threadMessages.length} messages`}
          </span>
        </div>

        <Link
          href={openHref}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-sm px-2 py-1",
            "font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase",
            "text-[color:var(--color-accent-cta)] outline-none",
            "transition-colors hover:bg-[color:var(--color-surface-2)]",
            "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-surface-1)]",
          )}
          style={{ letterSpacing: "1.5px" }}
        >
          Open
          <ArrowRight size={12} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={reducedMotion ? { duration: 0.18 } : houseSpring}
            className="overflow-hidden border-t border-[color:var(--color-neutral-700)]"
          >
            <div className="px-4 py-4">
              <ConversationStream messages={threadMessages} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function ConversationEmpty() {
  return (
    <div
      role="status"
      className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Conversation
      </span>
      <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
        First time you&rsquo;ve spoken.
      </h2>
      <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-brand-pink)]">
        Nothing to look back on yet.
      </em>
    </div>
  );
}

export function ConversationViewUnknownContact() {
  return (
    <div
      role="status"
      className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Conversation
      </span>
      <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
        Can&rsquo;t find that contact.
      </h2>
      <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-neutral-500)]">
        It may have been merged or removed.
      </em>
    </div>
  );
}
