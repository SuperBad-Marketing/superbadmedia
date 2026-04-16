"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MessageRow } from "@/lib/db/schema/messages";
import { CalendarRsvpButtons } from "./calendar-rsvp-buttons";
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
  sendEnabled = true,
}: {
  messages: MessageRow[];
  sendEnabled?: boolean;
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
                    title="This message has attachments."
                  >
                    <Paperclip size={12} strokeWidth={1.5} aria-hidden />
                    Attachments
                  </span>
                )}
                {m.has_calendar_invite && (
                  <CalendarRsvpButtons
                    messageId={m.id}
                    sendEnabled={sendEnabled}
                  />
                )}
              </footer>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
