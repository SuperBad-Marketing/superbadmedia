"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Loader2,
  MessageSquareOff,
  Trash2,
  Volume1,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import {
  getCleanupCandidatesAction,
  cleanupInboxAction,
  getAgeCandidatesAction,
  cleanupOldThreadsAction,
  getReadNoiseCandidatesAction,
  emptyTrashAction,
  getTrashCountAction,
  type CleanupCandidate,
  type AgeCandidate,
  type ReadNoiseCandidate,
} from "../_actions/delete";

const CLEANUP_TABS = [
  { id: "old", label: "Old threads", icon: Calendar },
  { id: "read-noise", label: "Read noise", icon: Volume1 },
  { id: "junk", label: "Noise & spam", icon: MessageSquareOff },
  { id: "trash", label: "Empty trash", icon: Trash2 },
] as const;

type CleanupTab = (typeof CLEANUP_TABS)[number]["id"];

function formatRelativeTime(ms: number, now: number): string {
  const diff = now - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDaysAgo(ms: number, now: number): string {
  const days = Math.floor((now - ms) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days}d ago`;
}

const checkboxCx =
  "h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-[color:var(--color-neutral-500)] bg-transparent accent-[color:var(--color-accent-cta)]";

// ── Shared thread row ─────────────────────────────────────────────────

function ThreadRow({
  threadId,
  subject,
  senderLabel,
  messageCount,
  lastMessageAtMs,
  badge,
  checked,
  onToggle,
  now,
}: {
  threadId: string;
  subject: string | null;
  senderLabel: string;
  messageCount: number;
  lastMessageAtMs: number;
  badge?: React.ReactNode;
  checked: boolean;
  onToggle: (id: string) => void;
  now: number;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-surface-2)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(threadId)}
        className={cn("mt-0.5", checkboxCx)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
            {subject ?? "(no subject)"}
          </span>
          {badge}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
          <span className="truncate">{senderLabel}</span>
          <span>·</span>
          <span className="shrink-0">
            {messageCount} msg{messageCount !== 1 && "s"}
          </span>
          <span>·</span>
          <span className="shrink-0">
            {formatRelativeTime(lastMessageAtMs, now)}
          </span>
        </div>
      </div>
    </label>
  );
}

// ── Old Threads tab ───────────────────────────────────────────────────

function OldThreadsTab({ now, onClose }: { now: number; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [candidates, setCandidates] = React.useState<AgeCandidate[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState(60);

  const loadCandidates = React.useCallback(
    async (d: number) => {
      setLoading(true);
      setError(null);
      const result = await getAgeCandidatesAction({ olderThanDays: d });
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCandidates(result.candidates);
      setSelected(new Set(result.candidates.map((c) => c.threadId)));
    },
    [],
  );

  React.useEffect(() => {
    loadCandidates(days);
  }, [days, loadCandidates]);

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (prev.size === candidates.length) return new Set();
      return new Set(candidates.map((c) => c.threadId));
    });
  }, [candidates]);

  const handleCleanup = React.useCallback(async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const result = await cleanupOldThreadsAction({ threadIds: [...selected] });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Trashed ${result.deletedThreads} old thread${result.deletedThreads === 1 ? "" : "s"} (${result.deletedMessages} messages).`,
    );
    router.refresh();
    onClose();
  }, [selected, router, onClose]);

  const priorityBadge = (pc: string) => (
    <span
      className={cn(
        "shrink-0 rounded-sm px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[10px] uppercase",
        pc === "spam"
          ? "bg-red-500/15 text-red-400"
          : pc === "noise"
            ? "bg-amber-500/15 text-amber-400"
            : "bg-emerald-500/15 text-emerald-400",
      )}
    >
      {pc}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[color:var(--color-neutral-700)]/50 px-5 py-3">
        <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
          Older than
        </span>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-sm border border-[color:var(--color-neutral-600)] bg-[color:var(--color-surface-2)] px-2 py-1 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]"
        >
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
          <option value={180}>6 months</option>
          <option value={365}>1 year</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && candidates.length === 0 && (
          <EmptyState message="No threads older than this. Inbox is fresh." />
        )}
        {!loading && !error && candidates.length > 0 && (
          <div className="divide-y divide-[color:var(--color-neutral-700)]/50">
            <SelectAllRow
              total={candidates.length}
              selectedCount={selected.size}
              onToggle={toggleAll}
            />
            {candidates.map((c) => (
              <ThreadRow
                key={c.threadId}
                threadId={c.threadId}
                subject={c.subject}
                senderLabel={c.senderLabel}
                messageCount={c.messageCount}
                lastMessageAtMs={c.lastMessageAtMs}
                badge={priorityBadge(c.priorityClass)}
                checked={selected.has(c.threadId)}
                onToggle={toggle}
                now={now}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && !error && candidates.length > 0 && (
        <CleanupFooter
          selectedCount={selected.size}
          total={candidates.length}
          deleting={deleting}
          onCleanup={handleCleanup}
          label="Trash selected"
          deletingLabel="Trashing…"
        />
      )}
    </>
  );
}

// ── Read Noise tab ────────────────────────────────────────────────────

function ReadNoiseTab({ now, onClose }: { now: number; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [candidates, setCandidates] = React.useState<ReadNoiseCandidate[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getReadNoiseCandidatesAction().then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCandidates(result.candidates);
      setSelected(new Set(result.candidates.map((c) => c.threadId)));
    });
  }, []);

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (prev.size === candidates.length) return new Set();
      return new Set(candidates.map((c) => c.threadId));
    });
  }, [candidates]);

  const handleCleanup = React.useCallback(async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const result = await cleanupInboxAction({ threadIds: [...selected] });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Trashed ${result.deletedThreads} read noise thread${result.deletedThreads === 1 ? "" : "s"}.`,
    );
    router.refresh();
    onClose();
  }, [selected, router, onClose]);

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && candidates.length === 0 && (
          <EmptyState message="No read noise threads to clean up." />
        )}
        {!loading && !error && candidates.length > 0 && (
          <div className="divide-y divide-[color:var(--color-neutral-700)]/50">
            <SelectAllRow
              total={candidates.length}
              selectedCount={selected.size}
              onToggle={toggleAll}
            />
            {candidates.map((c) => (
              <ThreadRow
                key={c.threadId}
                threadId={c.threadId}
                subject={c.subject}
                senderLabel={c.senderLabel}
                messageCount={c.messageCount}
                lastMessageAtMs={c.lastMessageAtMs}
                checked={selected.has(c.threadId)}
                onToggle={toggle}
                now={now}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && !error && candidates.length > 0 && (
        <CleanupFooter
          selectedCount={selected.size}
          total={candidates.length}
          deleting={deleting}
          onCleanup={handleCleanup}
          label="Trash selected"
          deletingLabel="Trashing…"
        />
      )}
    </>
  );
}

// ── Junk tab (existing noise/spam) ────────────────────────────────────

function JunkTab({ now, onClose }: { now: number; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [candidates, setCandidates] = React.useState<CleanupCandidate[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getCleanupCandidatesAction().then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCandidates(result.candidates);
      setSelected(new Set(result.candidates.map((c) => c.threadId)));
    });
  }, []);

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (prev.size === candidates.length) return new Set();
      return new Set(candidates.map((c) => c.threadId));
    });
  }, [candidates]);

  const handleCleanup = React.useCallback(async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const result = await cleanupInboxAction({ threadIds: [...selected] });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Cleaned up ${result.deletedThreads} thread${result.deletedThreads === 1 ? "" : "s"} (${result.deletedMessages} messages trashed).`,
    );
    router.refresh();
    onClose();
  }, [selected, router, onClose]);

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && candidates.length === 0 && (
          <EmptyState message="Nothing to clean up. Inbox is tidy." />
        )}
        {!loading && !error && candidates.length > 0 && (
          <div className="divide-y divide-[color:var(--color-neutral-700)]/50">
            <SelectAllRow
              total={candidates.length}
              selectedCount={selected.size}
              onToggle={toggleAll}
            />
            {candidates.map((c) => (
              <ThreadRow
                key={c.threadId}
                threadId={c.threadId}
                subject={c.subject}
                senderLabel={c.senderLabel}
                messageCount={c.messageCount}
                lastMessageAtMs={c.lastMessageAtMs}
                badge={
                  <span
                    className={cn(
                      "shrink-0 rounded-sm px-1.5 py-0.5 font-[family-name:var(--font-righteous)] text-[10px] uppercase",
                      c.priorityClass === "spam"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-400",
                    )}
                  >
                    {c.priorityClass}
                  </span>
                }
                checked={selected.has(c.threadId)}
                onToggle={toggle}
                now={now}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && !error && candidates.length > 0 && (
        <CleanupFooter
          selectedCount={selected.size}
          total={candidates.length}
          deleting={deleting}
          onCleanup={handleCleanup}
          label="Trash selected"
          deletingLabel="Trashing…"
        />
      )}
    </>
  );
}

// ── Empty Trash tab ───────────────────────────────────────────────────

function EmptyTrashTab({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getTrashCountAction().then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCount(result.count);
    });
  }, []);

  const handleEmpty = React.useCallback(async () => {
    setDeleting(true);
    const result = await emptyTrashAction();
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Permanently deleted ${result.hardDeleted} message${result.hardDeleted === 1 ? "" : "s"}.`,
    );
    router.refresh();
    onClose();
  }, [router, onClose]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && count === 0 && (
          <EmptyState message="Trash is already empty." />
        )}
        {!loading && !error && count > 0 && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <Trash2
                size={22}
                strokeWidth={1.5}
                className="text-red-400"
              />
            </div>
            <p className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
              {count} message{count !== 1 && "s"} in trash
            </p>
            <p className="mt-1 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
              This permanently deletes all trashed messages. Can't be undone.
            </p>
          </div>
        )}
      </div>

      {!loading && !error && count > 0 && (
        <footer className="flex items-center justify-end border-t border-[color:var(--color-neutral-700)] px-5 py-4">
          <button
            type="button"
            onClick={handleEmpty}
            disabled={deleting}
            className={cn(
              "flex items-center gap-2 rounded-sm px-4 py-2",
              "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]",
              "outline-none transition-colors",
              "bg-red-500/15 text-red-400 hover:bg-red-500/25",
              "focus-visible:ring-2 focus-visible:ring-red-500/50",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden />
            {deleting ? "Emptying…" : "Empty trash permanently"}
          </button>
        </footer>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2
        size={20}
        className="animate-spin text-[color:var(--color-neutral-400)]"
      />
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-red-400">
      {message}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-300)]">
        {message}
      </p>
    </div>
  );
}

function SelectAllRow({
  total,
  selectedCount,
  onToggle,
}: {
  total: number;
  selectedCount: number;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-surface-2)]">
      <input
        type="checkbox"
        checked={selectedCount === total}
        onChange={onToggle}
        className={checkboxCx}
      />
      <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-200)]">
        Select all ({total})
      </span>
    </label>
  );
}

function CleanupFooter({
  selectedCount,
  total,
  deleting,
  onCleanup,
  label,
  deletingLabel,
}: {
  selectedCount: number;
  total: number;
  deleting: boolean;
  onCleanup: () => void;
  label: string;
  deletingLabel: string;
}) {
  return (
    <footer className="flex items-center justify-between border-t border-[color:var(--color-neutral-700)] px-5 py-4">
      <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
        {selectedCount} of {total} selected
      </span>
      <button
        type="button"
        onClick={onCleanup}
        disabled={deleting || selectedCount === 0}
        className={cn(
          "flex items-center gap-2 rounded-sm px-4 py-2",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]",
          "outline-none transition-colors",
          "bg-red-500/15 text-red-400 hover:bg-red-500/25",
          "focus-visible:ring-2 focus-visible:ring-red-500/50",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        {deleting ? deletingLabel : label}
      </button>
    </footer>
  );
}

// ── Main modal ────────────────────────────────────────────────────────

export function CleanupModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<CleanupTab>("old");
  const now = Date.now();

  React.useEffect(() => {
    if (open) setActiveTab("old");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cleanup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={houseSpring}
            className={cn(
              "relative flex max-h-[80vh] w-full max-w-[620px] flex-col overflow-hidden rounded-md",
              "border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]",
              "shadow-2xl shadow-black/40",
            )}
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-[color:var(--color-neutral-700)] px-5 py-4">
              <Trash2
                size={18}
                strokeWidth={1.5}
                className="shrink-0 text-[color:var(--color-brand-pink)]"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-[family-name:var(--font-display)] text-[20px] leading-tight text-[color:var(--color-brand-cream)]">
                  Inbox cleanup
                </h2>
                <p className="mt-0.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
                  Bulk cleanup tools, review before trashing.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-sm p-1 text-[color:var(--color-neutral-400)] outline-none transition-colors hover:text-[color:var(--color-neutral-100)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </header>

            {/* Tabs */}
            <nav className="flex border-b border-[color:var(--color-neutral-700)]">
              {CLEANUP_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 px-3 py-2.5",
                      "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                      "outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-accent-cta)]",
                      isActive
                        ? "border-b-2 border-[color:var(--color-brand-pink)] text-[color:var(--color-neutral-100)]"
                        : "text-[color:var(--color-neutral-400)] hover:text-[color:var(--color-neutral-200)]",
                    )}
                  >
                    <Icon size={14} strokeWidth={1.75} aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Tab content */}
            <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden">
              {activeTab === "old" && (
                <OldThreadsTab now={now} onClose={onClose} />
              )}
              {activeTab === "read-noise" && (
                <ReadNoiseTab now={now} onClose={onClose} />
              )}
              {activeTab === "junk" && (
                <JunkTab now={now} onClose={onClose} />
              )}
              {activeTab === "trash" && <EmptyTrashTab onClose={onClose} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
