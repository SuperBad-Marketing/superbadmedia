"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { TaskRow } from "@/lib/db/schema/tasks";
import {
  TASK_KINDS,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_RECURRENCES,
  type TaskKind,
  type TaskStatus,
  type TaskPriority,
  type TaskRecurrence,
  type ChecklistItem,
} from "@/lib/tasks/types";
import { getLegalTransitions } from "@/lib/tasks/transitions";
import {
  createTaskAction,
  updateTaskAction,
  transitionTaskAction,
  updateChecklistAction,
  deleteTaskAction,
  searchEntitiesAction,
} from "@/app/lite/tasks/actions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  task: TaskRow | null;
  isCreating: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Natural-language date parsing (client-side)
// ---------------------------------------------------------------------------

function parseNaturalDate(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (trimmed === "today") return today.getTime();
  if (trimmed === "tomorrow") return today.getTime() + 86_400_000;
  if (trimmed === "yesterday") return today.getTime() - 86_400_000;

  const inDaysMatch = trimmed.match(/^in (\d+) days?$/);
  if (inDaysMatch) return today.getTime() + Number(inDaysMatch[1]) * 86_400_000;

  if (trimmed === "next week") return today.getTime() + 7 * 86_400_000;
  if (trimmed === "next month") {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 1);
    return d.getTime();
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIdx = dayNames.indexOf(trimmed);
  if (dayIdx !== -1) {
    const currentDay = today.getDay();
    let daysAhead = dayIdx - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    return today.getTime() + daysAhead * 86_400_000;
  }

  const shortDayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const shortDayIdx = shortDayNames.indexOf(trimmed);
  if (shortDayIdx !== -1) {
    const currentDay = today.getDay();
    let daysAhead = shortDayIdx - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    return today.getTime() + daysAhead * 86_400_000;
  }

  const parsed = Date.parse(input);
  if (!isNaN(parsed)) return parsed;

  return null;
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<TaskKind, string> = {
  personal: "Personal",
  admin: "Admin",
  prospect_followup: "Prospect follow-up",
  client_deliverable: "Client deliverable",
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

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  normal: "Normal",
  low: "Low",
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

export function TaskDetailDrawer({ open, task, isCreating, onClose, onSaved }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [kind, setKind] = React.useState<TaskKind>("admin");
  const [priority, setPriority] = React.useState<TaskPriority>("normal");
  const [dueInput, setDueInput] = React.useState("");
  const [dueMs, setDueMs] = React.useState<number | null>(null);
  const [recurrence, setRecurrence] = React.useState<TaskRecurrence | "">("");
  const [checklist, setChecklist] = React.useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = React.useState("");
  const [entityType, setEntityType] = React.useState<string>("");
  const [entityId, setEntityId] = React.useState<string>("");
  const [entitySearch, setEntitySearch] = React.useState("");
  const [entityResults, setEntityResults] = React.useState<{ id: string; name: string; type: string }[]>([]);
  const [showEntitySearch, setShowEntitySearch] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (task) {
      setTitle(task.title);
      setBody(task.body ?? "");
      setKind(task.kind as TaskKind);
      setPriority(task.priority as TaskPriority);
      setDueMs(task.due_at_ms);
      setDueInput(
        task.due_at_ms
          ? formatTimestamp(task.due_at_ms, "Australia/Melbourne", { format: "date" })
          : "",
      );
      setRecurrence((task.recurrence as TaskRecurrence) ?? "");
      setChecklist((task.checklist as ChecklistItem[]) ?? []);
      setEntityType(task.entity_type ?? "");
      setEntityId(task.entity_id ?? "");
      setEntitySearch("");
      setShowEntitySearch(false);
    } else if (isCreating) {
      setTitle("");
      setBody("");
      setKind("admin");
      setPriority("normal");
      setDueInput("");
      setDueMs(null);
      setRecurrence("");
      setChecklist([]);
      setEntityType("");
      setEntityId("");
      setEntitySearch("");
      setShowEntitySearch(false);
    }
    setError(null);
  }, [task, isCreating, open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleDueBlur() {
    if (!dueInput.trim()) {
      setDueMs(null);
      return;
    }
    const parsed = parseNaturalDate(dueInput);
    if (parsed) {
      setDueMs(parsed);
      setDueInput(formatTimestamp(parsed, "Australia/Melbourne", { format: "date" }));
    }
  }

  async function handleEntitySearch(query: string) {
    setEntitySearch(query);
    if (query.trim().length < 2) {
      setEntityResults([]);
      return;
    }
    const res = await searchEntitiesAction(query.trim());
    const results: { id: string; name: string; type: string }[] = [
      ...res.contacts.map((c) => ({ id: c.id, name: c.name, type: "contact" })),
      ...res.companies.map((c) => ({ id: c.id, name: c.name, type: "company" })),
    ];
    setEntityResults(results);
  }

  function selectEntity(id: string, name: string, type: string) {
    setEntityType(type);
    setEntityId(id);
    setEntitySearch(name);
    setShowEntitySearch(false);
    setEntityResults([]);
  }

  function clearEntity() {
    setEntityType("");
    setEntityId("");
    setEntitySearch("");
    setShowEntitySearch(false);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);

    if (isCreating) {
      const result = await createTaskAction({
        title: title.trim(),
        body: body.trim() || null,
        kind,
        priority,
        due_at_ms: dueMs,
        entity_type: entityType || null,
        entity_id: entityId || null,
        checklist: checklist.length > 0 ? checklist : null,
        recurrence: recurrence || null,
      });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    } else if (task) {
      const result = await updateTaskAction(task.id, {
        title: title.trim(),
        body: body.trim() || null,
        kind,
        priority,
        due_at_ms: dueMs,
        entity_type: entityType || null,
        entity_id: entityId || null,
        checklist: checklist.length > 0 ? checklist : null,
        recurrence: recurrence || null,
      });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    }
  }

  async function handleStatusChange(to: TaskStatus) {
    if (!task) return;
    setSaving(true);
    setError(null);
    const result = await transitionTaskAction(task.id, to);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  async function handleCheckToggle(itemId: string) {
    const updated = checklist.map((c) =>
      c.id === itemId
        ? { ...c, checked: !c.checked, checked_at: !c.checked ? new Date().toISOString() : null }
        : c,
    );
    setChecklist(updated);
    if (task) {
      await updateChecklistAction(task.id, updated);
      onSaved();
    }
  }

  function addChecklistItem() {
    if (!newCheckItem.trim()) return;
    setChecklist((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: newCheckItem.trim(),
        checked: false,
        checked_at: null,
      },
    ]);
    setNewCheckItem("");
  }

  function removeChecklistItem(itemId: string) {
    setChecklist((prev) => prev.filter((c) => c.id !== itemId));
  }

  function moveChecklistItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= checklist.length) return;
    const next = [...checklist];
    [next[index], next[target]] = [next[target], next[index]];
    setChecklist(next);
  }

  async function handleDelete() {
    if (!task) return;
    setSaving(true);
    const result = await deleteTaskAction(task.id);
    setSaving(false);
    if (result.ok) {
      onSaved();
      onClose();
    } else {
      setError(result.error);
    }
  }

  const legalTransitions = task
    ? getLegalTransitions(task.status as TaskStatus, task.kind as TaskKind)
    : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={reduced ? { duration: 0 } : { ...houseSpring, duration: 0.34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col overflow-y-auto"
            style={{
              background: "var(--color-surface-1)",
              borderLeft: "1px solid rgba(253, 245, 230, 0.06)",
            }}
            role="dialog"
            aria-label={isCreating ? "Create task" : `Edit task: ${task?.title ?? ""}`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.06)" }}
            >
              <h2 className="font-[family-name:var(--font-body)] text-[16px] font-medium text-[color:var(--color-brand-cream)]">
                {isCreating ? "New task" : "Edit task"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="rounded-md p-1.5 text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-5 px-5 py-5">
              {/* Error */}
              {error && (
                <div
                  className="rounded-md px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]"
                  style={{ background: "rgba(178, 40, 72, 0.08)", border: "1px solid rgba(178, 40, 72, 0.2)" }}
                >
                  {error}
                </div>
              )}

              {/* Title */}
              <FieldGroup label="Title">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs doing"
                  className="w-full rounded-md bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
                  style={{
                    border: "1px solid rgba(253, 245, 230, 0.08)",
                    background: "rgba(15, 15, 14, 0.3)",
                  }}
                />
              </FieldGroup>

              {/* Body / notes */}
              <FieldGroup label="Notes">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Optional details"
                  rows={3}
                  className="w-full resize-y rounded-md bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
                  style={{
                    border: "1px solid rgba(253, 245, 230, 0.08)",
                    background: "rgba(15, 15, 14, 0.3)",
                  }}
                />
              </FieldGroup>

              {/* Kind + Priority row */}
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Kind">
                  <DrawerSelect
                    value={kind}
                    onChange={(v) => setKind(v as TaskKind)}
                    options={TASK_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
                  />
                </FieldGroup>
                <FieldGroup label="Priority">
                  <DrawerSelect
                    value={priority}
                    onChange={(v) => setPriority(v as TaskPriority)}
                    options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
                  />
                </FieldGroup>
              </div>

              {/* Status (edit mode only) */}
              {task && (
                <FieldGroup label="Status">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)]"
                      style={{
                        letterSpacing: "1.5px",
                        background: "rgba(178, 40, 72, 0.16)",
                        border: "1px solid rgba(178, 40, 72, 0.35)",
                      }}
                    >
                      {STATUS_LABELS[task.status as TaskStatus] ?? task.status}
                    </span>
                    {legalTransitions.map((to) => (
                      <button
                        key={to}
                        type="button"
                        onClick={() => handleStatusChange(to)}
                        disabled={saving}
                        className="rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors hover:text-[color:var(--color-brand-cream)] hover:bg-[color:var(--color-surface-3)] disabled:opacity-50"
                        style={{
                          letterSpacing: "1.5px",
                          border: "1px solid rgba(253, 245, 230, 0.05)",
                        }}
                      >
                        → {STATUS_LABELS[to] ?? to}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              )}

              {/* Due date */}
              <FieldGroup label="Due date">
                <input
                  type="text"
                  value={dueInput}
                  onChange={(e) => setDueInput(e.target.value)}
                  onBlur={handleDueBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleDueBlur();
                  }}
                  placeholder="tomorrow, friday, 2026-05-01"
                  className="w-full rounded-md bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
                  style={{
                    border: "1px solid rgba(253, 245, 230, 0.08)",
                    background: "rgba(15, 15, 14, 0.3)",
                  }}
                />
                {dueMs && (
                  <button
                    type="button"
                    onClick={() => {
                      setDueMs(null);
                      setDueInput("");
                    }}
                    className="mt-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]"
                    style={{ letterSpacing: "1.5px" }}
                  >
                    Clear date
                  </button>
                )}
              </FieldGroup>

              {/* Recurrence */}
              <FieldGroup label="Recurrence">
                <DrawerSelect
                  value={recurrence}
                  onChange={(v) => setRecurrence(v as TaskRecurrence | "")}
                  options={[
                    { value: "", label: "None" },
                    ...TASK_RECURRENCES.map((r) => ({
                      value: r,
                      label: RECURRENCE_LABELS[r] ?? r,
                    })),
                  ]}
                />
              </FieldGroup>

              {/* Entity link */}
              <FieldGroup label="Linked to">
                {entityId ? (
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)]">
                      {entitySearch || `${entityType}: ${entityId}`}
                    </span>
                    <button
                      type="button"
                      onClick={clearEntity}
                      className="text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={entitySearch}
                      onChange={(e) => handleEntitySearch(e.target.value)}
                      onFocus={() => setShowEntitySearch(true)}
                      placeholder="Search contacts or companies"
                      className="w-full rounded-md bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
                      style={{
                        border: "1px solid rgba(253, 245, 230, 0.08)",
                        background: "rgba(15, 15, 14, 0.3)",
                      }}
                    />
                    {showEntitySearch && entityResults.length > 0 && (
                      <div
                        className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md"
                        style={{
                          background: "var(--color-surface-2)",
                          border: "1px solid rgba(253, 245, 230, 0.08)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        }}
                      >
                        {entityResults.map((r) => (
                          <button
                            key={`${r.type}-${r.id}`}
                            type="button"
                            onClick={() => selectEntity(r.id, r.name, r.type)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] transition-colors hover:bg-[color:var(--color-surface-3)]"
                          >
                            <span
                              className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                              style={{ letterSpacing: "1.5px" }}
                            >
                              {r.type}
                            </span>
                            {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </FieldGroup>

              {/* Checklist */}
              <FieldGroup label="Checklist">
                <div className="space-y-1.5">
                  {checklist.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleCheckToggle(item.id)}
                        className="accent-[color:var(--color-brand-red)]"
                      />
                      <span
                        className="flex-1 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)]"
                        style={{
                          textDecoration: item.checked ? "line-through" : "none",
                          opacity: item.checked ? 0.5 : 1,
                        }}
                      >
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveChecklistItem(i, -1)}
                        disabled={i === 0}
                        className="text-[color:var(--color-neutral-500)] disabled:opacity-25"
                        aria-label="Move up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveChecklistItem(i, 1)}
                        disabled={i === checklist.length - 1}
                        className="text-[color:var(--color-neutral-500)] disabled:opacity-25"
                        aria-label="Move down"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(item.id)}
                        className="text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-red)]"
                        aria-label="Remove item"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCheckItem}
                      onChange={(e) => setNewCheckItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChecklistItem();
                        }
                      }}
                      placeholder="Add item"
                      className="flex-1 rounded-md bg-transparent px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
                      style={{
                        border: "1px solid rgba(253, 245, 230, 0.05)",
                        background: "rgba(15, 15, 14, 0.2)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={addChecklistItem}
                      className="text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]"
                      aria-label="Add checklist item"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </FieldGroup>

              {/* Rejection feedback (read-only, edit mode only) */}
              {task?.rejection_feedback && (
                <FieldGroup label="Rejection feedback">
                  <div
                    className="rounded-md px-3 py-2 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-neutral-300)]"
                    style={{
                      background: "rgba(242, 140, 82, 0.06)",
                      border: "1px solid rgba(242, 140, 82, 0.15)",
                    }}
                  >
                    {task.rejection_feedback}
                  </div>
                </FieldGroup>
              )}

              {/* Metadata (edit mode only) */}
              {task && (
                <div className="space-y-1 pt-2" style={{ borderTop: "1px solid rgba(253, 245, 230, 0.04)" }}>
                  <MetaLine label="Created" value={formatTimestamp(task.created_at_ms, "Australia/Melbourne")} />
                  <MetaLine label="Updated" value={formatTimestamp(task.updated_at_ms, "Australia/Melbourne")} />
                  {task.completed_at_ms && (
                    <MetaLine label="Completed" value={formatTimestamp(task.completed_at_ms, "Australia/Melbourne")} />
                  )}
                  {task.source_braindump_id && (
                    <MetaLine label="Source" value="Braindump" />
                  )}
                  {task.parent_recurrence_id && (
                    <MetaLine label="Recurrence" value="Spawned from recurring task" />
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderTop: "1px solid rgba(253, 245, 230, 0.06)" }}
            >
              <div>
                {task && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-red)] disabled:opacity-50"
                    style={{ letterSpacing: "1.5px" }}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase transition-colors disabled:opacity-50"
                  style={{
                    letterSpacing: "1.5px",
                    color: "var(--color-brand-cream)",
                    background: "rgba(178, 40, 72, 0.16)",
                    border: "1px solid rgba(178, 40, 72, 0.35)",
                  }}
                >
                  <Check size={14} />
                  {isCreating ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function DrawerSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md bg-transparent px-3 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] focus:outline-none focus:border-[color:rgba(244,160,176,0.35)]"
      style={{
        border: "1px solid rgba(253, 245, 230, 0.08)",
        background: "rgba(15, 15, 14, 0.3)",
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

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </span>
      <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
        {value}
      </span>
    </div>
  );
}
