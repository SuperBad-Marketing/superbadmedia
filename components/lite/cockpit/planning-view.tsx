"use client";

import { useState } from "react";
import Link from "next/link";
import { List, LayoutGrid } from "lucide-react";
import type { CockpitKanban } from "@/lib/tasks/cockpit";

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
        <KanbanView kanban={kanban} />
      ) : (
        <ListView tasks={allTasks} />
      )}
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
                  color: "var(--color-neutral-600)",
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
      className="rounded-[var(--radius-default)] px-3 py-2.5 text-[13px] font-[family-name:var(--font-body)] transition-colors block"
      style={{
        backgroundColor: "var(--color-surface-0)",
        color: "var(--color-neutral-800)",
      }}
    >
      {task.title}
    </Link>
  );
}
