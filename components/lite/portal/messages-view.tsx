"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useCallback } from "react";
import { houseSpring } from "@/lib/design-tokens";
import {
  sendPortalReply,
  startPortalThread,
} from "@/app/lite/portal/[token]/messages/actions";
import type {
  PortalThread,
  PortalMessage,
} from "@/app/lite/portal/[token]/messages/actions";

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) {
    return new Intl.DateTimeFormat("en-AU", { weekday: "long" }).format(date);
  }
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

function channelLabel(channel: string): string {
  switch (channel) {
    case "email":
      return "email";
    case "portal_chat":
      return "portal";
    case "sms":
      return "sms";
    case "instagram_dm":
      return "instagram";
    case "facebook_messenger":
      return "messenger";
    case "whatsapp":
      return "whatsapp";
    default:
      return channel.replace(/_/g, " ");
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function MessageBubble({
  message,
  index,
}: {
  message: PortalMessage;
  index: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const isFromClient = message.direction === "inbound";
  const timestamp = message.sentAtMs ?? message.receivedAtMs;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { ...houseSpring, delay: index * 0.03 }
      }
      className={`flex flex-col gap-1 ${isFromClient ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-[13px] leading-relaxed ${
          isFromClient
            ? "bg-[rgba(242,140,82,0.1)] text-[var(--color-brand-cream)]"
            : "bg-[rgba(253,245,230,0.04)] text-[var(--color-brand-cream)]/90"
        }`}
      >
        <div className="mb-1 text-[10px] uppercase tracking-[1px] text-[var(--color-neutral-500)]">
          {isFromClient ? "you" : "Andy"}
        </div>
        <p className="whitespace-pre-wrap">{message.bodyText}</p>
        {message.hasAttachments && (
          <span className="mt-1 inline-block text-[10px] text-[var(--color-neutral-500)]">
            &#128206; attachment
          </span>
        )}
      </div>
      {timestamp && (
        <span className="px-1 text-[10px] text-[var(--color-neutral-500)]/60">
          {formatTimestamp(timestamp)}
        </span>
      )}
    </motion.div>
  );
}

function ReplyForm({
  threadId,
  onSent,
}: {
  threadId: string;
  onSent: (msg: PortalMessage) => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (body.trim().length === 0 || sending) return;
    setSending(true);
    setError(null);

    const result = await sendPortalReply(threadId, body);

    if (result.ok) {
      setBody("");
      onSent(result.message);
    } else {
      setError(result.error);
    }
    setSending(false);
  }, [body, sending, threadId, onSent]);

  return (
    <div className="mt-3 border-t border-[rgba(253,245,230,0.06)] pt-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="reply…"
        rows={2}
        className="w-full resize-none rounded-lg border border-[rgba(253,245,230,0.06)] bg-[rgba(253,245,230,0.03)] px-3 py-2 text-[13px] text-[var(--color-brand-cream)] placeholder-[var(--color-neutral-500)]/50 outline-none transition-colors focus:border-[var(--color-brand-orange)]/40"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSend();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <div>
          {error && (
            <span className="text-[11px] text-[var(--color-semantic-error)]">
              {error}
            </span>
          )}
        </div>
        <button
          onClick={() => void handleSend()}
          disabled={body.trim().length === 0 || sending}
          className="rounded-full bg-[var(--color-brand-orange)] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[1px] text-[var(--color-neutral-950)] transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {sending ? "sending…" : "send"}
        </button>
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  index,
  onReply,
}: {
  thread: PortalThread;
  index: number;
  onReply: (threadId: string, msg: PortalMessage) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const lastMessage = thread.messages[thread.messages.length - 1];
  const preview = lastMessage ? truncate(lastMessage.bodyText, 120) : "";
  const lastDirection = lastMessage?.direction;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { ...houseSpring, delay: Math.min(index * 0.05, 0.3) }
      }
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex w-full flex-col gap-1 border-b border-[rgba(253,245,230,0.04)] px-1 py-5 text-left transition-colors hover:bg-[rgba(253,245,230,0.02)]"
      >
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[14px] text-[var(--color-brand-cream)]">
              {thread.subject || "no subject"}
            </span>
            {preview && (
              <span className="mt-1 block text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
                <span className="text-[var(--color-brand-cream)]/50">
                  {lastDirection === "inbound" ? "you: " : "Andy: "}
                </span>
                {preview}
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[11px] text-[var(--color-neutral-500)]">
              {formatTimestamp(thread.lastMessageAtMs)}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-[1px] text-[var(--color-neutral-500)]/50">
                {channelLabel(thread.channel)}
              </span>
              <span className="text-[11px] tabular-nums text-[var(--color-neutral-500)]">
                {thread.messages.length}
              </span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className={`text-[var(--color-neutral-500)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              >
                <path
                  d="M2 3.5L5 6.5L8 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="overflow-hidden"
          >
            <div className="border-b border-[rgba(253,245,230,0.04)] bg-[rgba(253,245,230,0.015)] px-4 py-5">
              <div className="space-y-3">
                {thread.messages.map((msg, i) => (
                  <MessageBubble key={msg.id} message={msg} index={i} />
                ))}
              </div>
              <ReplyForm
                threadId={thread.id}
                onSent={(msg) => onReply(thread.id, msg)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NewThreadForm({
  onCreated,
}: {
  onCreated: (thread: PortalThread) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleSend = useCallback(async () => {
    if (subject.trim().length === 0 || body.trim().length === 0 || sending) return;
    setSending(true);
    setError(null);

    const result = await startPortalThread(subject, body);

    if (result.ok) {
      setSubject("");
      setBody("");
      setOpen(false);
      onCreated(result.thread);
    } else {
      setError(result.error);
    }
    setSending(false);
  }, [subject, body, sending, onCreated]);

  return (
    <div className="pb-4 pt-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="overflow-hidden"
          >
            <div className="mb-4 rounded-lg border border-[rgba(253,245,230,0.06)] bg-[rgba(253,245,230,0.02)] p-4">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="subject"
                className="mb-3 w-full border-b border-[rgba(253,245,230,0.06)] bg-transparent pb-2 text-[14px] text-[var(--color-brand-cream)] placeholder-[var(--color-neutral-500)]/50 outline-none"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="your message…"
                rows={3}
                className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-[var(--color-brand-cream)] placeholder-[var(--color-neutral-500)]/50 outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setSubject("");
                      setBody("");
                      setError(null);
                    }}
                    className="text-[11px] text-[var(--color-neutral-500)] transition-colors hover:text-[var(--color-brand-cream)]"
                  >
                    cancel
                  </button>
                  {error && (
                    <span className="text-[11px] text-[var(--color-semantic-error)]">
                      {error}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => void handleSend()}
                  disabled={
                    subject.trim().length === 0 ||
                    body.trim().length === 0 ||
                    sending
                  }
                  className="rounded-full bg-[var(--color-brand-orange)] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[1px] text-[var(--color-neutral-950)] transition-opacity hover:opacity-90 disabled:opacity-30"
                >
                  {sending ? "sending…" : "send"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          initial={shouldReduceMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { ...houseSpring, delay: 0.2 }
          }
          onClick={() => setOpen(true)}
          className="rounded-full border border-[rgba(253,245,230,0.08)] bg-[var(--color-neutral-800)] px-4 py-2 text-[11px] uppercase tracking-[1px] text-[var(--color-brand-cream)] transition-colors hover:bg-[var(--color-neutral-700)]"
        >
          new message
        </motion.button>
      )}
    </div>
  );
}

function MessagesEmpty({
  onCreated,
}: {
  onCreated: (thread: PortalThread) => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6">
      <p
        className="text-center font-[family-name:var(--font-playfair-display)] text-[15px] italic text-[var(--color-neutral-500)]"
        data-ambient-slot="portal_messages_empty"
      >
        no messages yet. start a thread below.
      </p>
      <NewThreadForm onCreated={onCreated} />
    </div>
  );
}

export function PortalMessagesView({
  threads: initialThreads,
}: {
  threads: PortalThread[];
}) {
  const shouldReduceMotion = useReducedMotion();
  const [threads, setThreads] = useState(initialThreads);

  const handleReply = useCallback(
    (threadId: string, msg: PortalMessage) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                messages: [...t.messages, msg],
                lastMessageAtMs: msg.sentAtMs ?? Date.now(),
              }
            : t,
        ),
      );
    },
    [],
  );

  const handleNewThread = useCallback((thread: PortalThread) => {
    setThreads((prev) => [thread, ...prev]);
  }, []);

  return (
    <div className="mx-auto max-w-[780px] px-4 md:px-8">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
        className="flex flex-col gap-2 border-b border-[rgba(253,245,230,0.06)] pb-7 pt-10 sm:flex-row sm:items-end sm:justify-between sm:gap-0"
      >
        <div>
          <span className="mb-2 block font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
            comms
          </span>
          <h1 className="font-[family-name:var(--font-black-han-sans)] text-3xl leading-none text-[var(--color-brand-cream)] sm:text-4xl">
            Messages
          </h1>
        </div>
        <span className="font-[family-name:var(--font-playfair-display)] text-[14px] italic text-[var(--color-neutral-500)] sm:text-[15px]">
          {threads.length > 0
            ? `${threads.length} ${threads.length === 1 ? "thread" : "threads"}`
            : "your thread with Andy."}
        </span>
      </motion.div>

      {threads.length === 0 ? (
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { ...houseSpring, delay: 0.15 }
          }
        >
          <MessagesEmpty onCreated={handleNewThread} />
        </motion.div>
      ) : (
        <>
          <NewThreadForm onCreated={handleNewThread} />
          <div className="pb-12">
            {threads.map((thread, i) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                index={i}
                onReply={handleReply}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
