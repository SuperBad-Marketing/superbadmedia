"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  Mail,
  Check,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getPendingApprovalsAction,
  approveReplyAction,
  skipReplyAction,
  type PendingItem,
} from "../reply-actions";

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

const CLASSIFICATION_COLORS: Record<string, string> = {
  lead: "var(--color-brand-pink)",
  complaint: "var(--color-brand-red)",
  collab: "var(--color-brand-orange)",
  question: "#60a5fa",
  praise: "var(--color-success)",
  spam: "var(--color-neutral-600)",
  simple: "var(--color-neutral-500)",
};

export function PendingApprovals() {
  const [comments, setComments] = useState<PendingItem[]>([]);
  const [messages, setMessages] = useState<PendingItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPendingApprovalsAction().then((result) => {
      if (!cancelled && result.ok) {
        setComments(result.value.comments);
        setMessages(result.value.messages);
      }
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleApproved(id: string, type: "comment" | "dm") {
    if (type === "comment") {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-[100px] animate-pulse rounded-xl"
            style={{ backgroundColor: "var(--color-neutral-900)" }}
          />
        ))}
      </div>
    );
  }

  if (comments.length === 0 && messages.length === 0) return null;

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <PendingSection
          title="Comments awaiting approval"
          icon={<MessageCircle className="size-4" strokeWidth={1.5} />}
          items={comments}
          onApproved={handleApproved}
        />
      )}
      {messages.length > 0 && (
        <PendingSection
          title="Messages awaiting approval"
          icon={<Mail className="size-4" strokeWidth={1.5} />}
          items={messages}
          onApproved={handleApproved}
        />
      )}
    </div>
  );
}

function PendingSection({
  title,
  icon,
  items,
  onApproved,
}: {
  title: string;
  icon: React.ReactNode;
  items: PendingItem[];
  onApproved: (id: string, type: "comment" | "dm") => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(242, 140, 82, 0.15)",
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[color:var(--color-brand-orange)]">{icon}</span>
          <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
            {title}
          </span>
          <span
            className="flex size-5 items-center justify-center rounded-full font-[family-name:var(--font-label)] text-[9px] tabular-nums"
            style={{
              backgroundColor: "rgba(242, 140, 82, 0.15)",
              color: "var(--color-brand-orange)",
            }}
          >
            {items.length}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown
            className="size-4 text-[color:var(--color-neutral-600)]"
            strokeWidth={1.5}
          />
        ) : (
          <ChevronUp
            className="size-4 text-[color:var(--color-neutral-600)]"
            strokeWidth={1.5}
          />
        )}
      </button>

      {!collapsed && (
        <div
          className="border-t px-5 pb-4 pt-1"
          style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
        >
          <div className="divide-y" style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}>
            {items.map((item) => (
              <PendingItemCard
                key={item.id}
                item={item}
                onApproved={() => onApproved(item.id, item.replyType)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingItemCard({
  item,
  onApproved,
}: {
  item: PendingItem;
  onApproved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.draftText);
  const [approving, setApproving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  async function handleApprove() {
    setApproving(true);
    const text = editing ? editText.trim() : undefined;
    const result = await approveReplyAction(item.id, text);
    if (result.ok) {
      toast.success("Approved.");
      onApproved();
    } else {
      toast.error(result.error);
    }
    setApproving(false);
  }

  async function handleSkip() {
    setSkipping(true);
    const result = await skipReplyAction(item.id);
    if (result.ok) {
      toast.success("Skipped.");
      onApproved();
    } else {
      toast.error(result.error);
    }
    setSkipping(false);
  }

  const classColor =
    CLASSIFICATION_COLORS[item.classification ?? ""] ?? "var(--color-neutral-600)";

  return (
    <div className="py-3">
      {/* Inbound */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.inboundAuthor && (
              <span className="font-[family-name:var(--font-body)] text-[12px] font-medium text-[color:var(--color-brand-cream)]">
                @{item.inboundAuthor}
              </span>
            )}
            {item.classification && (
              <span
                className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                style={{
                  letterSpacing: "0.8px",
                  backgroundColor: `color-mix(in srgb, ${classColor} 15%, transparent)`,
                  color: classColor,
                }}
              >
                {item.classification}
              </span>
            )}
            <span className="ml-auto font-[family-name:var(--font-body)] text-[10px] tabular-nums text-[color:var(--color-neutral-600)]">
              {timeAgo(item.createdAtMs)}
            </span>
          </div>
          <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
            {item.inboundText}
          </p>
        </div>
      </div>

      {/* Draft response */}
      <div
        className="mt-2 rounded-lg px-3 py-2"
        style={{ backgroundColor: "rgba(253, 245, 230, 0.03)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]"
            style={{ letterSpacing: "0.8px" }}
          >
            Draft reply
          </span>
          <button
            onClick={() => {
              setEditing(!editing);
              setEditText(item.draftText);
            }}
            className="text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-cream)]"
          >
            <Pencil className="size-3" strokeWidth={1.5} />
          </button>
        </div>
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-md border bg-transparent px-2 py-1.5 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-brand-cream)] outline-none focus:border-[color:var(--color-brand-pink)]"
            style={{ borderColor: "rgba(253, 245, 230, 0.1)" }}
          />
        ) : (
          <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-300)]">
            {item.draftText}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          onClick={handleSkip}
          disabled={skipping || approving}
          className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-neutral-400)] disabled:opacity-40"
        >
          {skipping ? "Skipping…" : "Skip"}
        </button>
        <button
          onClick={handleApprove}
          disabled={approving || skipping}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity disabled:opacity-40"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
          }}
        >
          {approving ? (
            <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
          ) : (
            <Check className="size-3" strokeWidth={1.5} />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}
