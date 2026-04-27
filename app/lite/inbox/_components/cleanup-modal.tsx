"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import {
  getCleanupCandidatesAction,
  cleanupInboxAction,
  type CleanupCandidate,
} from "../_actions/delete";

function formatRelativeTime(ms: number, now: number): string {
  const diff = now - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CleanupModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [candidates, setCandidates] = React.useState<CleanupCandidate[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const now = Date.now();

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSelected(new Set());
    getCleanupCandidatesAction().then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCandidates(result.candidates);
      setSelected(new Set(result.candidates.map((c) => c.threadId)));
    });
  }, [open]);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (prev.size === candidates.length) return new Set();
      return new Set(candidates.map((c) => c.threadId));
    });
  }, [candidates]);

  const toggle = React.useCallback((threadId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }, []);

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
            if (e.target === e.currentTarget && !deleting) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={houseSpring}
            className={cn(
              "relative flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden rounded-md",
              "border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]",
              "shadow-2xl shadow-black/40",
            )}
          >
            <header className="flex items-center gap-3 border-b border-[color:var(--color-neutral-700)] px-5 py-4">
              <Trash2
                size={18}
                strokeWidth={1.5}
                className="shrink-0 text-[color:var(--color-brand-pink)]"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-[family-name:var(--font-display)] text-[20px] leading-tight text-[color:var(--color-brand-cream)]">
                  Clean up inbox
                </h2>
                <p className="mt-0.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
                  Noise and spam threads — review before trashing.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                aria-label="Close"
                className="rounded-sm p-1 text-[color:var(--color-neutral-400)] outline-none transition-colors hover:text-[color:var(--color-neutral-100)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2
                    size={20}
                    className="animate-spin text-[color:var(--color-neutral-400)]"
                  />
                </div>
              )}

              {error && (
                <div className="px-5 py-8 text-center font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-red-400">
                  {error}
                </div>
              )}

              {!loading && !error && candidates.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-300)]">
                    Nothing to clean up. Inbox is tidy.
                  </p>
                </div>
              )}

              {!loading && !error && candidates.length > 0 && (
                <div className="divide-y divide-[color:var(--color-neutral-700)]/50">
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-surface-2)]">
                    <input
                      type="checkbox"
                      checked={selected.size === candidates.length}
                      onChange={toggleAll}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-[color:var(--color-neutral-500)] bg-transparent accent-[color:var(--color-accent-cta)]"
                    />
                    <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-200)]">
                      Select all ({candidates.length})
                    </span>
                  </label>

                  {candidates.map((c) => (
                    <label
                      key={c.threadId}
                      className="flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-surface-2)]"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.threadId)}
                        onChange={() => toggle(c.threadId)}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-[color:var(--color-neutral-500)] bg-transparent accent-[color:var(--color-accent-cta)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
                            {c.subject ?? "(no subject)"}
                          </span>
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
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
                          <span className="truncate">{c.senderLabel}</span>
                          <span>·</span>
                          <span className="shrink-0">
                            {c.messageCount} msg{c.messageCount !== 1 && "s"}
                          </span>
                          <span>·</span>
                          <span className="shrink-0">
                            {formatRelativeTime(c.lastMessageAtMs, now)}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {!loading && !error && candidates.length > 0 && (
              <footer className="flex items-center justify-between border-t border-[color:var(--color-neutral-700)] px-5 py-4">
                <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-400)]">
                  {selected.size} of {candidates.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleCleanup}
                  disabled={deleting || selected.size === 0}
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
                  {deleting ? "Trashing…" : "Trash selected"}
                </button>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
