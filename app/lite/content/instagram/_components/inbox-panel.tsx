"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Check, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { getInboxAction, approveReplyAction, skipReplyAction, type InboxThread } from "../reply-actions";

const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "var(--color-brand-orange)" },
  praise: { label: "Praise", color: "#7BAE7E" },
  question: { label: "Question", color: "var(--color-brand-pink)" },
  complaint: { label: "Complaint", color: "var(--color-brand-red)" },
  collab: { label: "Collab", color: "var(--color-brand-pink)" },
  simple: { label: "Simple", color: "var(--color-neutral-500)" },
  spam: { label: "Spam", color: "var(--color-neutral-600)" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_review: { label: "Needs review", color: "var(--color-brand-orange)" },
  approved: { label: "Approved", color: "var(--color-brand-pink)" },
  sent: { label: "Replied", color: "#7BAE7E" },
  escalated: { label: "Escalated", color: "var(--color-brand-red)" },
  skipped: { label: "Skipped", color: "var(--color-neutral-600)" },
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function InboxPanel() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInboxAction(50).then((result) => {
      if (!cancelled && result.ok) setThreads(result.value);
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleApprove(messageId: string, threadConvId: string) {
    setActing(messageId);
    const result = await approveReplyAction(messageId);
    if (result.ok) {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.conversationId !== threadConvId) return t;
          return {
            ...t,
            latestStatus: "sent",
            messages: t.messages.map((m) =>
              m.id === messageId ? { ...m, status: "sent" } : m,
            ),
          };
        }),
      );
      toast.success("Reply sent.");
    } else {
      toast.error(result.error);
    }
    setActing(null);
  }

  async function handleSkip(messageId: string, threadConvId: string) {
    setActing(messageId);
    const result = await skipReplyAction(messageId);
    if (result.ok) {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.conversationId !== threadConvId) return t;
          return {
            ...t,
            messages: t.messages.map((m) =>
              m.id === messageId ? { ...m, status: "skipped" } : m,
            ),
          };
        }),
      );
    } else {
      toast.error(result.error);
    }
    setActing(null);
  }

  if (!loaded) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-lg"
            style={{ backgroundColor: "var(--color-neutral-800)" }}
          />
        ))}
      </div>
    );
  }

  const pendingThreads = threads.filter((t) =>
    t.messages.some((m) => m.status === "pending_review"),
  );

  if (threads.length === 0) {
    return (
      <div
        className="rounded-xl border py-12 text-center"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <Mail
          className="mx-auto mb-3 size-8 text-[color:var(--color-neutral-700)]"
          strokeWidth={1}
        />
        <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)] text-pretty">
          No DMs yet. Conversations will appear here as the poller picks them up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      {pendingThreads.length > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-2"
          style={{
            backgroundColor: "rgba(242, 140, 82, 0.08)",
            border: "1px solid rgba(242, 140, 82, 0.15)",
          }}
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: "var(--color-brand-orange)" }}
          />
          <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-orange)]">
            {pendingThreads.length} conversation{pendingThreads.length !== 1 ? "s" : ""} need{pendingThreads.length === 1 ? "s" : ""} review
          </span>
        </div>
      )}

      {/* Thread list */}
      <div className="space-y-2">
        {threads.map((thread) => {
          const isExpanded = expandedThread === thread.conversationId;
          const cls = CLASSIFICATION_CONFIG[thread.latestClassification ?? ""];
          const hasPending = thread.messages.some((m) => m.status === "pending_review");

          return (
            <div
              key={thread.conversationId}
              className="rounded-xl border"
              style={{
                backgroundColor: "var(--color-neutral-900)",
                borderColor: hasPending
                  ? "rgba(242, 140, 82, 0.2)"
                  : "rgba(253, 245, 230, 0.06)",
              }}
            >
              {/* Thread header */}
              <button
                onClick={() => setExpandedThread(isExpanded ? null : thread.conversationId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} conversation with ${thread.author ?? "unknown"}`}
              >
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[11px] text-[color:var(--color-brand-cream)]"
                  style={{ backgroundColor: "var(--color-neutral-800)" }}
                >
                  {(thread.author ?? "?")[0].toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                      {thread.author ? `@${thread.author}` : "Unknown"}
                    </span>
                    {cls && (
                      <span
                        className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                        style={{
                          letterSpacing: "0.8px",
                          backgroundColor: `color-mix(in srgb, ${cls.color} 12%, transparent)`,
                          color: cls.color,
                        }}
                      >
                        {cls.label}
                      </span>
                    )}
                    {hasPending && (
                      <span
                        className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                        style={{
                          letterSpacing: "0.8px",
                          backgroundColor: "rgba(242, 140, 82, 0.12)",
                          color: "var(--color-brand-orange)",
                        }}
                      >
                        Needs review
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
                    {thread.lastMessageText}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-600)]">
                    {timeAgo(thread.lastMessageAtMs)}
                  </span>
                  {thread.messageCount > 1 && (
                    <span className="font-[family-name:var(--font-label)] text-[9px] tabular-nums text-[color:var(--color-neutral-600)]">
                      {thread.messageCount}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="size-4 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
                  ) : (
                    <ChevronDown className="size-4 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
                  )}
                </div>
              </button>

              {/* Expanded messages */}
              {isExpanded && (
                <div
                  className="space-y-0 border-t px-4 py-2"
                  style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
                >
                  {thread.messages.map((msg) => {
                    const msgStatus = STATUS_LABELS[msg.status];
                    const isPending = msg.status === "pending_review";

                    return (
                      <div
                        key={msg.id}
                        className="py-3"
                        style={{
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-600)]">
                            {timeAgo(msg.createdAtMs)}
                          </span>
                          {msgStatus && (
                            <span
                              className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                              style={{
                                letterSpacing: "0.8px",
                                backgroundColor: `color-mix(in srgb, ${msgStatus.color} 10%, transparent)`,
                                color: msgStatus.color,
                              }}
                            >
                              {msgStatus.label}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-300)] text-pretty">
                          {msg.inboundText}
                        </p>

                        {(isPending || msg.status === "sent") && (
                          <div
                            className="mt-2 rounded-lg px-3 py-2"
                            style={{ backgroundColor: "rgba(253, 245, 230, 0.03)" }}
                          >
                            <span className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "0.8px" }}>
                              {msg.status === "sent" ? "Sent reply" : "Draft reply"}
                            </span>
                            <p className="mt-0.5 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
                              {msg.finalText ?? msg.draftText}
                            </p>
                          </div>
                        )}

                        {isPending && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(msg.id, thread.conversationId)}
                              disabled={acting === msg.id}
                              className="flex items-center gap-1 rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase transition-opacity disabled:opacity-50"
                              style={{
                                letterSpacing: "0.8px",
                                backgroundColor: "rgba(123, 174, 126, 0.15)",
                                color: "#7BAE7E",
                              }}
                            >
                              <Check className="size-3" strokeWidth={2} />
                              Approve & send
                            </button>
                            <button
                              onClick={() => handleSkip(msg.id, thread.conversationId)}
                              disabled={acting === msg.id}
                              className="rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)] transition-opacity disabled:opacity-50"
                              style={{
                                letterSpacing: "0.8px",
                                backgroundColor: "rgba(253, 245, 230, 0.04)",
                              }}
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
