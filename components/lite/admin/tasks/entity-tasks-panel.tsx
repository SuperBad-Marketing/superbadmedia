import Link from "next/link";
import type { TaskRow } from "@/lib/db/schema/tasks";
import type { TaskKind, TaskStatus, TaskPriority } from "@/lib/tasks/types";

const KIND_COLORS: Record<TaskKind, string> = {
  personal: "var(--color-neutral-500)",
  admin: "var(--color-brand-cream)",
  prospect_followup: "var(--color-brand-orange)",
  client_deliverable: "var(--color-brand-pink)",
  client_task: "var(--color-brand-pink)",
};

const KIND_LABELS: Record<TaskKind, string> = {
  personal: "Personal",
  admin: "Admin",
  prospect_followup: "Prospect",
  client_deliverable: "Deliverable",
  client_task: "Client task",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  awaiting_approval: "Awaiting approval",
  delivered: "Delivered",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "var(--color-neutral-500)",
  in_progress: "var(--color-brand-cream)",
  blocked: "var(--color-brand-orange)",
  awaiting_approval: "var(--color-brand-pink)",
  delivered: "var(--color-success)",
  done: "var(--color-success)",
  cancelled: "var(--color-neutral-500)",
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Melbourne",
  });
}

function isOverdue(task: TaskRow, nowMs: number): boolean {
  return (
    task.due_at_ms != null &&
    task.due_at_ms < nowMs &&
    (task.status === "todo" || task.status === "in_progress")
  );
}

function ChecklistProgress({ checklist }: { checklist: unknown }) {
  if (!Array.isArray(checklist) || checklist.length === 0) return null;
  const done = checklist.filter(
    (i: { checked?: boolean }) => i.checked,
  ).length;
  return (
    <span
      className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-500)]"
      style={{ letterSpacing: "1px" }}
    >
      {done}/{checklist.length}
    </span>
  );
}

export function EntityTasksPanel({
  tasks,
  emptyHero,
  emptyMutter,
}: {
  tasks: TaskRow[];
  emptyHero?: string;
  emptyMutter?: string;
}) {
  const nowMs = Date.now();
  const openTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  );
  const closedTasks = tasks.filter(
    (t) => t.status === "done" || t.status === "cancelled",
  );
  const overdueCount = openTasks.filter((t) => isOverdue(t, nowMs)).length;

  if (tasks.length === 0) {
    return (
      <div className="px-4 pb-10">
        <div className="px-8 py-10 text-center">
          <p
            className="font-[family-name:var(--font-display)] leading-none text-[color:var(--color-brand-cream)]"
            style={{ fontSize: "24px", letterSpacing: "-0.2px" }}
          >
            {emptyHero ?? "No tasks."}
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            {emptyMutter ?? "nothing on the list for this one."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-10">
      {/* Summary strip */}
      <div className="flex items-center gap-4">
        <span
          className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {openTasks.length} open
        </span>
        {overdueCount > 0 && (
          <span
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-orange)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {overdueCount} overdue
          </span>
        )}
        <span
          className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {closedTasks.length} closed
        </span>
      </div>

      {/* Open tasks */}
      {openTasks.length > 0 && (
        <section
          aria-label="Open tasks"
          className="overflow-hidden rounded-[12px]"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <div
            className="flex items-baseline justify-between px-5 py-3"
            style={{
              borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
            }}
          >
            <h3
              className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
              style={{ letterSpacing: "1.8px" }}
            >
              Open
            </h3>
            <span
              className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {openTasks.length}
            </span>
          </div>
          <div>
            {openTasks.map((task) => (
              <TaskListRow key={task.id} task={task} nowMs={nowMs} />
            ))}
          </div>
        </section>
      )}

      {/* Closed tasks */}
      {closedTasks.length > 0 && (
        <section
          aria-label="Closed tasks"
          className="overflow-hidden rounded-[12px]"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <div
            className="flex items-baseline justify-between px-5 py-3"
            style={{
              borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
            }}
          >
            <h3
              className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
              style={{ letterSpacing: "1.8px" }}
            >
              Closed
            </h3>
            <span
              className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {closedTasks.length}
            </span>
          </div>
          <div>
            {closedTasks.map((task) => (
              <TaskListRow key={task.id} task={task} nowMs={nowMs} />
            ))}
          </div>
        </section>
      )}

      {/* Link to full task manager */}
      <div className="text-center">
        <Link
          href="/lite/tasks"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Open task manager →
        </Link>
      </div>
    </div>
  );
}

function TaskListRow({ task, nowMs }: { task: TaskRow; nowMs: number }) {
  const overdue = isOverdue(task, nowMs);
  const isDone = task.status === "done" || task.status === "cancelled";
  const kind = task.kind as TaskKind;
  const status = task.status as TaskStatus;
  const priority = task.priority as TaskPriority;

  return (
    <Link
      href={`/lite/tasks?open=${task.id}`}
      className="flex items-center justify-between px-5 py-3 transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.02)]"
      style={{
        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
        opacity: isDone ? 0.55 : 1,
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {priority === "high" && (
          <span
            className="shrink-0 text-[13px] font-bold"
            style={{ color: "var(--color-brand-orange)" }}
          >
            !
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p
            className="truncate font-[family-name:var(--font-body)] text-[13px] font-medium"
            style={{
              color: isDone
                ? "var(--color-neutral-500)"
                : "var(--color-brand-cream)",
              textDecoration: isDone ? "line-through" : undefined,
            }}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                color: KIND_COLORS[kind],
              }}
            >
              {KIND_LABELS[kind]}
            </span>
            <ChecklistProgress checklist={task.checklist} />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {task.due_at_ms != null && (
          <span
            className="font-[family-name:var(--font-label)] text-[10px] tabular-nums"
            style={{
              letterSpacing: "1px",
              color: overdue
                ? "var(--color-brand-orange)"
                : "var(--color-neutral-500)",
            }}
          >
            {formatDate(task.due_at_ms)}
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{
            letterSpacing: "1.2px",
            background: `color-mix(in srgb, ${STATUS_COLORS[status]} 12%, transparent)`,
            color: STATUS_COLORS[status],
          }}
        >
          <span
            aria-hidden
            className="h-1 w-1 rounded-full"
            style={{ background: "currentColor", opacity: 0.85 }}
          />
          {STATUS_LABELS[status]}
        </span>
      </div>
    </Link>
  );
}
