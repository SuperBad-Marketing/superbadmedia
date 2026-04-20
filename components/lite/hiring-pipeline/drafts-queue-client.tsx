"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  sendInviteDraftAction,
  expireInviteDraftAction,
} from "@/app/lite/admin/hiring/actions";

export interface DraftQueueRow {
  id: string;
  candidate_id: string;
  candidate_name: string;
  role_name: string;
  subject: string;
  body: string;
  confidence: number;
  hold_reason: string | null;
  drift_check_score: number | null;
  drift_check_pass: boolean | null;
  created_at_ms: number;
}

function confidenceChip(confidence: number) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.85
      ? "var(--color-semantic-success, #7BAE7E)"
      : confidence >= 0.6
        ? "var(--color-brand-orange, #F28C52)"
        : "var(--color-brand-red, #B22848)";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {pct}%
    </span>
  );
}

function formatRelativeMs(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface Props {
  rows: DraftQueueRow[];
}

export function DraftsQueueClient({ rows: initialRows }: Props) {
  const [rows, setRows] = React.useState(initialRows);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [actingId, setActingId] = React.useState<string | null>(null);

  async function handleSend(draftId: string) {
    setActingId(draftId);
    const result = await sendInviteDraftAction(draftId);
    if (result.ok) {
      setRows((prev) => prev.filter((r) => r.id !== draftId));
    }
    setActingId(null);
  }

  async function handleArchive(draftId: string) {
    setActingId(draftId);
    const result = await expireInviteDraftAction(draftId);
    if (result.ok) {
      setRows((prev) => prev.filter((r) => r.id !== draftId));
    }
    setActingId(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-brand-charcoal)]">
          Invite Drafts
        </h1>
        <span className="text-sm text-[var(--color-brand-charcoal)]/50">
          {rows.length} awaiting review
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-brand-charcoal)]/50">
          No drafts waiting for review.
        </p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {rows.map((draft) => {
              const isExpanded = expandedId === draft.id;
              const isActing = actingId === draft.id;
              return (
                <motion.div
                  key={draft.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  className="rounded-lg border border-[var(--color-brand-charcoal)]/8 bg-white"
                >
                  <button
                    className="flex w-full items-center gap-4 p-4 text-left"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : draft.id)
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-brand-charcoal)]">
                          {draft.candidate_name}
                        </span>
                        {confidenceChip(draft.confidence)}
                        {draft.hold_reason && (
                          <span className="text-xs text-[var(--color-brand-charcoal)]/40">
                            {draft.hold_reason.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-brand-charcoal)]/60">
                        {draft.role_name} &middot; {draft.subject}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--color-brand-charcoal)]/40">
                      {formatRelativeMs(draft.created_at_ms)}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-[var(--color-brand-charcoal)]/5 px-4 pb-4 pt-3">
                          <p className="mb-1 text-xs font-medium text-[var(--color-brand-charcoal)]/50">
                            Subject
                          </p>
                          <p className="mb-3 text-sm text-[var(--color-brand-charcoal)]">
                            {draft.subject}
                          </p>
                          <p className="mb-1 text-xs font-medium text-[var(--color-brand-charcoal)]/50">
                            Body
                          </p>
                          <pre className="mb-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--color-brand-charcoal)]/3 p-3 text-xs leading-relaxed text-[var(--color-brand-charcoal)]/80">
                            {draft.body}
                          </pre>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSend(draft.id)}
                              disabled={isActing}
                              className="rounded-md bg-[var(--color-brand-charcoal)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-brand-charcoal)]/90 disabled:opacity-50"
                            >
                              {isActing ? "Sending..." : "Send"}
                            </button>
                            <Link
                              href={`/lite/admin/hiring?candidate=${draft.candidate_id}`}
                              className="rounded-md border border-[var(--color-brand-charcoal)]/20 px-3 py-1.5 text-xs font-medium text-[var(--color-brand-charcoal)] transition-colors hover:bg-[var(--color-brand-charcoal)]/5"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleArchive(draft.id)}
                              disabled={isActing}
                              className="rounded-md border border-[var(--color-brand-red,#B22848)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-brand-red,#B22848)] transition-colors hover:bg-[var(--color-brand-red,#B22848)]/5 disabled:opacity-50"
                            >
                              Archive
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
