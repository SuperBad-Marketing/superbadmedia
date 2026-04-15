"use client";

import * as React from "react";

import { KanbanBoard } from "@/components/lite/kanban-board";
import { EmptyState } from "@/components/lite/empty-state";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import type { SoundKey } from "@/components/lite/sound-provider";
import { LEGAL_TRANSITIONS } from "@/lib/crm/legal-transitions";
import type {
  DealStage,
  DealWonOutcome,
  DealLossReason,
} from "@/lib/db/schema/deals";
import { DealCard, type PipelineCardDeal } from "./deal-card";
import {
  STAGE_COLUMNS,
  getStageEmptyState,
  type StageColumn,
} from "./stage-config";
import { maybeFireThreeWonsEgg } from "@/app/lite/admin/pipeline/three-wons-egg";
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
  const toast = useToastWithSound();
  // Session-scoped counter for the "three Wons" admin egg (§11A.4). Resets
  // on page reload; the server-side monthly cooldown is the real gate.
  const wonsThisSessionRef = React.useRef(0);

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
        // `kanban-drop` is the registry-locked sound for drag settle / tick-warm
        // slot per §11 sound mapping.
        toast(`Moved to ${label}.`, { sound: "kanban-drop" });
      });
    },
    [toast],
  );

  const onQuickAction = React.useCallback(
    (kind: "nudge" | "open", _dealId: string) => {
      const copy: Record<typeof kind, string> = {
        nudge: "Send nudge lands with Lead Gen.",
        open: "Deal detail slide-over is on the list.",
      };
      toast(copy[kind]);
    },
    [toast],
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
      const card = finalise?.kind === "won" ? finalise.card : null;
      const companyName = card?.company_name ?? "Deal";
      const billingMode = card?.billing_mode ?? "stripe";
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
        // Won sound pairing per §11 sound mapping: retainer → quote-accepted,
        // saas → subscription-activated, project → quote-accepted (sister
        // chime covers both retainer and project). The `chime-bright` name
        // in §11A.2 maps to these two locked registry entries.
        const sound: SoundKey =
          wonOutcome === "saas" ? "subscription-activated" : "quote-accepted";
        const wonMessage =
          billingMode === "manual"
            ? "Logged as Won. Hope you invoiced them."
            : `${companyName} converted. Nice.`;
        toast(wonMessage, { sound });
        wonsThisSessionRef.current += 1;
        if (wonsThisSessionRef.current >= 3) {
          // Fire-and-forget; server-side gate enforces the ≤ once/month cap.
          void maybeFireThreeWonsEgg().then((fired) => {
            if (fired) {
              toast(
                "That's three. Either you're crushing it or it's a slow Tuesday.",
              );
              wonsThisSessionRef.current = 0;
            }
          });
        }
      });
    },
    [finalise, toast],
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
        // Lost is deliberately muted (§11A.2 — no sound; not a cheerleading
        // event).
        toast("Marked Lost. Reason saved.");
      });
    },
    [toast],
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
        renderColumnHeader={(column, count) => {
          const isWon = column.id === "won";
          const isLost = column.id === "lost";
          return (
            <div
              className="flex items-center justify-between rounded-[10px] px-3 py-2"
              style={{
                background: isWon
                  ? "linear-gradient(135deg, rgba(178,40,72,0.22), rgba(242,140,82,0.08) 60%, rgba(34,34,31,0) 95%)"
                  : column.tintVar,
                border: isWon
                  ? "1px solid rgba(178,40,72,0.3)"
                  : "1px solid transparent",
                boxShadow: "var(--surface-highlight)",
                color: isWon
                  ? "var(--color-brand-cream)"
                  : isLost
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
