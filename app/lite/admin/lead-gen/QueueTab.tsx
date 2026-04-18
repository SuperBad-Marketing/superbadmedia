"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { approveDraft, rejectDraft } from "./actions";
import type { AutonomyMode } from "@/lib/db/schema/autonomy-state";
import type { OutreachTouchKind } from "@/lib/db/schema/outreach-drafts";
import type { CandidateEmailConfidence } from "@/lib/db/schema/lead-candidates";

export type DraftForQueue = {
  id: string;
  candidate_id: string | null;
  track: "saas" | "retainer";
  company_name: string;
  score: number;
  touch_kind: OutreachTouchKind;
  subject: string;
  body_preview: string;
  drift_check_flagged: boolean;
  email_confidence: CandidateEmailConfidence | null;
  created_at_ms: number | null;
};

export type AutonomyStateForHeader = {
  track: "saas" | "retainer";
  mode: AutonomyMode;
  clean_approval_streak: number;
  graduation_threshold: number;
  probation_sends_remaining: number | null;
  probation_threshold: number;
};

export type LatestRunStats = {
  run_started_at_ms: number | null;
  found_count: number;
  qualified_count: number;
  drafted_count: number;
} | null;

type TrackFilter = "all" | "saas" | "retainer";

const TRACK_FILTERS: { id: TrackFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "saas", label: "SaaS" },
  { id: "retainer", label: "Retainer" },
];

function TrackChip({ track }: { track: "saas" | "retainer" }) {
  const isSaas = track === "saas";
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-[3px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: isSaas
          ? "rgba(242,140,82,0.12)"
          : "rgba(244,160,176,0.12)",
        color: isSaas
          ? "var(--color-brand-orange)"
          : "var(--color-brand-pink)",
      }}
    >
      {track}
    </span>
  );
}

function TouchKindLabel({ kind }: { kind: OutreachTouchKind }) {
  const labels: Record<OutreachTouchKind, string> = {
    first_touch: "first touch",
    follow_up: "follow-up",
    stale_nudge: "nudge",
  };
  return (
    <span
      className="font-[family-name:var(--font-label)] text-[10px] uppercase"
      style={{ letterSpacing: "1.2px", color: "var(--color-neutral-500)" }}
    >
      {labels[kind]}
    </span>
  );
}

function formatRunTime(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Melbourne",
  });
}

function AutonomyModeLabel({
  state,
}: {
  state: AutonomyStateForHeader;
}) {
  const { mode, clean_approval_streak, graduation_threshold, probation_sends_remaining, probation_threshold } = state;

  if (mode === "manual") {
    return (
      <span style={{ color: "var(--color-neutral-400)" }}>
        manual · {clean_approval_streak}/{graduation_threshold} toward graduation
      </span>
    );
  }
  if (mode === "probation") {
    const remaining = probation_sends_remaining ?? probation_threshold;
    return (
      <span style={{ color: "var(--color-brand-orange)" }}>
        probation · {remaining}/{probation_threshold} sends remaining
      </span>
    );
  }
  if (mode === "auto_send") {
    return (
      <span style={{ color: "#5cb85c" }}>
        auto-send active
      </span>
    );
  }
  return (
    <span style={{ color: "var(--color-brand-red, #B22848)" }}>
      circuit broken — manual approval required
    </span>
  );
}

function QueueHeader({
  runStats,
  autonomyStates,
}: {
  runStats: LatestRunStats;
  autonomyStates: AutonomyStateForHeader[];
}) {
  const saasState = autonomyStates.find((s) => s.track === "saas");
  const retainerState = autonomyStates.find((s) => s.track === "retainer");

  return (
    <div
      className="mb-6 rounded-[8px] p-4"
      style={{
        background: "rgba(253,245,230,0.03)",
        border: "1px solid rgba(253,245,230,0.06)",
      }}
    >
      {runStats ? (
        <div
          className="mb-3 font-[family-name:var(--font-label)] text-[11px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Last run: {formatRunTime(runStats.run_started_at_ms)} — found{" "}
          <span style={{ color: "var(--color-neutral-300)" }}>
            {runStats.found_count}
          </span>{" "}
          → qualified{" "}
          <span style={{ color: "var(--color-neutral-300)" }}>
            {runStats.qualified_count}
          </span>{" "}
          → drafted{" "}
          <span style={{ color: "var(--color-neutral-300)" }}>
            {runStats.drafted_count}
          </span>
        </div>
      ) : (
        <div
          className="mb-3 font-[family-name:var(--font-label)] text-[11px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          No runs yet
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {saasState && (
          <div
            className="font-[family-name:var(--font-body)] text-[12px]"
            style={{ color: "var(--color-neutral-400)" }}
          >
            <span
              style={{
                color: "var(--color-neutral-500)",
                fontFamily: "var(--font-label)",
                fontSize: "10px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginRight: "6px",
              }}
            >
              SaaS:
            </span>
            <AutonomyModeLabel state={saasState} />
          </div>
        )}
        {retainerState && (
          <div
            className="font-[family-name:var(--font-body)] text-[12px]"
            style={{ color: "var(--color-neutral-400)" }}
          >
            <span
              style={{
                color: "var(--color-neutral-500)",
                fontFamily: "var(--font-label)",
                fontSize: "10px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginRight: "6px",
              }}
            >
              Retainer:
            </span>
            <AutonomyModeLabel state={retainerState} />
          </div>
        )}
      </div>
    </div>
  );
}

function DraftRow({
  draft,
  onApprove,
  onReject,
  disabled,
}: {
  draft: DraftForQueue;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={houseSpring}
      className="group rounded-[6px] p-4"
      style={{
        background: "rgba(253,245,230,0.02)",
        border: "1px solid rgba(253,245,230,0.05)",
      }}
    >
      {/* Row top: company + chips + score */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span
          className="font-[family-name:var(--font-body)] font-medium"
          style={{ color: "var(--color-brand-cream)", fontSize: "14px" }}
        >
          {draft.company_name}
        </span>
        <TrackChip track={draft.track} />
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{
            letterSpacing: "1px",
            color: "var(--color-neutral-500)",
          }}
        >
          score {draft.score}
        </span>
        <TouchKindLabel kind={draft.touch_kind} />
        {draft.email_confidence === "inferred" && (
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{
              letterSpacing: "1px",
              color: "var(--color-neutral-500)",
              background: "rgba(128,127,115,0.10)",
              padding: "2px 6px",
              borderRadius: "3px",
            }}
          >
            email: inferred
          </span>
        )}
        {draft.drift_check_flagged && (
          <span
            className="font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{
              letterSpacing: "1px",
              color: "#C8960C",
              background: "rgba(200,150,12,0.10)",
              padding: "2px 6px",
              borderRadius: "3px",
            }}
          >
            drift flagged
          </span>
        )}
      </div>

      {/* Subject */}
      <div
        className="mb-1 font-[family-name:var(--font-body)] text-[13px]"
        style={{ color: "var(--color-neutral-300)" }}
      >
        <span style={{ color: "var(--color-neutral-500)" }}>Subject: </span>
        {draft.subject}
      </div>

      {/* Body preview */}
      <div
        className="mb-3 line-clamp-2 font-[family-name:var(--font-narrative)] text-[12px] italic leading-relaxed"
        style={{ color: "var(--color-neutral-500)" }}
      >
        &ldquo;{draft.body_preview}&rdquo;
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(draft.id)}
          disabled={disabled}
          className="rounded-[6px] px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            letterSpacing: "1.5px",
            background: "rgba(44,180,44,0.15)",
            color: "#5cb85c",
            border: "1px solid rgba(44,180,44,0.25)",
          }}
        >
          Approve
        </button>
        <button
          onClick={() => onReject(draft.id)}
          disabled={disabled}
          className="rounded-[6px] px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            letterSpacing: "1.5px",
            background: "rgba(178,40,72,0.12)",
            color: "var(--color-brand-pink)",
            border: "1px solid rgba(178,40,72,0.2)",
          }}
        >
          Reject
        </button>
      </div>
    </motion.div>
  );
}

export function QueueTab({
  drafts,
  autonomyStates,
  runStats,
}: {
  drafts: DraftForQueue[];
  autonomyStates: AutonomyStateForHeader[];
  runStats: LatestRunStats;
}) {
  const [activeFilter, setActiveFilter] = useState<TrackFilter>("all");
  const [isPending, startTransition] = useTransition();
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<
    Set<string>
  >(new Set());
  const [feedback, setFeedback] = useState<{
    message: string;
    ok: boolean;
  } | null>(null);

  const visibleDrafts = drafts.filter(
    (d) =>
      !optimisticallyRemoved.has(d.id) &&
      (activeFilter === "all" || d.track === activeFilter),
  );

  function handleApprove(id: string) {
    setOptimisticallyRemoved((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const result = await approveDraft(id);
      if (!result.ok) {
        setOptimisticallyRemoved((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setFeedback({ message: result.error ?? "Approval failed", ok: false });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ message: "Draft approved and queued.", ok: true });
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  }

  function handleReject(id: string) {
    setOptimisticallyRemoved((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const result = await rejectDraft(id);
      if (!result.ok) {
        setOptimisticallyRemoved((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setFeedback({ message: result.error ?? "Reject failed", ok: false });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ message: "Draft rejected.", ok: true });
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  }

  return (
    <div>
      <QueueHeader runStats={runStats} autonomyStates={autonomyStates} />

      {/* Feedback bar */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={houseSpring}
            className="mb-4 rounded-[6px] px-4 py-2.5 font-[family-name:var(--font-body)] text-[13px]"
            style={{
              background: feedback.ok
                ? "rgba(44,180,44,0.10)"
                : "rgba(178,40,72,0.12)",
              color: feedback.ok ? "#5cb85c" : "var(--color-brand-pink)",
              border: `1px solid ${feedback.ok ? "rgba(44,180,44,0.2)" : "rgba(178,40,72,0.2)"}`,
            }}
          >
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter chips */}
      <div className="mb-5 flex gap-2">
        {TRACK_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className="relative rounded-full px-3.5 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
            style={{
              letterSpacing: "1.5px",
              background:
                activeFilter === f.id
                  ? "rgba(244,160,176,0.12)"
                  : "rgba(253,245,230,0.04)",
              color:
                activeFilter === f.id
                  ? "var(--color-brand-pink)"
                  : "var(--color-neutral-500)",
              border:
                activeFilter === f.id
                  ? "1px solid rgba(244,160,176,0.25)"
                  : "1px solid rgba(253,245,230,0.06)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Draft list */}
      <AnimatePresence mode="popLayout">
        {visibleDrafts.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="py-16 text-center"
          >
            <p
              className="font-[family-name:var(--font-display)] text-[22px]"
              style={{ color: "var(--color-neutral-600)" }}
            >
              Nothing waiting.
            </p>
            <p
              className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic"
              style={{ color: "var(--color-neutral-600)" }}
            >
              {activeFilter === "all"
                ? "the machine hasn't found anyone worth talking to yet."
                : `no ${activeFilter} drafts pending.`}
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleDrafts.map((draft) => (
              <DraftRow
                key={draft.id}
                draft={draft}
                onApprove={handleApprove}
                onReject={handleReject}
                disabled={isPending}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
