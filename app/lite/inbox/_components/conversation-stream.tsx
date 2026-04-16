"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MessageRow } from "@/lib/db/schema/messages";
import { ChannelIconOnly } from "./thread-list-row";

function formatFullTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ConversationStream({
  messages,
  onStubCalendarRsvp,
}: {
  messages: MessageRow[];
  onStubCalendarRsvp?: (messageId: string, kind: "accept" | "decline" | "tentative") => void;
}) {
  return (
    <ul role="list" className="flex flex-col gap-4">
      {messages.map((m) => {
        const isOutbound = m.direction === "outbound";
        const timestamp = m.sent_at_ms ?? m.received_at_ms ?? m.created_at_ms;
        return (
          <motion.li
            layout
            key={m.id}
            className={cn(
              "flex flex-col gap-2 rounded-sm border p-4",
              isOutbound
                ? "ml-10 self-end border-[color:var(--color-accent-cta)]/30 bg-[color:var(--color-accent-cta)]/5"
                : "mr-10 border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]",
            )}
            style={{ maxWidth: "calc(100% - 2.5rem)" }}
          >
            <header className="flex items-center gap-2 text-[length:var(--text-micro)]">
              <ChannelIconOnly
                channel={m.channel}
                className="text-[color:var(--color-neutral-500)]"
              />
              <span className="font-[family-name:var(--font-dm-sans)] text-[color:var(--color-neutral-300)]">
                {isOutbound ? "You" : m.from_address}
              </span>
              <span
                className="font-[family-name:var(--font-righteous)] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                {isOutbound ? "→ sent" : "received"}
              </span>
              <span className="ml-auto font-[family-name:var(--font-dm-sans)] text-[color:var(--color-neutral-500)]">
                {formatFullTime(timestamp)}
              </span>
            </header>

            <div className="whitespace-pre-wrap break-words font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
              {m.body_text}
            </div>

            {(m.has_attachments || m.has_calendar_invite) && (
              <footer className="flex flex-wrap items-center gap-2 border-t border-[color:var(--color-neutral-700)] pt-2">
                {m.has_attachments && (
                  <span
                    className="flex items-center gap-1 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]"
                    title="Attachments — download lands in UI-10"
                  >
                    <Paperclip size={12} strokeWidth={1.5} aria-hidden />
                    Attachments — download lands in UI-10
                  </span>
                )}
                {m.has_calendar_invite && (
                  <div className="flex items-center gap-1 rounded-sm bg-[color:var(--color-surface-2)] px-2 py-1">
                    <CalendarDays
                      size={12}
                      strokeWidth={1.5}
                      aria-hidden
                      className="text-[color:var(--color-brand-pink)]"
                    />
                    <span className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-300)]">
                      Invite
                    </span>
                    {(["accept", "tentative", "decline"] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => onStubCalendarRsvp?.(m.id, kind)}
                        className="rounded-sm px-1.5 py-0.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none transition-colors hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-neutral-100)]"
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                )}
              </footer>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
