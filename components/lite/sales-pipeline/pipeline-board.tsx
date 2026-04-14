"use client";

import * as React from "react";
import { toast } from "sonner";

import { KanbanBoard } from "@/components/lite/kanban-board";
import { EmptyState } from "@/components/lite/empty-state";
import { LEGAL_TRANSITIONS } from "@/lib/crm/legal-transitions";
import type {
  DealStage,
  DealWonOutcome,
  DealLossReason,
} from "@/lib/db/schema/deals";
import { DealCard, type PipelineCardDeal } from "./deal-card";
import { STAGE_COLUMNS, type StageColumn } from "./stage-config";
import {
  transitionDealAction,
  finaliseWonAction,
  finaliseLostAction,
} from "@/app/lite/admin/pipeline/actions";
import { WonConfirmModal } from "./won-confirm-modal";
import { LossReasonModal } from "./loss-reason-modal";

type PendingFinalise =
  | { kind: "won"; card: PipelineCardDeal }
  | { kind: "lost"; card: PipelineCardDeal }
  | null;

/**
 * Client-side board. Pessimistic transitions — cards only move once the
 * server action returns `{ok:true}`. Won/Lost drops open the matching
 * confirm modal; the card doesn't move until the action resolves.
 */
export function PipelineBoard({
  deals,
  snoozeDefaultDays,
}: {
  deals: PipelineCardDeal[];
  snoozeDefaultDays: number;
}) {
  const [pending, startTransition] = React.useTransition();
  const [localDeals, setLocalDeals] = React.useState(deals);
  const [finalise, setFinalise] = React.useState<PendingFinalise>(null);

  React.useEffect(() => setLocalDeals(deals), [deals]);

  const canDrop = React.useCallback((card: PipelineCardDeal, toId: string) => {
    const legal = LEGAL_TRANSITIONS[card.stage];
    return legal.includes(toId as DealStage);
  }, []);

  const onDrop = React.useCallback(
    (card: PipelineCardDeal, toId: string) => {
      const toStage = toId as DealStage;
      if (toStage === "won") {
        setFinalise({ kind: "won", card });
        return;
      }
      if (toStage === "lost") {
        setFinalise({ kind: "lost", card });
        return;
      }
      startTransition(async () => {
        const result = await transitionDealAction(card.id, toStage);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't move that deal.");
          return;
        }
        setLocalDeals((prev) =>
          prev.map((d) => (d.id === card.id ? { ...d, stage: toStage } : d)),
        );
        const label = STAGE_COLUMNS.find((c) => c.id === toStage)?.label ?? toStage;
        toast(`Moved to ${label}.`);
      });
    },
    [],
  );

  const onQuickAction = React.useCallback(
    (kind: "nudge" | "open", _dealId: string) => {
      const copy: Record<typeof kind, string> = {
        nudge: "Send nudge lands with Lead Gen.",
        open: "Deal detail slide-over is on the list.",
      };
      toast(copy[kind]);
    },
    [],
  );

  const onSnoozed = React.useCallback((dealId: string, _untilMs: number) => {
    setLocalDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, is_stale: false } : d)),
    );
  }, []);

  const closeFinalise = React.useCallback(() => {
    if (!pending) setFinalise(null);
  }, [pending]);

  const confirmWon = React.useCallback(
    (dealId: string, wonOutcome: DealWonOutcome) => {
      startTransition(async () => {
        const result = await finaliseWonAction(dealId, wonOutcome);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't mark as Won.");
          return;
        }
        setLocalDeals((prev) =>
          prev.map((d) =>
            d.id === dealId ? { ...d, stage: "won", won_outcome: wonOutcome } : d,
          ),
        );
        setFinalise(null);
        toast("Marked as Won.");
      });
    },
    [],
  );

  const confirmLost = React.useCallback(
    (
      dealId: string,
      lossReason: DealLossReason,
      lossNotes: string | null,
    ) => {
      startTransition(async () => {
        const result = await finaliseLostAction(dealId, lossReason, lossNotes);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't mark as Lost.");
          return;
        }
        setLocalDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, stage: "lost" } : d)),
        );
        setFinalise(null);
        toast("Marked as Lost.");
      });
    },
    [],
  );

  return (
    <div
      aria-busy={pending ? "true" : "false"}
      data-density="comfort"
      className="h-[calc(100vh-96px)]"
    >
      <KanbanBoard<StageColumn, PipelineCardDeal>
        columns={[...STAGE_COLUMNS]}
        cards={localDeals}
        getColumnId={(d) => d.stage}
        canDrop={canDrop}
        onDrop={onDrop}
        columnClassName={(col) => ""}
        renderColumnHeader={(column, count) => (
          <div
            className="flex items-center justify-between rounded-sm px-2 py-1"
            style={{ background: column.tintVar }}
          >
            <span className="font-heading text-sm font-semibold">{column.label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {count}
            </span>
          </div>
        )}
        renderColumnEmpty={(column) => (
          <EmptyState hero={column.emptyHero} message={column.emptyMessage} />
        )}
        renderCard={(deal, { isDragging }) => (
          <DealCard
            deal={deal}
            isDragging={isDragging}
            onQuickAction={onQuickAction}
            onSnoozed={onSnoozed}
            snoozeDefaultDays={snoozeDefaultDays}
          />
        )}
      />

      {finalise?.kind === "won" ? (
        <WonConfirmModal
          open
          onOpenChange={(next) => !next && closeFinalise()}
          companyName={finalise.card.company_name}
          billingMode={finalise.card.billing_mode}
          pending={pending}
          onConfirm={({ won_outcome }) =>
            confirmWon(finalise.card.id, won_outcome)
          }
        />
      ) : null}

      {finalise?.kind === "lost" ? (
        <LossReasonModal
          open
          onOpenChange={(next) => !next && closeFinalise()}
          companyName={finalise.card.company_name}
          pending={pending}
          onConfirm={({ loss_reason, loss_notes }) =>
            confirmLost(finalise.card.id, loss_reason, loss_notes)
          }
        />
      ) : null}
    </div>
  );
}
