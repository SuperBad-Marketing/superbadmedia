"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  X,
  Pencil,
  Send,
  AlertTriangle,
  MessageSquare,
  AtSign,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  approveReplyAction,
  skipReplyAction,
  toggleAutonomyAction,
  type ReplyQueueItem,
  type GraduationStats,
} from "../reply-actions";

// ── Classification badge colors ──────────────────────────────────────────

const CLASSIFICATION_STYLES: Record<string, { bg: string; text: string }> = {
  lead: { bg: "bg-emerald-900/40", text: "text-emerald-400" },
  complaint: { bg: "bg-red-900/40", text: "text-red-400" },
  collab: { bg: "bg-violet-900/40", text: "text-violet-400" },
  question: { bg: "bg-blue-900/40", text: "text-blue-400" },
  praise: { bg: "bg-amber-900/40", text: "text-amber-400" },
  spam: { bg: "bg-neutral-800/40", text: "text-neutral-500" },
  simple: { bg: "bg-neutral-800/40", text: "text-neutral-400" },
};

// ── Props ────────────────────────────────────────────────────────────────

interface Props {
  pending: ReplyQueueItem[];
  sent: ReplyQueueItem[];
  escalated: ReplyQueueItem[];
  stats: GraduationStats | null;
}

export function ReplyQueueClient({ pending, sent, escalated, stats }: Props) {
  const [tab, setTab] = useState<"pending" | "sent" | "escalated">("pending");

  const tabs = [
    { key: "pending" as const, label: "Pending", count: pending.length },
    { key: "escalated" as const, label: "Escalated", count: escalated.length },
    { key: "sent" as const, label: "Sent", count: sent.length },
  ];

  const items = tab === "pending" ? pending : tab === "sent" ? sent : escalated;

  return (
    <div className="mt-6 space-y-6 pb-12">
      {/* ── Graduation panel ────────────────────────────────────── */}
      {stats && <GraduationPanel stats={stats} />}

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[color:var(--color-neutral-800)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-[color:var(--color-brand-red)] text-[color:var(--color-brand-cream)]"
                : "text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-neutral-800)] px-1.5 text-[11px] tabular-nums">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Reply list ──────────────────────────────────────────── */}
      {items.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReplyCard key={item.id} item={item} showActions={tab === "pending" || tab === "escalated"} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: string }) {
  const messages: Record<string, { icon: React.ReactNode; text: string }> = {
    pending: {
      icon: <Check className="h-8 w-8 text-emerald-500/50" />,
      text: "No replies waiting for review.",
    },
    escalated: {
      icon: <AlertTriangle className="h-8 w-8 text-amber-500/50" />,
      text: "No escalated messages.",
    },
    sent: {
      icon: <Send className="h-8 w-8 text-[color:var(--color-brand-pink)]/50" />,
      text: "No replies sent yet.",
    },
  };

  const state = messages[tab] ?? messages.pending;

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {state.icon}
      <p className="text-[14px] text-[color:var(--color-neutral-500)]">
        {state.text}
      </p>
    </div>
  );
}

// ── Reply card ───────────────────────────────────────────────────────────

function ReplyCard({
  item,
  showActions,
}: {
  item: ReplyQueueItem;
  showActions: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.draftText);
  const [loading, setLoading] = useState(false);

  const cls = item.classification ?? "simple";
  const style = CLASSIFICATION_STYLES[cls] ?? CLASSIFICATION_STYLES.simple;

  async function handleApprove() {
    setLoading(true);
    const edited = editing ? editText : undefined;
    const result = await approveReplyAction(item.id, edited);
    setLoading(false);
    if (result.ok) {
      toast.success("Reply sent.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleSkip() {
    setLoading(true);
    const result = await skipReplyAction(item.id);
    setLoading(false);
    if (result.ok) {
      toast("Reply skipped.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const timeAgo = formatTimeAgo(item.createdAtMs);

  return (
    <div className="rounded-lg border border-[color:var(--color-neutral-800)] bg-[color:var(--color-neutral-900)]">
      {/* ── Header row ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[color:var(--color-neutral-800)] px-4 py-3">
        <div className="flex items-center gap-2">
          {item.replyType === "comment" ? (
            <AtSign className="h-3.5 w-3.5 text-[color:var(--color-neutral-500)]" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5 text-[color:var(--color-neutral-500)]" />
          )}
          <span className="text-[12px] font-medium uppercase tracking-wider text-[color:var(--color-neutral-500)]">
            {item.replyType}
          </span>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
        >
          {cls}
        </span>

        {item.inboundAuthor && (
          <span className="text-[13px] text-[color:var(--color-brand-pink)]">
            @{item.inboundAuthor}
          </span>
        )}

        <span className="ml-auto text-[12px] text-[color:var(--color-neutral-600)]">
          {timeAgo}
        </span>
      </div>

      {/* ── Inbound message ───────────────────────────────────── */}
      <div className="px-4 py-3">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-brand-cream)]">
          {item.inboundText}
        </p>
      </div>

      {/* ── Draft / edit area ─────────────────────────────────── */}
      <div className="border-t border-[color:var(--color-neutral-800)] px-4 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Zap className="h-3 w-3 text-[color:var(--color-brand-orange)]" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-neutral-500)]">
            {item.status === "sent" ? "Sent reply" : "AI Draft"}
          </span>
        </div>

        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-950)] px-3 py-2 text-[14px] leading-relaxed text-[color:var(--color-brand-cream)] outline-none focus:border-[color:var(--color-brand-red)]"
          />
        ) : (
          <p className="text-[14px] leading-relaxed text-[color:var(--color-neutral-300)]">
            {item.finalText ?? item.draftText}
          </p>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────────── */}
      {showActions && (
        <div className="flex items-center gap-2 border-t border-[color:var(--color-neutral-800)] px-4 py-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-[color:var(--color-brand-red)] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {editing ? "Send edited" : "Approve & send"}
          </button>

          <button
            onClick={() => {
              setEditing(!editing);
              if (!editing) setEditText(item.draftText);
            }}
            className="flex items-center gap-1.5 rounded-md border border-[color:var(--color-neutral-700)] px-3 py-1.5 text-[13px] text-[color:var(--color-neutral-400)] transition-colors hover:border-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? "Cancel edit" : "Edit"}
          </button>

          <button
            onClick={handleSkip}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-neutral-400)]"
          >
            <X className="h-3.5 w-3.5" />
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

// ── Graduation panel ─────────────────────────────────────────────────────

function GraduationPanel({ stats }: { stats: GraduationStats }) {
  const [expanded, setExpanded] = useState(false);

  const commentReady =
    stats.commentTotal >= stats.graduationWindow &&
    stats.commentEditRate < stats.graduationThreshold;
  const dmReady =
    stats.dmTotal >= stats.graduationWindow &&
    stats.dmEditRate < stats.graduationThreshold;

  return (
    <div className="rounded-lg border border-[color:var(--color-neutral-800)] bg-[color:var(--color-neutral-900)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[color:var(--color-brand-pink)]" />
          <span className="text-[13px] font-medium text-[color:var(--color-brand-cream)]">
            Autonomy Status
          </span>
          <span className="rounded-full bg-[color:var(--color-neutral-800)] px-2 py-0.5 text-[11px] text-[color:var(--color-neutral-400)]">
            Comments: {stats.commentMode} · DMs: {stats.dmMode}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[color:var(--color-neutral-500)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[color:var(--color-neutral-500)]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[color:var(--color-neutral-800)] px-4 py-4 space-y-4">
          <AutonomyRow
            label="Comments"
            mode={stats.commentMode}
            editRate={stats.commentEditRate}
            total={stats.commentTotal}
            threshold={stats.graduationThreshold}
            window={stats.graduationWindow}
            ready={commentReady}
            onToggle={(mode) => toggleAutonomyAction("comment", mode)}
          />
          <AutonomyRow
            label="DMs"
            mode={stats.dmMode}
            editRate={stats.dmEditRate}
            total={stats.dmTotal}
            threshold={stats.graduationThreshold}
            window={stats.graduationWindow}
            ready={dmReady}
            onToggle={(mode) => toggleAutonomyAction("dm", mode)}
          />

          <p className="text-[12px] text-[color:var(--color-neutral-600)]">
            Graduation: edit rate below {(stats.graduationThreshold * 100).toFixed(0)}%
            over the last {stats.graduationWindow} sent replies.
          </p>
        </div>
      )}
    </div>
  );
}

function AutonomyRow({
  label,
  mode,
  editRate,
  total,
  threshold,
  window: gradWindow,
  ready,
  onToggle,
}: {
  label: string;
  mode: string;
  editRate: number;
  total: number;
  threshold: number;
  window: number;
  ready: boolean;
  onToggle: (mode: "draft" | "autonomous") => void;
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    const newMode = mode === "draft" ? "autonomous" : "draft";
    await onToggle(newMode);
    setToggling(false);
    router.refresh();
  }

  const progressPct = Math.min((total / gradWindow) * 100, 100);
  const belowThreshold = editRate < threshold;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[color:var(--color-brand-cream)]">
            {label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              mode === "autonomous"
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-[color:var(--color-neutral-800)] text-[color:var(--color-neutral-400)]"
            }`}
          >
            {mode}
          </span>
        </div>

        <button
          onClick={handleToggle}
          disabled={toggling || (mode === "draft" && !ready)}
          className="rounded-md border border-[color:var(--color-neutral-700)] px-3 py-1 text-[12px] text-[color:var(--color-neutral-400)] transition-colors hover:border-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-40"
        >
          {toggling ? "..." : mode === "draft" ? "Enable autonomous" : "Switch to draft"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-[color:var(--color-neutral-800)]">
          <div
            className={`h-full rounded-full transition-all ${
              belowThreshold
                ? "bg-emerald-500"
                : "bg-[color:var(--color-brand-orange)]"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-[12px] tabular-nums text-[color:var(--color-neutral-500)]">
          {total}/{gradWindow} replies · {(editRate * 100).toFixed(0)}% edited
        </span>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
