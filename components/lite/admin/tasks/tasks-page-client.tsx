"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Trash2 } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { TaskRow } from "@/lib/db/schema/tasks";
import {
  TASK_KINDS,
  TASK_STATUSES,
  TASK_PRIORITIES,
  type TaskKind,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks/types";
import {
  bulkDeleteTasksAction,
  transitionTaskAction,
} from "@/app/lite/tasks/actions";
import { TaskDetailDrawer } from "./task-detail-drawer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = "open" | "done" | "cancelled" | "all";
type DueFilter = "all" | "today" | "week" | "overdue" | "none";

interface Props {
  tasks: TaskRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

const KIND_OPTIONS: { value: TaskKind | "all"; label: string }[] = [
  { value: "all", label: "All kinds" },
  { value: "personal", label: "Personal" },
  { value: "admin", label: "Admin" },
  { value: "prospect_followup", label: "Prospect" },
  { value: "client_deliverable", label: "Deliverable" },
  { value: "client_task", label: "Client task" },
];

const PRIORITY_OPTIONS: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "Any due date" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
  { value: "overdue", label: "Overdue" },
  { value: "none", label: "No due date" },
];

const KIND_COLORS: Record<TaskKind, string> = {
  personal: "var(--color-neutral-500)",
  admin: "var(--color-brand-cream)",
  prospect_followup: "var(--color-brand-orange)",
  client_deliverable: "var(--color-brand-pink)",
  client_task: "var(--color-brand-pink)",
};

const PRIORITY_INDICATORS: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "!", color: "var(--color-brand-orange)" },
  normal: { label: "", color: "transparent" },
  low: { label: "↓", color: "var(--color-neutral-500)" },
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function endOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

function endOfWeek(d: Date): number {
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilSunday, 23, 59, 59, 999);
  return sun.getTime();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TasksPageClient({ tasks }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("open");
  const [kindFilter, setKindFilter] = React.useState<TaskKind | "all">("all");
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority | "all">("all");
  const [dueFilter, setDueFilter] = React.useState<DueFilter>("all");
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [drawerTaskId, setDrawerTaskId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [now] = React.useState(() => Date.now());

  const visible = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    const todayStart = startOfDay(new Date(now));
    const todayEnd = endOfDay(new Date(now));
    const weekEnd = endOfWeek(new Date(now));

    return tasks.filter((t) => {
      if (statusFilter === "open" && (t.status === "done" || t.status === "cancelled")) return false;
      if (statusFilter === "done" && t.status !== "done") return false;
      if (statusFilter === "cancelled" && t.status !== "cancelled") return false;

      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;

      if (dueFilter === "today" && (t.due_at_ms == null || t.due_at_ms < todayStart || t.due_at_ms > todayEnd)) return false;
      if (dueFilter === "week" && (t.due_at_ms == null || t.due_at_ms > weekEnd)) return false;
      if (dueFilter === "overdue" && (t.due_at_ms == null || t.due_at_ms >= todayStart || t.status === "done" || t.status === "cancelled")) return false;
      if (dueFilter === "none" && t.due_at_ms != null) return false;

      if (s) {
        const inTitle = t.title.toLowerCase().includes(s);
        const inBody = t.body?.toLowerCase().includes(s) ?? false;
        if (!inTitle && !inBody) return false;
      }

      return true;
    });
  }, [tasks, statusFilter, kindFilter, priorityFilter, dueFilter, search, now]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visible.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map((t) => t.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const result = await bulkDeleteTasksAction([...selectedIds]);
    setBulkDeleting(false);
    if (result.ok) {
      setSelectedIds(new Set());
      router.refresh();
    }
  }

  function openDrawer(taskId: string) {
    setIsCreating(false);
    setDrawerTaskId(taskId);
  }

  function openCreateDrawer() {
    setDrawerTaskId(null);
    setIsCreating(true);
  }

  function closeDrawer() {
    setDrawerTaskId(null);
    setIsCreating(false);
  }

  const drawerOpen = drawerTaskId !== null || isCreating;
  const activeTask = drawerTaskId ? tasks.find((t) => t.id === drawerTaskId) ?? null : null;

  return (
    <div className="space-y-5 px-4 pb-10">
      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Status tabs */}
          <div
            role="tablist"
            aria-label="Filter tasks by status"
            className="inline-flex items-center gap-1 rounded-[10px] p-1"
            style={{
              background: "rgba(15, 15, 14, 0.45)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  aria-controls="tasks-list"
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className="relative rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase leading-none transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    letterSpacing: "1.5px",
                    color: active
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="task-status-active"
                      className="absolute inset-0 rounded-md"
                      style={{
                        background: "var(--color-surface-2)",
                        boxShadow: "var(--surface-highlight)",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Kind filter */}
          <FilterSelect
            value={kindFilter}
            onChange={(v) => setKindFilter(v as TaskKind | "all")}
            options={KIND_OPTIONS}
            label="Filter by kind"
          />

          {/* Priority filter */}
          <FilterSelect
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v as TaskPriority | "all")}
            options={PRIORITY_OPTIONS}
            label="Filter by priority"
          />

          {/* Due filter */}
          <FilterSelect
            value={dueFilter}
            onChange={(v) => setDueFilter(v as DueFilter)}
            options={DUE_OPTIONS}
            label="Filter by due date"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-neutral-500)]"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="h-9 w-56 rounded-md bg-transparent pl-8 pr-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
              style={{
                border: "1px solid rgba(253, 245, 230, 0.05)",
                background: "rgba(15, 15, 14, 0.45)",
              }}
            />
          </div>

          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] tabular-nums"
            style={{ letterSpacing: "1.5px" }}
          >
            {visible.length}
          </span>

          {/* Create button */}
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-[family-name:var(--font-label)] text-[11px] uppercase transition-colors duration-[180ms]"
            style={{
              letterSpacing: "1.5px",
              color: "var(--color-brand-cream)",
              background: "rgba(178, 40, 72, 0.16)",
              border: "1px solid rgba(178, 40, 72, 0.35)",
            }}
          >
            <Plus size={14} />
            New task
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-4 rounded-[10px] px-4 py-2.5"
              style={{
                background: "rgba(178, 40, 72, 0.08)",
                border: "1px solid rgba(178, 40, 72, 0.2)",
              }}
            >
              <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)] tabular-nums" style={{ letterSpacing: "1.5px" }}>
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-red)] transition-opacity disabled:opacity-50"
                style={{ letterSpacing: "1.5px" }}
              >
                <Trash2 size={12} />
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      {tasks.length === 0 ? (
        <EmptyTasks />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]">
            No tasks match those filters.
          </p>
        </div>
      ) : (
        <div
          id="tasks-list"
          className="overflow-hidden rounded-[12px]"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <table className="w-full text-left">
            <thead>
              <tr>
                <th
                  className="w-10 px-3 py-3"
                  style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.size === visible.length && visible.length > 0}
                    onChange={toggleSelectAll}
                    aria-label="Select all tasks"
                    className="accent-[color:var(--color-brand-red)]"
                  />
                </th>
                {[
                  { label: "Task", align: "left" as const },
                  { label: "Kind", align: "left" as const },
                  { label: "Status", align: "left" as const },
                  { label: "Priority", align: "center" as const },
                  { label: "Due", align: "left" as const },
                ].map((h) => (
                  <th
                    key={h.label}
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      padding: "12px 14px",
                      borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                      textAlign: h.align,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <TaskListRow
                  key={task.id}
                  task={task}
                  selected={selectedIds.has(task.id)}
                  onToggle={() => toggleSelect(task.id)}
                  onOpen={() => openDrawer(task.id)}
                  nowMs={now}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      <TaskDetailDrawer
        open={drawerOpen}
        task={activeTask}
        isCreating={isCreating}
        onClose={closeDrawer}
        onSaved={() => {
          router.refresh();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-8 rounded-md bg-transparent px-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
      style={{
        letterSpacing: "1.5px",
        border: "1px solid rgba(253, 245, 230, 0.05)",
        background: "rgba(15, 15, 14, 0.45)",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TaskListRow({
  task,
  selected,
  onToggle,
  onOpen,
  nowMs,
}: {
  task: TaskRow;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  nowMs: number;
}) {
  const isOverdue =
    task.due_at_ms != null &&
    task.due_at_ms < nowMs &&
    task.status !== "done" &&
    task.status !== "cancelled";

  const checklist = task.checklist as { id: string; text: string; checked: boolean }[] | null;
  const checklistProgress = checklist
    ? `${checklist.filter((c) => c.checked).length}/${checklist.length}`
    : null;

  return (
    <tr
      className="group cursor-pointer transition-colors hover:bg-[color:var(--color-surface-3)]"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
      onClick={onOpen}
    >
      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${task.title}`}
          className="accent-[color:var(--color-brand-red)]"
        />
      </td>
      <td className="max-w-[360px] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="truncate font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]">
            {task.title}
          </span>
          {checklistProgress && (
            <span className="shrink-0 font-[family-name:var(--font-label)] text-[10px] text-[color:var(--color-neutral-500)] tabular-nums">
              {checklistProgress}
            </span>
          )}
        </div>
      </td>
      <td className="px-3.5 py-3">
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{
            letterSpacing: "1.5px",
            color: KIND_COLORS[task.kind as TaskKind] ?? "var(--color-neutral-500)",
          }}
        >
          {KIND_OPTIONS.find((k) => k.value === task.kind)?.label ?? task.kind}
        </span>
      </td>
      <td className="px-3.5 py-3">
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {STATUS_LABELS[task.status as TaskStatus] ?? task.status}
        </span>
      </td>
      <td className="px-3.5 py-3 text-center">
        {PRIORITY_INDICATORS[task.priority as TaskPriority]?.label && (
          <span
            className="font-[family-name:var(--font-body)] text-[14px] font-semibold"
            style={{ color: PRIORITY_INDICATORS[task.priority as TaskPriority].color }}
            aria-label={`Priority: ${task.priority}`}
          >
            {PRIORITY_INDICATORS[task.priority as TaskPriority].label}
          </span>
        )}
      </td>
      <td className="px-3.5 py-3">
        {task.due_at_ms ? (
          <span
            className="font-[family-name:var(--font-body)] text-[13px]"
            style={{
              color: isOverdue
                ? "var(--color-brand-orange)"
                : "var(--color-neutral-400)",
            }}
          >
            {formatTimestamp(task.due_at_ms, "Australia/Melbourne", {
              format: "date",
            })}
          </span>
        ) : (
          <span className="text-[color:var(--color-neutral-600)]">—</span>
        )}
      </td>
    </tr>
  );
}

function EmptyTasks() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-neutral-500)]">
        No tasks yet.
      </p>
      <p className="mt-2 max-w-[400px] text-center font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-500)]">
        Create one, braindump one, or wait for a client deliverable to land.
      </p>
    </div>
  );
}
