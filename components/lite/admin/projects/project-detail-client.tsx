"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Check,
  CheckCheck,
  X,
  Trash2,
  Target,
  AlertTriangle,
  Clock,
  ListChecks,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { houseSpring } from "@/lib/design-tokens";
import type {
  ProjectStatus,
  ProjectBreakdown,
  DraftTask,
} from "@/lib/projects/types";

interface ProjectRow {
  id: string;
  title: string;
  brain_dump: string;
  status: string;
  breakdown_json: unknown;
  draft_tasks_json: unknown;
  updated_at_ms: number;
  created_at_ms: number;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
}
import {
  generateBreakdownAction,
  updateProjectAction,
  deleteProjectAction,
  approveDraftTasksAction,
  removeDraftTaskAction,
} from "@/app/lite/projects/actions";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  idea: "var(--color-brand-orange)",
  planning: "var(--color-brand-pink)",
  active: "var(--color-brand-cream)",
  paused: "var(--color-neutral-500)",
  completed: "var(--color-green-400, #4ade80)",
  archived: "var(--color-neutral-600)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  project: ProjectRow;
  tasks: TaskRow[];
}

export function ProjectDetailClient({ project, tasks }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = React.useState(false);
  const [approvingAll, setApprovingAll] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [selectedDrafts, setSelectedDrafts] = React.useState<Set<string>>(
    new Set(),
  );

  const breakdown = project.breakdown_json as ProjectBreakdown | null;
  const draftTasks = (project.draft_tasks_json as DraftTask[] | null) ?? [];
  const pendingDrafts = draftTasks.filter((d) => !d.approved);
  const status = project.status as ProjectStatus;

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateBreakdownAction(project.id);
    setGenerating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleStatusChange(newStatus: ProjectStatus) {
    await updateProjectAction(project.id, { status: newStatus });
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteProjectAction(project.id);
    if (result.ok) {
      router.push("/lite/projects");
    }
    setDeleting(false);
  }

  function toggleDraft(tempId: string) {
    setSelectedDrafts((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  }

  function selectAllPending() {
    setSelectedDrafts(new Set(pendingDrafts.map((d) => d.temp_id)));
  }

  async function handleApproveSelected() {
    if (selectedDrafts.size === 0) return;
    setApprovingAll(true);
    await approveDraftTasksAction(project.id, Array.from(selectedDrafts));
    setSelectedDrafts(new Set());
    setApprovingAll(false);
    router.refresh();
  }

  async function handleRemoveDraft(tempId: string) {
    await removeDraftTaskAction(project.id, tempId);
    setSelectedDrafts((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
    router.refresh();
  }

  return (
    <div className="px-4 pb-12">
      {/* Back + header */}
      <header className="pt-6 pb-5">
        <button
          onClick={() => router.push("/lite/projects")}
          className="mb-4 flex items-center gap-1.5 font-[family-name:var(--font-body)] text-[13px] transition-colors"
          style={{ color: "var(--color-neutral-500)" }}
        >
          <ArrowLeft size={14} />
          Projects
        </button>

        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Projects
        </div>

        <div className="mt-3 flex items-start justify-between gap-4">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none"
            style={{
              color: "var(--color-brand-cream)",
              letterSpacing: "-0.4px",
            }}
          >
            {project.title}
          </h1>

          {/* Status selector */}
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) =>
                handleStatusChange(e.target.value as ProjectStatus)
              }
              className="rounded-lg border bg-transparent px-3 py-1.5 font-[family-name:var(--font-label)] text-[11px] uppercase outline-none"
              style={{
                letterSpacing: "1.5px",
                borderColor: "var(--color-neutral-700)",
                color: STATUS_COLORS[status],
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  style={{
                    background: "var(--color-surface-0)",
                    color: "var(--color-neutral-300)",
                  }}
                >
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[color:var(--color-surface-1)]"
              style={{ color: "var(--color-neutral-600)" }}
              aria-label="Delete project"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="mb-6 overflow-hidden"
          >
            <div
              className="flex items-center gap-3 rounded-xl border p-4"
              style={{
                borderColor: "var(--color-brand-red)",
                background: "var(--color-surface-1)",
              }}
            >
              <p
                className="flex-1 font-[family-name:var(--font-body)] text-[14px]"
                style={{ color: "var(--color-neutral-300)" }}
              >
                Delete this project? This won't remove any already-approved
                tasks.
              </p>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg px-4 py-1.5 font-[family-name:var(--font-label)] text-[11px] uppercase"
                style={{
                  letterSpacing: "1.5px",
                  background: "var(--color-brand-red)",
                  color: "var(--color-brand-cream)",
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px]"
                style={{ color: "var(--color-neutral-500)" }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brain dump */}
      <section className="mb-8">
        <SectionHeading>Brain dump</SectionHeading>
        <p
          className="whitespace-pre-wrap rounded-xl border p-4 font-[family-name:var(--font-body)] text-[14px] leading-[1.6]"
          style={{
            borderColor: "var(--color-neutral-800)",
            color: "var(--color-neutral-300)",
            background: "var(--color-surface-0)",
          }}
        >
          {project.brain_dump}
        </p>
      </section>

      {/* AI Breakdown */}
      {!breakdown ? (
        <section className="mb-8">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl border px-6 py-4 font-[family-name:var(--font-label)] text-[12px] uppercase transition-colors disabled:opacity-50"
            style={{
              letterSpacing: "1.5px",
              borderColor: "var(--color-neutral-800)",
              color: "var(--color-brand-pink)",
              background: "var(--color-surface-0)",
            }}
          >
            <Sparkles size={16} />
            {generating
              ? "Mapping it out…"
              : "Map this out — generate breakdown & draft tasks"}
          </button>
        </section>
      ) : (
        <>
          {/* Summary */}
          <section className="mb-8">
            <SectionHeading>Summary</SectionHeading>
            <p
              className="font-[family-name:var(--font-body)] text-[14px] leading-[1.6]"
              style={{ color: "var(--color-neutral-300)" }}
            >
              {breakdown.summary}
            </p>
          </section>

          {/* Goals */}
          <section className="mb-8">
            <SectionHeading icon={Target}>Goals</SectionHeading>
            <ul className="space-y-2">
              {breakdown.goals.map((goal, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 font-[family-name:var(--font-body)] text-[14px] leading-[1.5]"
                  style={{ color: "var(--color-neutral-300)" }}
                >
                  <span
                    className="mt-0.5 font-[family-name:var(--font-label)] text-[11px]"
                    style={{ color: "var(--color-brand-pink)" }}
                  >
                    {i + 1}.
                  </span>
                  {goal}
                </li>
              ))}
            </ul>
          </section>

          {/* Phases */}
          <section className="mb-8">
            <SectionHeading icon={ListChecks}>Phases</SectionHeading>
            <div className="space-y-3">
              {breakdown.phases.map((phase, i) => (
                <PhaseCard key={i} phase={phase} index={i} />
              ))}
            </div>
          </section>

          {/* Risks */}
          {breakdown.risks.length > 0 && (
            <section className="mb-8">
              <SectionHeading icon={AlertTriangle}>
                Risks & blockers
              </SectionHeading>
              <ul className="space-y-2">
                {breakdown.risks.map((risk, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-[family-name:var(--font-body)] text-[14px] leading-[1.5]"
                    style={{ color: "var(--color-neutral-400)" }}
                  >
                    <AlertTriangle
                      size={14}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--color-brand-orange)" }}
                    />
                    {risk}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Effort */}
          <section className="mb-8">
            <SectionHeading icon={Clock}>Estimated effort</SectionHeading>
            <p
              className="font-[family-name:var(--font-body)] text-[14px]"
              style={{ color: "var(--color-neutral-300)" }}
            >
              {breakdown.estimated_effort}
            </p>
          </section>

          {/* Regenerate */}
          <div className="mb-8">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 font-[family-name:var(--font-body)] text-[13px] transition-colors disabled:opacity-50"
              style={{ color: "var(--color-neutral-500)" }}
            >
              <Sparkles size={13} />
              {generating ? "Regenerating…" : "Regenerate breakdown"}
            </button>
          </div>
        </>
      )}

      {/* Draft tasks */}
      {pendingDrafts.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <SectionHeading>
              Draft tasks ({pendingDrafts.length})
            </SectionHeading>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllPending}
                className="font-[family-name:var(--font-body)] text-[12px] transition-colors"
                style={{ color: "var(--color-neutral-500)" }}
              >
                Select all
              </button>
              <button
                onClick={handleApproveSelected}
                disabled={selectedDrafts.size === 0 || approvingAll}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[11px] uppercase transition-opacity disabled:opacity-40"
                style={{
                  letterSpacing: "1.5px",
                  background: "var(--color-brand-red)",
                  color: "var(--color-brand-cream)",
                }}
              >
                <CheckCheck size={14} />
                {approvingAll
                  ? "Approving…"
                  : `Approve${selectedDrafts.size > 0 ? ` (${selectedDrafts.size})` : ""}`}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {pendingDrafts.map((draft) => (
                <motion.div
                  key={draft.temp_id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, height: 0 }}
                  transition={houseSpring}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                  style={{
                    borderColor: selectedDrafts.has(draft.temp_id)
                      ? "var(--color-brand-pink)"
                      : "var(--color-neutral-800)",
                    background: "var(--color-surface-0)",
                  }}
                >
                  <button
                    onClick={() => toggleDraft(draft.temp_id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors"
                    style={{
                      borderColor: selectedDrafts.has(draft.temp_id)
                        ? "var(--color-brand-pink)"
                        : "var(--color-neutral-600)",
                      background: selectedDrafts.has(draft.temp_id)
                        ? "var(--color-brand-pink)"
                        : "transparent",
                    }}
                  >
                    {selectedDrafts.has(draft.temp_id) && (
                      <Check
                        size={12}
                        style={{ color: "var(--color-brand-cream)" }}
                      />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate font-[family-name:var(--font-body)] text-[13px]"
                      style={{ color: "var(--color-neutral-200)" }}
                    >
                      {draft.title}
                    </p>
                    <p
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase"
                      style={{
                        letterSpacing: "1px",
                        color: "var(--color-neutral-600)",
                      }}
                    >
                      {draft.phase}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRemoveDraft(draft.temp_id)}
                    className="shrink-0 rounded p-1 transition-colors hover:bg-[color:var(--color-surface-1)]"
                    style={{ color: "var(--color-neutral-600)" }}
                    aria-label="Remove draft task"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Approved / active tasks */}
      {tasks.length > 0 && (
        <section>
          <SectionHeading>
            Tasks ({tasks.length})
          </SectionHeading>
          <div className="space-y-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                style={{
                  borderColor: "var(--color-neutral-800)",
                  background: "var(--color-surface-0)",
                }}
              >
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      task.status === "done"
                        ? "var(--color-green-400, #4ade80)"
                        : task.status === "in_progress"
                          ? "var(--color-brand-pink)"
                          : "var(--color-neutral-600)",
                  }}
                />
                <p
                  className="flex-1 truncate font-[family-name:var(--font-body)] text-[13px]"
                  style={{
                    color:
                      task.status === "done"
                        ? "var(--color-neutral-500)"
                        : "var(--color-neutral-200)",
                    textDecoration:
                      task.status === "done" ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </p>
                <span
                  className="shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase"
                  style={{
                    letterSpacing: "1px",
                    color: "var(--color-neutral-600)",
                  }}
                >
                  {task.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <h2
      className="mb-3 flex items-center gap-2 font-[family-name:var(--font-label)] text-[11px] uppercase"
      style={{
        letterSpacing: "2px",
        color: "var(--color-neutral-500)",
      }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </h2>
  );
}

function PhaseCard({
  phase,
  index,
}: {
  phase: ProjectBreakdown["phases"][number];
  index: number;
}) {
  const [open, setOpen] = React.useState(index === 0);

  return (
    <div
      className="rounded-xl border"
      style={{
        borderColor: "var(--color-neutral-800)",
        background: "var(--color-surface-0)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-[family-name:var(--font-label)] text-[11px]"
          style={{
            background: "var(--color-surface-1)",
            color: "var(--color-brand-pink)",
          }}
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="font-[family-name:var(--font-display)] text-[16px] leading-tight"
            style={{ color: "var(--color-brand-cream)" }}
          >
            {phase.name}
          </p>
        </div>
        <span style={{ color: "var(--color-neutral-600)" }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={houseSpring}
            className="overflow-hidden"
          >
            <div className="border-t px-4 pt-3 pb-4" style={{ borderColor: "var(--color-neutral-800)" }}>
              <p
                className="mb-3 font-[family-name:var(--font-body)] text-[13px] leading-[1.5]"
                style={{ color: "var(--color-neutral-400)" }}
              >
                {phase.description}
              </p>
              <ul className="space-y-1.5">
                {phase.tasks.map((task, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-[family-name:var(--font-body)] text-[13px] leading-[1.4]"
                    style={{ color: "var(--color-neutral-300)" }}
                  >
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--color-neutral-600)" }}
                    />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
