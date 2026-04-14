"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * KanbanBoard — generic drag-to-transition primitive.
 *
 * Holds no domain vocabulary. Consumers pass `columns`, `cards`, and the
 * rendering + drop-guard callbacks. Reused by the Sales Pipeline (SP-3) and
 * will be reused by the Hiring Pipeline per spec §12.5 + §14.7.
 *
 * House spring (mass:1 / stiffness:220 / damping:25) is the only Tier 1
 * motion on this surface. Reduced-motion drops the spring to opacity only.
 */
export interface KanbanColumn {
  id: string;
}

export interface KanbanCard {
  id: string;
}

export interface KanbanBoardProps<C extends KanbanColumn, D extends KanbanCard> {
  columns: C[];
  cards: D[];
  getColumnId: (card: D) => string;
  canDrop?: (card: D, toColumnId: string) => boolean;
  onDrop: (card: D, toColumnId: string) => void | Promise<void>;
  renderColumnHeader: (column: C, count: number) => React.ReactNode;
  renderCard: (card: D, dragState: { isDragging: boolean }) => React.ReactNode;
  renderColumnEmpty?: (column: C) => React.ReactNode;
  columnClassName?: (column: C) => string;
}

const HOUSE_SPRING = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };

export function KanbanBoard<C extends KanbanColumn, D extends KanbanCard>({
  columns,
  cards,
  getColumnId,
  canDrop,
  onDrop,
  renderColumnHeader,
  renderCard,
  renderColumnEmpty,
  columnClassName,
}: KanbanBoardProps<C, D>) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const cardsByColumn = React.useMemo(() => {
    const map = new Map<string, D[]>();
    for (const c of columns) map.set(c.id, []);
    for (const card of cards) {
      const colId = getColumnId(card);
      const bucket = map.get(colId);
      if (bucket) bucket.push(card);
    }
    return map;
  }, [columns, cards, getColumnId]);

  const activeCard = React.useMemo(
    () => (activeId ? cards.find((c) => c.id === activeId) ?? null : null),
    [activeId, cards],
  );

  const handleDragStart = React.useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = React.useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const cardId = String(e.active.id);
      const overId = e.over?.id ? String(e.over.id) : null;
      if (!overId) return;
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      const currentCol = getColumnId(card);
      if (overId === currentCol) return;
      if (canDrop && !canDrop(card, overId)) return;
      void onDrop(card, overId);
    },
    [cards, getColumnId, canDrop, onDrop],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div
        data-slot="kanban-board"
        className="flex h-full w-full gap-4 overflow-x-auto px-4 pb-4"
      >
        {columns.map((column) => {
          const colCards = cardsByColumn.get(column.id) ?? [];
          return (
            <KanbanColumnShell
              key={column.id}
              columnId={column.id}
              className={columnClassName?.(column)}
            >
              <div className="mb-3 px-1">
                {renderColumnHeader(column, colCards.length)}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {colCards.length === 0 && renderColumnEmpty ? (
                  <div className="py-8">{renderColumnEmpty(column)}</div>
                ) : (
                  colCards.map((card) => (
                    <KanbanCardDraggable key={card.id} cardId={card.id}>
                      {(dragState) => renderCard(card, dragState)}
                    </KanbanCardDraggable>
                  ))
                )}
              </div>
            </KanbanColumnShell>
          );
        })}
      </div>
      <DragOverlay
        dropAnimation={
          reduceMotion
            ? { duration: 120, easing: "ease-out" }
            : { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        }
      >
        <AnimatePresence>
          {activeCard ? (
            <motion.div
              initial={reduceMotion ? { opacity: 0.9 } : { scale: 1, y: 0 }}
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : { scale: 1.02, y: -4, transition: HOUSE_SPRING }
              }
              className="cn-kanban-drag-overlay"
              style={{
                boxShadow: reduceMotion
                  ? undefined
                  : "0 12px 28px rgba(0,0,0,0.18)",
              }}
            >
              {renderCard(activeCard, { isDragging: true })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumnShell({
  columnId,
  className,
  children,
}: {
  columnId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      data-slot="kanban-column"
      data-over={isOver ? "true" : undefined}
      className={cn(
        "flex min-h-[60vh] w-[280px] shrink-0 flex-col rounded-[var(--radius-default)] border border-border/40 bg-card/40 p-3 transition-colors",
        isOver && "bg-card/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

function KanbanCardDraggable({
  cardId,
  children,
}: {
  cardId: string;
  children: (state: { isDragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cardId });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-slot="kanban-card"
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: "none" }}
    >
      {children({ isDragging })}
    </div>
  );
}
