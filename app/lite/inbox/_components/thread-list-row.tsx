"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertOctagon,
  AtSign,
  Bookmark,
  Info,
  Mail,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Pin,
  VolumeX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { InboxListRow } from "../_queries/list-threads";

function formatTimestamp(ms: number, now: number): string {
  const diff = now - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  const date = new Date(ms);
  if (diff < 7 * day) {
    return date.toLocaleDateString("en-AU", { weekday: "short" });
  }
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function ChannelIcon({
  channel,
  size,
  strokeWidth,
  className,
  ariaLabel,
}: {
  channel: string;
  size: number;
  strokeWidth: number;
  className?: string;
  ariaLabel?: string;
}) {
  const common = {
    size,
    strokeWidth,
    className,
    ...(ariaLabel ? { "aria-label": ariaLabel } : { "aria-hidden": true as const }),
  };
  switch (channel) {
    case "email":
      return <Mail {...common} />;
    case "portal_chat":
    case "sms":
    case "whatsapp":
      return <MessageSquare {...common} />;
    case "task_feedback":
    case "instagram_dm":
    case "facebook_messenger":
      return <MessageCircle {...common} />;
    default:
      return <Mail {...common} />;
  }
}

export function ThreadListRow({
  row,
  isSelected,
  selectHref,
  now,
}: {
  row: InboxListRow;
  isSelected: boolean;
  selectHref: string;
  now: number;
}) {
  const timestamp = formatTimestamp(row.lastMessageAtMs, now);

  return (
    <motion.li layout className="list-none">
      <Link
        href={selectHref}
        aria-current={isSelected ? "true" : undefined}
        className={cn(
          "block border-b border-[color:var(--color-neutral-700)] px-5 py-3",
          "outline-none transition-colors",
          "hover:bg-[color:var(--color-surface-2)]",
          "focus-visible:bg-[color:var(--color-surface-2)]",
          isSelected &&
            "bg-[color:var(--color-surface-2)] shadow-[inset_3px_0_0_0_var(--color-accent-cta)]",
        )}
      >
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]",
              row.isUnread
                ? "font-semibold text-[color:var(--color-neutral-100)]"
                : "text-[color:var(--color-neutral-300)]",
            )}
          >
            {row.senderLabel}
          </span>
          {row.keepPinned && (
            <Pin
              size={12}
              strokeWidth={1.75}
              aria-label="Pinned"
              className="shrink-0 text-[color:var(--color-brand-pink)]"
            />
          )}
          <span className="ml-auto shrink-0 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
            {timestamp}
          </span>
        </div>

        <div
          className={cn(
            "mt-0.5 truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
            row.isUnread
              ? "text-[color:var(--color-neutral-100)]"
              : "text-[color:var(--color-neutral-300)]",
          )}
        >
          {row.subject ?? (row.kind === "draft" ? "(no subject yet)" : "(no subject)")}
        </div>

        <div
          className="mt-0.5 truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]"
        >
          {row.previewText || (row.kind === "draft" ? "Still empty." : "")}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <ChannelIcon
            channel={row.channel}
            size={12}
            strokeWidth={1.75}
            ariaLabel={row.channel}
            className="shrink-0 text-[color:var(--color-neutral-500)]"
          />
          {row.kind === "draft" && (
            <span className="rounded-sm bg-[color:var(--color-accent-cta)]/15 px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-accent-cta)]">
              Draft
            </span>
          )}
          {row.priorityClass === "noise" && (
            <span
              title="Classified as noise"
              className="flex items-center gap-1 rounded-sm bg-[color:var(--color-surface-3)] px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-300)]"
            >
              <VolumeX size={10} strokeWidth={1.75} aria-hidden />
              Noise
            </span>
          )}
          {row.priorityClass === "spam" && (
            <span
              title="Classified as spam"
              className="flex items-center gap-1 rounded-sm bg-[color:var(--color-surface-3)] px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-brand-pink)]"
            >
              <AlertOctagon size={10} strokeWidth={1.75} aria-hidden />
              Spam
            </span>
          )}
          {row.kind === "thread" && row.sendingAddress === "support@" && (
            <span className="flex items-center gap-1 rounded-sm bg-[color:var(--color-surface-3)] px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-300)]">
              <AtSign size={10} strokeWidth={1.75} aria-hidden />
              Support
            </span>
          )}
          {row.lowConfidenceFlagCount > 0 && (
            <span
              title={`${row.lowConfidenceFlagCount} low-confidence flag${row.lowConfidenceFlagCount === 1 ? "" : "s"}`}
              className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-brand-pink)]"
            >
              <Info size={10} strokeWidth={1.75} aria-hidden />
              {row.lowConfidenceFlagCount}
            </span>
          )}
          {row.hasCachedDraft && row.kind === "thread" && (
            <span
              title={row.cachedDraftStale ? "Draft is stale" : "Draft ready"}
              className={cn(
                "flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider",
                row.cachedDraftStale
                  ? "text-[color:var(--color-neutral-500)]"
                  : "text-[color:var(--color-accent-cta)]",
              )}
            >
              <Bookmark size={10} strokeWidth={1.75} aria-hidden />
              {row.cachedDraftStale ? "Stale" : "Draft"}
            </span>
          )}
        </div>
      </Link>
    </motion.li>
  );
}

export function ChannelIconOnly({ channel, className }: { channel: string; className?: string }) {
  return <ChannelIcon channel={channel} size={14} strokeWidth={1.5} className={className} />;
}

export function AttachmentPin() {
  return <Paperclip size={12} strokeWidth={1.5} aria-hidden />;
}
