"use client";

import { useState } from "react";
import Link from "next/link";
import { List, LayoutGrid } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { useMediaQuery } from "@/lib/use-media-query";
import type { CockpitKanban } from "@/lib/tasks/cockpit";

const COLUMNS = [
  { key: "mustDo", label: "Must Do" },
  { key: "shouldDo", label: "Should Do" },
  { key: "ifTime", label: "If Time" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

export function PlanningView({ kanban }: { kanban: CockpitKanban }) {
  const [view, setView] = useState<"kanban" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("cockpit_view") as "kanban" | "list") ?? "kanban";
    }
    return "kanban";
  });

  const toggleView = () => {
    const next = view === "kanban" ? "list" : "kanban";
    setView(next);
    localStorage.setItem("cockpit_view", next);
  };

  const allTasks = [...kanban.mustDo, ...kanban.shouldDo, ...kanban.ifTime];
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-[14px] font-[family-name:var(--font-label)] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Today
        </h2>
        <button
          onClick={toggleView}
          className="p-1.5 rounded-[var(--radius-tight)] transition-colors"
          style={{ color: "var(--color-neutral-500)" }}
          aria-label={`Switch to ${view === "kanban" ? "list" : "kanban"} view`}
        >
          {view === "kanban" ? (
            <List className="h-4 w-4" />
          ) : (
            <LayoutGrid className="h-4 w-4" />
          )}
        </button>
      </div>

      {allTasks.length === 0 ? (
        <p
          className="text-[14px] font-[family-name:var(--font-serif)] italic py-4"
          style={{ color: "var(--color-neutral-500)" }}
        >
          No tasks queued. Use the braindump button to add something.
        </p>
      ) : view === "kanban" ? (
        isMobile ? (
          <TabbedKanban kanban={kanban} />
        ) : (
          <KanbanView kanban={kanban} />
        )
      ) : (
        <ListView tasks={allTasks} />
      )}
    </div>
  );
}

function TabbedKanban({ kanban }: { kanban: CockpitKanban }) {
  const [activeTab, setActiveTab] = useState<ColumnKey>("mustDo");
  const [direction, setDirection] = useState(0);
  const reducedMotion = useReducedMotion();

  const counts: Record<ColumnKey, number> = {
    mustDo: kanban.mustDo.length,
    shouldDo: kanban.shouldDo.length,
    ifTime: kanban.ifTime.length,
  };

  const tasksForTab: Record<ColumnKey, typeof kanban.mustDo> = {
    mustDo: kanban.mustDo,
    shouldDo: kanban.shouldDo,
    ifTime: kanban.ifTime,
  };

  const handleTabChange = (key: ColumnKey) => {
    const currentIdx = COLUMNS.findIndex((c) => c.key === activeTab);
    const nextIdx = COLUMNS.findIndex((c) => c.key === key);
    setDirection(nextIdx > currentIdx ? 1 : -1);
    setActiveTab(key);
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <div>
      <div
        className="flex gap-1 mb-4 rounded-[var(--radius-default)] p-1"
        style={{ backgroundColor: "var(--color-surface-1)" }}
        role="tablist"
        aria-label="Task columns"
      >
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            role="tab"
            aria-selected={activeTab === col.key}
            onClick={() => handleTabChange(col.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-tight)] text-[12px] font-[family-name:var(--font-label)] uppercase transition-colors"
            style={{
              letterSpacing: "0.5px",
              backgroundColor:
                activeTab === col.key ? "var(--color-surface-2)" : "transparent",
              color:
                activeTab === col.key
                  ? "var(--color-neutral-100)"
                  : "var(--color-neutral-500)",
            }}
          >
            {col.label}
            {counts[col.key] > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{
                  backgroundColor:
                    activeTab === col.key
                      ? "var(--color-surface-3)"
                      : "var(--color-surface-2)",
                  color: "var(--color-neutral-500)",
                }}
              >
                {counts[col.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden min-h-[80px]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={activeTab}
            custom={direction}
            variants={reducedMotion ? undefined : variants}
            initial={reducedMotion ? false : "enter"}
            animate="center"
            exit={reducedMotion ? undefined : "exit"}
            transition={reducedMotion ? { duration: 0 } : houseSpring}
          >
            <div className="flex flex-col gap-2" role="tabpanel">
              {tasksForTab[activeTab].length === 0 ? (
                <p
                  className="text-[13px] font-[family-name:var(--font-serif)] italic py-3"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  Nothing here.
                </p>
              ) : (
                tasksForTab[activeTab].map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function KanbanView({ kanban }: { kanban: CockpitKanban }) {
  const columns = [
    { label: "Must Do", tasks: kanban.mustDo },
    { label: "Should Do", tasks: kanban.shouldDo },
    { label: "If Time", tasks: kanban.ifTime },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {columns.map((col) => (
        <div key={col.label}>
          <div
            className="text-[12px] font-[family-name:var(--font-label)] uppercase mb-3 flex items-center gap-2"
            style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
          >
            {col.label}
            {col.tasks.length > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{
                  backgroundColor: "var(--color-surface-1)",
                  color: "var(--color-neutral-500)",
                }}
              >
                {col.tasks.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {col.tasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({
  tasks,
}: {
  tasks: Array<{ id: string; title: string; due_at_ms: number | null; priority: string }>;
}) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.due_at_ms && b.due_at_ms) return a.due_at_ms - b.due_at_ms;
    if (a.due_at_ms) return -1;
    if (b.due_at_ms) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </div>
  );
}

function TaskCard({
  task,
}: {
  task: { id: string; title: string; priority: string };
}) {
  return (
    <Link
      href={`/lite/tasks?open=${task.id}`}
      className="rounded-[var(--radius-default)] px-3 py-2.5 text-[13px] font-[family-name:var(--font-body)] block bg-[color:var(--color-surface-0)] text-[color:var(--color-neutral-100)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-[color:var(--color-surface-1)]"
    >
      {task.title}
    </Link>
  );
}
