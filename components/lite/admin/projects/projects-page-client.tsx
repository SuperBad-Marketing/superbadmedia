"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Sparkles,
  Clock,
  CheckCircle2,
  Pause,
  Lightbulb,
  Archive,
  ChevronRight,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type { ProjectStatus, DraftTask } from "@/lib/projects/types";

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
import { createProjectAction } from "@/app/lite/projects/actions";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  idea: {
    label: "Idea",
    color: "var(--color-brand-orange)",
    icon: Lightbulb,
  },
  planning: {
    label: "Planning",
    color: "var(--color-brand-pink)",
    icon: Sparkles,
  },
  active: {
    label: "Active",
    color: "var(--color-brand-cream)",
    icon: Clock,
  },
  paused: {
    label: "Paused",
    color: "var(--color-neutral-500)",
    icon: Pause,
  },
  completed: {
    label: "Completed",
    color: "var(--color-green-400, #4ade80)",
    icon: CheckCircle2,
  },
  archived: {
    label: "Archived",
    color: "var(--color-neutral-600)",
    icon: Archive,
  },
};

type FilterTab = "all" | "active" | "ideas" | "completed";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "ideas", label: "Ideas" },
  { id: "completed", label: "Done" },
];

function matchesFilter(status: ProjectStatus, filter: FilterTab): boolean {
  if (filter === "all") return true;
  if (filter === "active") return status === "active" || status === "planning";
  if (filter === "ideas") return status === "idea";
  if (filter === "completed")
    return status === "completed" || status === "archived";
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  projects: ProjectRow[];
}

export function ProjectsPageClient({ projects }: Props) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [showNew, setShowNew] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDump, setNewDump] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const filtered = projects.filter((p) =>
    matchesFilter(p.status as ProjectStatus, filter),
  );

  async function handleCreate() {
    if (!newTitle.trim() || !newDump.trim()) return;
    setCreating(true);
    const result = await createProjectAction({
      title: newTitle.trim(),
      brain_dump: newDump.trim(),
    });
    setCreating(false);
    if (result.ok) {
      setShowNew(false);
      setNewTitle("");
      setNewDump("");
      router.push(`/lite/projects/${result.data.id}`);
    }
  }

  return (
    <div className="px-4 pb-8">
      {/* Filter tabs */}
      <div className="mb-6 flex items-center gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className="relative rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] transition-colors"
            style={{
              color:
                filter === tab.id
                  ? "var(--color-brand-cream)"
                  : "var(--color-neutral-500)",
              background:
                filter === tab.id
                  ? "var(--color-surface-1)"
                  : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-[family-name:var(--font-label)] text-[11px] uppercase transition-colors"
          style={{
            letterSpacing: "1.5px",
            color: "var(--color-brand-cream)",
            background: "var(--color-surface-1)",
          }}
        >
          <Plus size={14} />
          New project
        </button>
      </div>

      {/* New project form */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="mb-6 overflow-hidden"
          >
            <div
              className="rounded-xl border p-5"
              style={{
                borderColor: "var(--color-neutral-800)",
                background: "var(--color-surface-1)",
              }}
            >
              <h3
                className="mb-4 font-[family-name:var(--font-display)] text-[20px] leading-none"
                style={{ color: "var(--color-brand-cream)" }}
              >
                New project
              </h3>
              <input
                type="text"
                placeholder="Project name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mb-3 w-full rounded-lg border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[14px] outline-none transition-colors focus:border-[color:var(--color-brand-pink)]"
                style={{
                  borderColor: "var(--color-neutral-700)",
                  color: "var(--color-brand-cream)",
                }}
              />
              <textarea
                placeholder="Brain dump everything — what's the idea, why you want to do it, any thoughts on how it could work, timelines, concerns... just get it all out."
                value={newDump}
                onChange={(e) => setNewDump(e.target.value)}
                rows={6}
                className="mb-4 w-full resize-none rounded-lg border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[14px] leading-[1.6] outline-none transition-colors focus:border-[color:var(--color-brand-pink)]"
                style={{
                  borderColor: "var(--color-neutral-700)",
                  color: "var(--color-neutral-300)",
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim() || !newDump.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[12px] uppercase transition-opacity disabled:opacity-40"
                  style={{
                    letterSpacing: "1.5px",
                    background: "var(--color-brand-red)",
                    color: "var(--color-brand-cream)",
                  }}
                >
                  {creating ? "Creating…" : "Create & map it out"}
                  <Sparkles size={14} />
                </button>
                <button
                  onClick={() => {
                    setShowNew(false);
                    setNewTitle("");
                    setNewDump("");
                  }}
                  className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-colors"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project cards */}
      {filtered.length === 0 ? (
        <div
          className="mt-12 text-center font-[family-name:var(--font-body)] text-[14px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {projects.length === 0
            ? 'No projects yet. Hit "New project" to brain dump one.'
            : "Nothing matches that filter."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/lite/projects/${project.id}`)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectRow;
  onClick: () => void;
}) {
  const status = project.status as ProjectStatus;
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const drafts = (project.draft_tasks_json as DraftTask[] | null) ?? [];
  const pendingCount = drafts.filter((d) => !d.approved).length;
  const approvedCount = drafts.filter((d) => d.approved).length;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={houseSpring}
      onClick={onClick}
      className="group relative flex flex-col items-start rounded-xl border p-4 text-left transition-colors"
      style={{
        borderColor: "var(--color-neutral-800)",
        background: "var(--color-surface-0)",
      }}
    >
      {/* Status badge */}
      <div className="mb-3 flex w-full items-center justify-between">
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{
            letterSpacing: "1.5px",
            color: config.color,
            background: "var(--color-surface-1)",
          }}
        >
          <Icon size={12} />
          {config.label}
        </span>
        <ChevronRight
          size={16}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--color-neutral-500)" }}
        />
      </div>

      {/* Title */}
      <h3
        className="mb-1.5 font-[family-name:var(--font-display)] text-[18px] leading-tight"
        style={{ color: "var(--color-brand-cream)" }}
      >
        {project.title}
      </h3>

      {/* Brain dump preview */}
      <p
        className="mb-3 line-clamp-2 font-[family-name:var(--font-body)] text-[13px] leading-[1.5]"
        style={{ color: "var(--color-neutral-400)" }}
      >
        {project.brain_dump}
      </p>

      {/* Footer stats */}
      <div
        className="mt-auto flex w-full items-center gap-3 border-t pt-3 font-[family-name:var(--font-body)] text-[11px]"
        style={{
          borderColor: "var(--color-neutral-800)",
          color: "var(--color-neutral-500)",
        }}
      >
        {project.breakdown_json ? (
          <>
            {pendingCount > 0 && (
              <span style={{ color: "var(--color-brand-orange)" }}>
                {pendingCount} draft task{pendingCount === 1 ? "" : "s"}
              </span>
            )}
            {approvedCount > 0 && (
              <span>
                {approvedCount} approved
              </span>
            )}
            {pendingCount === 0 && approvedCount === 0 && (
              <span>Mapped out</span>
            )}
          </>
        ) : (
          <span
            className="flex items-center gap-1"
            style={{ color: "var(--color-brand-pink)" }}
          >
            <Sparkles size={11} />
            Ready to map out
          </span>
        )}
        <span className="ml-auto">
          {new Date(project.updated_at_ms).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
    </motion.button>
  );
}
