"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Check, MessageCircle, AlertTriangle, Star, HelpCircle, Handshake, Zap, Ban } from "lucide-react";
import { getCommentsAction, approveReplyAction, skipReplyAction, type CommentItem } from "../reply-actions";

const CLASSIFICATION_CONFIG: Record<string, { label: string; icon: typeof Star; color: string }> = {
  lead: { label: "Lead", icon: Zap, color: "var(--color-brand-orange)" },
  praise: { label: "Praise", icon: Star, color: "#7BAE7E" },
  question: { label: "Question", icon: HelpCircle, color: "var(--color-brand-pink)" },
  complaint: { label: "Complaint", icon: AlertTriangle, color: "var(--color-brand-red)" },
  collab: { label: "Collab", icon: Handshake, color: "var(--color-brand-pink)" },
  simple: { label: "Simple", icon: MessageCircle, color: "var(--color-neutral-500)" },
  spam: { label: "Spam", icon: Ban, color: "var(--color-neutral-600)" },
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

type Filter = "all" | "pending_review" | "sent" | "escalated";

export function CommentsPanel() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCommentsAction(200).then((result) => {
      if (!cancelled && result.ok) setComments(result.value);
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleApprove(id: string) {
    setActing(id);
    const result = await approveReplyAction(id);
    if (result.ok) {
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, status: "sent" } : c));
      toast.success("Reply sent.");
    } else {
      toast.error(result.error);
    }
    setActing(null);
  }

  async function handleSkip(id: string) {
    setActing(id);
    const result = await skipReplyAction(id);
    if (result.ok) {
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, status: "skipped" } : c));
    } else {
      toast.error(result.error);
    }
    setActing(null);
  }

  const filtered = filter === "all" ? comments : comments.filter((c) => c.status === filter);

  const pendingCount = comments.filter((c) => c.status === "pending_review").length;
  const sentCount = comments.filter((c) => c.status === "sent").length;

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "All", count: comments.length },
    { key: "pending_review", label: "Needs review", count: pendingCount },
    { key: "sent", label: "Replied", count: sentCount },
    { key: "escalated", label: "Escalated" },
  ];

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

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors"
            style={{
              letterSpacing: "1px",
              backgroundColor: filter === f.key ? "rgba(244, 160, 176, 0.12)" : "transparent",
              color: filter === f.key ? "var(--color-brand-pink)" : "var(--color-neutral-500)",
            }}
          >
            {f.label}
            {f.count != null && f.count > 0 && (
              <span className="ml-1 tabular-nums">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Comment list */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center"
          style={{
            backgroundColor: "var(--color-neutral-900)",
            borderColor: "rgba(253, 245, 230, 0.06)",
          }}
        >
          <MessageCircle
            className="mx-auto mb-3 size-8 text-[color:var(--color-neutral-700)]"
            strokeWidth={1}
          />
          <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)] text-pretty">
            {filter === "all"
              ? "No comments yet. They’ll appear here once the poller picks them up."
              : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} comments.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((comment) => {
            const cls = CLASSIFICATION_CONFIG[comment.classification ?? ""];
            const status = STATUS_LABELS[comment.status];
            const ClsIcon = cls?.icon ?? MessageCircle;
            const isPending = comment.status === "pending_review";

            return (
              <div
                key={comment.id}
                className="group rounded-xl border px-4 py-3"
                style={{
                  backgroundColor: "var(--color-neutral-900)",
                  borderColor: isPending
                    ? "rgba(242, 140, 82, 0.2)"
                    : "rgba(253, 245, 230, 0.06)",
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Classification icon */}
                  <div
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in srgb, ${cls?.color ?? "var(--color-neutral-600)"} 15%, transparent)` }}
                  >
                    <ClsIcon
                      className="size-3.5"
                      strokeWidth={1.5}
                      style={{ color: cls?.color ?? "var(--color-neutral-500)" }}
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                        {comment.inboundAuthor ? `@${comment.inboundAuthor}` : "Unknown"}
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
                      {status && (
                        <span
                          className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                          style={{
                            letterSpacing: "0.8px",
                            backgroundColor: `color-mix(in srgb, ${status.color} 10%, transparent)`,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-600)]">
                        {timeAgo(comment.createdAtMs)}
                      </span>
                    </div>

                    {/* Their comment */}
                    <p className="mt-1 font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-300)] text-pretty">
                      {comment.inboundText}
                    </p>

                    {/* Draft reply */}
                    {(comment.status === "pending_review" || comment.status === "sent") && (
                      <div
                        className="mt-2 rounded-lg px-3 py-2"
                        style={{ backgroundColor: "rgba(253, 245, 230, 0.03)" }}
                      >
                        <span className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "0.8px" }}>
                          {comment.status === "sent" ? "Sent reply" : "Draft reply"}
                        </span>
                        <p className="mt-0.5 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
                          {comment.finalText ?? comment.draftText}
                        </p>
                      </div>
                    )}

                    {/* Actions for pending */}
                    {isPending && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(comment.id)}
                          disabled={acting === comment.id}
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
                          onClick={() => handleSkip(comment.id)}
                          disabled={acting === comment.id}
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
