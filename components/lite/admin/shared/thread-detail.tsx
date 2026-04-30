"use client";

import * as React from "react";
import Link from "next/link";
import type { MessageRow } from "@/lib/db/schema/messages";
import { trimQuotedContent } from "@/lib/channels/email/trim-quoted";
import { generateDraftReply, sendThreadReply } from "@/app/lite/admin/comms/actions";

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

function MessageBubble({
  msg,
  isLatest,
}: {
  msg: MessageRow;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const isInbound = msg.direction === "inbound";
  const ts = msg.sent_at_ms ?? msg.received_at_ms ?? msg.created_at_ms;

  const rawBody = msg.body_text ?? "";
  const trimmedBody = trimQuotedContent(rawBody);
  const wasTrimmed = trimmedBody.length < rawBody.trim().length - 20;
  const displayBody = expanded ? rawBody.trim() : trimmedBody;

  return (
    <div
      className="flex flex-col gap-1.5 px-5 py-4"
      style={{
        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
        background: isLatest && isInbound
          ? "rgba(244, 160, 176, 0.02)"
          : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{
            letterSpacing: "1.5px",
            background: isInbound
              ? "rgba(244, 160, 176, 0.10)"
              : "rgba(123, 174, 126, 0.10)",
            color: isInbound
              ? "var(--color-brand-pink)"
              : "var(--color-success)",
          }}
        >
          {isInbound ? "Received" : "Sent"}
        </span>
        <span className="text-[10px] text-[color:var(--color-neutral-500)]">
          {formatDate(ts)} at {formatTime(ts)}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] text-[color:var(--color-neutral-500)]">
          {isInbound
            ? msg.from_address
            : `→ ${(msg.to_addresses as string[])?.[0] ?? "—"}`}
        </span>
      </div>
      {msg.subject && (
        <p className="font-[family-name:var(--font-body)] text-[12px] font-medium text-[color:var(--color-brand-cream)]">
          {msg.subject}
        </p>
      )}
      <div className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]">
        {displayBody}
      </div>
      {wasTrimmed && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 self-start font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.2px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {expanded ? "Hide quoted" : "Show full email"}
        </button>
      )}
    </div>
  );
}

function ReplyComposer({
  threadId,
  onSent,
}: {
  threadId: string;
  onSent: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [drafting, setDrafting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  async function handleDraft() {
    setDrafting(true);
    setError(null);
    const result = await generateDraftReply(threadId);
    setDrafting(false);
    if (result.ok && result.draft) {
      setBody(result.draft);
      textareaRef.current?.focus();
    } else {
      setError(result.error ?? "Failed to generate draft");
    }
  }

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const result = await sendThreadReply(threadId, body.trim());
    setSending(false);
    if (result.ok) {
      setBody("");
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSent();
      }, 1500);
    } else {
      setError(result.error ?? "Send failed");
    }
  }

  const busy = drafting || sending;

  return (
    <div
      className="px-5 py-4"
      style={{ borderTop: "1px solid rgba(253, 245, 230, 0.06)" }}
    >
      <p
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.8px" }}
      >
        Reply
      </p>

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={busy}
        placeholder="Type your reply..."
        rows={5}
        className="mt-2 w-full resize-y rounded-[8px] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)]"
        style={{
          background: "rgba(15, 15, 14, 0.5)",
          border: "1px solid rgba(253, 245, 230, 0.08)",
          outline: "none",
          transition: "border-color 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          minHeight: 100,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(244, 160, 176, 0.3)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.08)";
        }}
      />

      {error && (
        <p className="mt-2 text-[12px] text-[color:var(--color-brand-red)]">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-2 text-[12px] text-[color:var(--color-success)]">
          Reply sent.
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleDraft()}
          disabled={busy}
          className="rounded-full px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            letterSpacing: "1.5px",
            background: "rgba(244, 160, 176, 0.10)",
            color: "var(--color-brand-pink)",
            border: "1px solid rgba(244, 160, 176, 0.15)",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {drafting ? "Drafting..." : "Draft reply"}
        </button>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={busy || !body.trim()}
          className="rounded-full px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            letterSpacing: "1.5px",
            background: body.trim() && !busy
              ? "rgba(178, 40, 72, 0.85)"
              : "rgba(178, 40, 72, 0.25)",
            color: body.trim() && !busy
              ? "var(--color-brand-cream)"
              : "var(--color-neutral-500)",
            border: "none",
            cursor: busy || !body.trim() ? "default" : "pointer",
          }}
        >
          {sending ? "Sending..." : "Send"}
        </button>

        {body.trim() && !busy && (
          <button
            type="button"
            onClick={() => setBody("")}
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "1.2px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function ThreadDetail({
  threadId,
  threadSubject,
  messages: msgs,
  backHref,
}: {
  threadId: string;
  threadSubject: string;
  messages: MessageRow[];
  backHref: string;
}) {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  return (
    <div className="space-y-0 px-4 pb-10">
      <div className="mb-4">
        <Link
          href={backHref}
          scroll={false}
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.8px" }}
        >
          ← All threads
        </Link>
      </div>
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
            {threadSubject}
          </h2>
          <span
            className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {msgs.length} message{msgs.length === 1 ? "" : "s"}
          </span>
        </div>
        <div>
          {msgs.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isLatest={i === msgs.length - 1}
            />
          ))}
          {msgs.length === 0 && (
            <div className="px-8 py-10 text-center">
              <p className="text-[13px] italic text-[color:var(--color-neutral-500)]">
                No messages in this thread.
              </p>
            </div>
          )}
        </div>

        <ReplyComposer
          threadId={threadId}
          onSent={forceUpdate}
        />
      </div>
    </div>
  );
}
