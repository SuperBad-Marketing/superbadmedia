"use client";

import * as React from "react";

import { KanbanBoard } from "@/components/lite/kanban-board";
import { EmptyState } from "@/components/lite/empty-state";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import type { CandidateStage } from "@/lib/db/schema/candidates";
import {
  CandidateCard,
  type HiringCardCandidate,
} from "./candidate-card";
import {
  HIRING_STAGE_COLUMNS,
  getStageEmptyState,
  type HiringStageColumn,
} from "./stage-config";
import { ArchiveModal, type ArchiveResult } from "./archive-modal";
import { BenchConfirmModal } from "./bench-confirm-modal";
import { SkipTrialModal } from "./skip-trial-modal";
import type { SkipTrialReason } from "@/lib/hiring/stages";
import {
  transitionCandidateAction,
  archiveCandidateAction,
  skipTrialAction,
} from "@/app/lite/admin/hiring/actions";

type PendingModal =
  | { kind: "archive"; card: HiringCardCandidate }
  | { kind: "bench"; card: HiringCardCandidate }
  | { kind: "skip-trial"; card: HiringCardCandidate }
  | null;

export function HiringBoard({
  candidates,
  roleBriefFilter,
}: {
  candidates: HiringCardCandidate[];
  roleBriefFilter: { id: string; name: string }[];
}) {
  const [pending, startTransition] = React.useTransition();
  const [localCandidates, setLocalCandidates] = React.useState(candidates);
  const [modal, setModal] = React.useState<PendingModal>(null);
  const [activeFilters, setActiveFilters] = React.useState<Set<string>>(
    new Set(),
  );
  const toast = useToastWithSound();

  React.useEffect(() => setLocalCandidates(candidates), [candidates]);

  const filteredCandidates = React.useMemo(() => {
    if (activeFilters.size === 0) return localCandidates;
    return localCandidates.filter(
      (c) => c.role_brief_id && activeFilters.has(c.role_brief_id),
    );
  }, [localCandidates, activeFilters]);

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canDrop = React.useCallback(
    (_card: HiringCardCandidate, _toId: string) => true,
    [],
  );

  const onDrop = React.useCallback(
    (card: HiringCardCandidate, toId: string) => {
      const toStage = toId as CandidateStage;

      if (toStage === "archived") {
        setModal({ kind: "archive", card });
        return;
      }

      if (toStage === "bench") {
        setModal({ kind: "bench", card });
        return;
      }

      startTransition(async () => {
        const result = await transitionCandidateAction(card.id, toStage);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't move that candidate.");
          return;
        }
        setLocalCandidates((prev) =>
          prev.map((c) =>
            c.id === card.id ? { ...c, stage: toStage } : c,
          ),
        );
        const label =
          HIRING_STAGE_COLUMNS.find((col) => col.id === toStage)?.label ??
          toStage;
        toast(`Moved to ${label}.`, { sound: "kanban-drop" });
      });
    },
    [toast],
  );

  const closeModal = React.useCallback(() => {
    if (!pending) setModal(null);
  }, [pending]);

  const confirmArchive = React.useCallback(
    (result: ArchiveResult) => {
      const card = modal?.kind === "archive" ? modal.card : null;
      if (!card) return;
      startTransition(async () => {
        const res = await archiveCandidateAction(card.id, card.stage, result);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't archive.");
          return;
        }
        setLocalCandidates((prev) =>
          prev.map((c) =>
            c.id === card.id ? { ...c, stage: "archived" } : c,
          ),
        );
        setModal(null);
        toast("Archived. Reason saved.");
      });
    },
    [modal, toast],
  );

  const confirmBench = React.useCallback(() => {
    const card = modal?.kind === "bench" ? modal.card : null;
    if (!card) return;
    startTransition(async () => {
      const result = await transitionCandidateAction(card.id, "bench");
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't move to Bench.");
        return;
      }
      setLocalCandidates((prev) =>
        prev.map((c) =>
          c.id === card.id ? { ...c, stage: "bench" } : c,
        ),
      );
      setModal(null);
      toast("On the bench.", { sound: "quote-accepted" });
    });
  }, [modal, toast]);

  const confirmSkipTrial = React.useCallback(
    (reason: SkipTrialReason) => {
      const card = modal?.kind === "skip-trial" ? modal.card : null;
      if (!card) return;
      startTransition(async () => {
        const result = await skipTrialAction(card.id, reason);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't skip trial.");
          return;
        }
        setLocalCandidates((prev) =>
          prev.map((c) =>
            c.id === card.id ? { ...c, stage: "bench" } : c,
          ),
        );
        setModal(null);
        toast("Skipped trial. On the bench.", { sound: "quote-accepted" });
      });
    },
    [modal, toast],
  );

  const onSkipTrial = React.useCallback(
    (candidateId: string) => {
      const card = localCandidates.find((c) => c.id === candidateId);
      if (card) setModal({ kind: "skip-trial", card });
    },
    [localCandidates],
  );

  return (
    <>
      {roleBriefFilter.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {roleBriefFilter.map((rb) => (
            <button
              key={rb.id}
              type="button"
              onClick={() => toggleFilter(rb.id)}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                activeFilters.has(rb.id)
                  ? "border-[color:var(--color-brand-pink)] bg-[color:var(--color-brand-pink)]/10 text-[color:var(--color-brand-cream)]"
                  : "border-[color:var(--color-neutral-600)]/60 text-[color:var(--color-neutral-400)] hover:border-[color:var(--color-neutral-400)]"
              }`}
            >
              {rb.name}
            </button>
          ))}
          {activeFilters.size > 0 ? (
            <button
              type="button"
              onClick={() => setActiveFilters(new Set())}
              className="rounded-full border border-[color:var(--color-neutral-600)]/60 px-3 py-1 text-[12px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-neutral-300)]"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        aria-busy={pending ? "true" : "false"}
        data-density="comfort"
        className="h-[calc(100vh-160px)]"
      >
        <KanbanBoard<HiringStageColumn, HiringCardCandidate>
          columns={[...HIRING_STAGE_COLUMNS]}
          cards={filteredCandidates}
          getColumnId={(c) => c.stage}
          canDrop={canDrop}
          onDrop={onDrop}
          columnClassName={() => ""}
          renderColumnHeader={(column, count) => {
            const isBench = column.id === "bench";
            const isArchived = column.id === "archived";
            return (
              <div
                className="flex items-center justify-between rounded-[10px] px-3 py-2"
                style={{
                  background: isBench
                    ? "linear-gradient(135deg, rgba(178,40,72,0.22), rgba(242,140,82,0.08) 60%, rgba(34,34,31,0) 95%)"
                    : column.tintVar,
                  border: isBench
                    ? "1px solid rgba(178,40,72,0.3)"
                    : "1px solid transparent",
                  boxShadow: "var(--surface-highlight)",
                  color: isBench
                    ? "var(--color-brand-cream)"
                    : isArchived
                      ? "var(--color-neutral-500)"
                      : "var(--color-brand-charcoal)",
                }}
              >
                <span
                  className="font-[family-name:var(--font-label)] text-[11px] uppercase"
                  style={{ letterSpacing: "1.8px" }}
                >
                  {column.label}
                </span>
                <span
                  className="font-[family-name:var(--font-label)] text-[11px] tabular-nums"
                  style={{
                    letterSpacing: "1.5px",
                    opacity: 0.75,
                  }}
                >
                  {count}
                </span>
              </div>
            );
          }}
          renderColumnEmpty={(column) => {
            const copy = getStageEmptyState(column);
            return <EmptyState hero={copy.hero} message={copy.message} />;
          }}
          renderCard={(card, { isDragging }) => (
            <CandidateCard
              candidate={card}
              isDragging={isDragging}
              onSkipTrial={
                card.stage === "screened" ? onSkipTrial : undefined
              }
            />
          )}
        />
      </div>

      {modal?.kind === "archive" ? (
        <ArchiveModal
          open
          onOpenChange={(next) => !next && closeModal()}
          candidateName={modal.card.name}
          fromStage={modal.card.stage}
          pending={pending}
          onConfirm={confirmArchive}
        />
      ) : null}

      {modal?.kind === "bench" ? (
        <BenchConfirmModal
          open
          onOpenChange={(next) => !next && closeModal()}
          candidateName={modal.card.name}
          complianceOk={modal.card.compliance_ok}
          complianceMissing={modal.card.compliance_missing}
          pending={pending}
          onConfirm={confirmBench}
        />
      ) : null}

      {modal?.kind === "skip-trial" ? (
        <SkipTrialModal
          open
          onOpenChange={(next) => !next && closeModal()}
          candidateName={modal.card.name}
          pending={pending}
          onConfirm={confirmSkipTrial}
        />
      ) : null}
    </>
  );
}
