import type { MessageRow } from "@/lib/db/schema/messages";
import Link from "next/link";

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

function MessageBubble({ msg }: { msg: MessageRow }) {
  const isInbound = msg.direction === "inbound";
  const ts = msg.sent_at_ms ?? msg.received_at_ms ?? msg.created_at_ms;
  return (
    <div
      className="flex flex-col gap-1 px-5 py-3"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{
            letterSpacing: "1.5px",
            background: isInbound
              ? "rgba(244, 160, 176, 0.10)"
              : "rgba(253, 245, 230, 0.04)",
            color: isInbound
              ? "var(--color-brand-pink)"
              : "var(--color-neutral-500)",
          }}
        >
          {isInbound ? "Inbound" : "Outbound"}
        </span>
        <span className="text-[10px] text-[color:var(--color-neutral-500)]">
          {formatDate(ts)} at {formatTime(ts)}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] text-[color:var(--color-neutral-500)]">
          {isInbound ? msg.from_address : `→ ${(msg.to_addresses as string[])?.[0] ?? "—"}`}
        </span>
      </div>
      {msg.subject && (
        <p className="font-[family-name:var(--font-body)] text-[12px] font-medium text-[color:var(--color-brand-cream)]">
          {msg.subject}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[13px] leading-[1.55] text-[color:var(--color-neutral-300)]">
        {msg.body_text}
      </p>
    </div>
  );
}

export function ThreadDetail({
  threadSubject,
  messages,
  backHref,
}: {
  threadSubject: string;
  messages: MessageRow[];
  backHref: string;
}) {
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
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </span>
        </div>
        <div>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {messages.length === 0 && (
            <div className="px-8 py-10 text-center">
              <p className="text-[13px] italic text-[color:var(--color-neutral-500)]">
                No messages in this thread.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
