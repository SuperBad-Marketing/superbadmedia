"use client";

import * as React from "react";
import { Calendar, MapPin, Film } from "lucide-react";
import { KanbanBoard, type KanbanColumn } from "@/components/lite/kanban-board";
import type { ProductionRow } from "@/lib/db/schema/productions";
import { updateStatusAction } from "../actions";

const PIPELINE_COLUMNS: (KanbanColumn & {
  label: string;
  status: string;
  accent: string;
})[] = [
  {
    id: "scheduled",
    label: "Scheduled",
    status: "scheduled",
    accent: "var(--color-brand-cream)",
  },
  {
    id: "shot",
    label: "Shot",
    status: "shot",
    accent: "var(--color-brand-orange)",
  },
  {
    id: "in_edit",
    label: "In Edit",
    status: "in_edit",
    accent: "var(--color-brand-orange)",
  },
  {
    id: "published",
    label: "Published",
    status: "published",
    accent: "var(--color-success)",
  },
];

interface ProductionPipelineProps {
  productions: ProductionRow[];
  onCardClick: (id: string) => void;
  onUpdated: () => void;
}

export function ProductionPipeline({
  productions,
  onCardClick,
  onUpdated,
}: ProductionPipelineProps) {
  const pipelineCards = productions.filter((p) => p.status !== "idea");

  async function handleDrop(
    card: ProductionRow,
    toColumnId: string,
  ) {
    await updateStatusAction(card.id, toColumnId as ProductionRow["status"]);
    onUpdated();
  }

  return (
    <KanbanBoard
      columns={PIPELINE_COLUMNS}
      cards={pipelineCards}
      getColumnId={(card) => card.status}
      onDrop={handleDrop}
      renderColumnHeader={(col, count) => (
        <div className="flex items-center justify-between">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "1.5px",
              color: col.accent,
            }}
          >
            {col.label}
          </span>
          <span
            className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-600)]"
            style={{ letterSpacing: "0.5px" }}
          >
            {count}
          </span>
        </div>
      )}
      renderCard={(card, { isDragging }) => (
        <button
          type="button"
          onClick={() => {
            if (!isDragging) onCardClick(card.id);
          }}
          className="w-full cursor-pointer rounded-[8px] border border-[color:rgba(253,245,230,0.06)] p-3 text-left"
          style={{
            background: isDragging
              ? "var(--color-surface-3)"
              : "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
            transition:
              "background 150ms cubic-bezier(0.16,1,0.3,1), border-color 200ms",
          }}
        >
          <p
            className="truncate font-[family-name:var(--font-display)] text-[14px] leading-tight text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.1px" }}
          >
            {card.title}
          </p>
          {card.subject_type && (
            <span
              className="mt-1 inline-block font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.2px" }}
            >
              {card.subject_type}
            </span>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {card.shoot_date && (
              <div className="flex items-center gap-1">
                <Calendar
                  className="size-2.5 text-[color:var(--color-neutral-500)]"
                  strokeWidth={1.5}
                />
                <span className="font-[family-name:var(--font-body)] text-[10px] text-[color:var(--color-neutral-400)]">
                  {card.shoot_date}
                </span>
              </div>
            )}
            {card.location && (
              <div className="flex items-center gap-1">
                <MapPin
                  className="size-2.5 text-[color:var(--color-neutral-500)]"
                  strokeWidth={1.5}
                />
                <span className="font-[family-name:var(--font-body)] text-[10px] text-[color:var(--color-neutral-400)]">
                  {card.location}
                </span>
              </div>
            )}
            {card.narrative_angle && (
              <div className="flex items-center gap-1">
                <Film
                  className="size-2.5 text-[color:var(--color-brand-pink)]"
                  strokeWidth={1.5}
                />
                <span className="truncate font-[family-name:var(--font-body)] text-[10px] text-[color:var(--color-neutral-400)]">
                  {card.narrative_angle}
                </span>
              </div>
            )}
          </div>
        </button>
      )}
      renderColumnEmpty={(col) => (
        <div className="flex flex-col items-center text-center">
          <p className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-neutral-600)]">
            {col.id === "scheduled"
              ? "promote ideas to get started."
              : "drag episodes here."}
          </p>
        </div>
      )}
    />
  );
}
