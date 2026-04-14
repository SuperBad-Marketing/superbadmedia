"use client";

import * as React from "react";
import { toast } from "sonner";

import { KanbanBoard } from "@/components/lite/kanban-board";
import { EmptyState } from "@/components/lite/empty-state";
import { LEGAL_TRANSITIONS } from "@/lib/crm";
import type { DealStage } from "@/lib/db/schema/deals";
import { DealCard, type PipelineCardDeal } from "./deal-card";
import { STAGE_COLUMNS, type StageColumn } from "./stage-config";
import { transitionDealAction } from "@/app/lite/admin/pipeline/actions";

const WON_LOST: ReadonlySet<DealStage> = new Set(["won", "lost"]);

/**
 * Client-side board. Pessimistic transitions — cards only move once the
 * server action returns `{ok:true}`. Won/Lost drops are deferred to SP-6
 * and blocked at the drop gate with an explanatory toast.
 */
export function PipelineBoard({ deals }: { deals: PipelineCardDeal[] }) {
  const [pending, startTransition] = React.useTransition();
  const [localDeals, setLocalDeals] = React.useState(deals);

  React.useEffect(() => setLocalDeals(deals), [deals]);

  const canDrop = React.useCallback((card: PipelineCardDeal, toId: string) => {
    if (WON_LOST.has(toId as DealStage)) return false;
    const legal = LEGAL_TRANSITIONS[card.stage];
    return legal.includes(toId as DealStage);
  }, []);

  const onDrop = React.useCallback(
    (card: PipelineCardDeal, toId: string) => {
      if (WON_LOST.has(toId as DealStage)) {
        toast("Won/Lost flows land in SP-6.");
        return;
      }
      startTransition(async () => {
        const result = await transitionDealAction(card.id, toId as DealStage);
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't move that deal.");
          return;
        }
        setLocalDeals((prev) =>
          prev.map((d) =>
            d.id === card.id ? { ...d, stage: toId as DealStage } : d,
          ),
        );
        const label = STAGE_COLUMNS.find((c) => c.id === toId)?.label ?? toId;
        toast(`Moved to ${label}.`);
      });
    },
    [],
  );

  const onQuickAction = React.useCallback(
    (kind: "nudge" | "open" | "snooze", _dealId: string) => {
      const copy: Record<typeof kind, string> = {
        nudge: "Send nudge lands with Lead Gen.",
        open: "Deal detail slide-over is on the list.",
        snooze: "Snooze lands in SP-4.",
      };
      toast(copy[kind]);
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
          />
        )}
      />
    </div>
  );
}
