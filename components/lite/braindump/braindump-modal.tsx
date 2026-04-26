"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ArrowLeft, ChevronDown, Image, Video, CheckSquare } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { formatTimestamp } from "@/lib/format-timestamp";
import {
  TASK_KINDS,
  TASK_PRIORITIES,
  type TaskKind,
  type TaskPriority,
} from "@/lib/tasks/types";
import { CONTENT_TYPES, type ContentType } from "@/lib/db/schema/content-studio";
import { PILLAR_SLUGS, SCRIPT_FORMATS, type PillarSlug, type ScriptFormat } from "@/lib/db/schema/talking-head";
import type {
  ParsedTask,
  ParsedContentIdea,
  ParsedScriptIdea,
  SurfaceContext,
} from "@/lib/ai/parse-braindump";
import {
  parseBraindumpAction,
  commitBraindumpAction,
  type CommitTask,
  type CommitContentIdea,
  type CommitScriptIdea,
} from "@/app/lite/tasks/braindump-actions";
import { searchEntitiesAction } from "@/app/lite/tasks/actions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<TaskKind, string> = {
  personal: "Personal",
  admin: "Admin",
  prospect_followup: "Prospect follow-up",
  client_deliverable: "Client deliverable",
  client_task: "Client task",
};

const KIND_COLORS: Record<TaskKind, string> = {
  personal: "var(--color-neutral-500)",
  admin: "var(--color-brand-cream)",
  prospect_followup: "var(--color-brand-orange)",
  client_deliverable: "var(--color-brand-pink)",
  client_task: "var(--color-brand-pink)",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  normal: "Normal",
  low: "Low",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  announcement: "Announcement",
  anti_motivation: "Anti-motivation",
  portfolio: "Portfolio",
  tips: "Tips",
  testimonial: "Testimonial",
  behind_the_scenes: "Behind the scenes",
};

const PILLAR_LABELS: Record<PillarSlug, string> = {
  agency_wont_say: "Agency won't say",
  shooting_small_business: "Shooting small biz",
  marketing_doesnt_work: "Marketing doesn't work",
  uncomfortable_truth: "Uncomfortable truth",
  if_i_were_brand: "If I were [brand]",
  overheard_in_marketing: "Overheard in marketing",
};

const FORMAT_LABELS: Record<ScriptFormat, string> = {
  short: "Short (30-90s)",
  mid: "Mid (2-5min)",
};

type ModalPhase = "input" | "parsing" | "review" | "committing";

// ---------------------------------------------------------------------------
// Natural-language date parsing
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
// Confidence indicator
// ---------------------------------------------------------------------------

function ConfidenceDot({ value }: { value: number }) {
  const color =
    value >= 0.7
      ? "var(--color-semantic-success)"
      : value >= 0.4
        ? "var(--color-brand-orange)"
        : "var(--color-neutral-500)";
  return (
    <span
      aria-label={`Confidence: ${Math.round(value * 100)}%`}
      className="inline-block size-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// ---------------------------------------------------------------------------
// Inline select
// ---------------------------------------------------------------------------

function InlineSelect<T extends string>({
  value,
  options,
  onChange,
  confidence,
}: {
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
  confidence?: number;
}) {
  return (
    <span className="relative inline-flex items-center gap-1">
      {confidence != null && <ConfidenceDot value={confidence} />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="cursor-pointer appearance-none border-none bg-transparent pr-4 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-300)] outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)] rounded-sm"
        style={{
          color: options.find((o) => o.value === value)?.color ?? undefined,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={10}
        className="pointer-events-none absolute right-0 text-[color:var(--color-neutral-500)]"
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-3 first:pt-0">
      <span className="text-[color:var(--color-neutral-500)]">{icon}</span>
      <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[2px] text-[color:var(--color-neutral-500)]">
        {label}
      </span>
      <span className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-500)]">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proto-task card
// ---------------------------------------------------------------------------

function ProtoTaskCard({
  task,
  onUpdate,
  onDelete,
  disabled,
}: {
  task: ParsedTask;
  onUpdate: (updates: Partial<ParsedTask>) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [dueInput, setDueInput] = React.useState(
    task.due_at_ms ? formatTimestamp(task.due_at_ms) : "",
  );
  const [showEntitySearch, setShowEntitySearch] = React.useState(false);
  const [entityQuery, setEntityQuery] = React.useState("");
  const [entityResults, setEntityResults] = React.useState<
    { type: string; id: string; name: string }[]
  >([]);
  const [showAlternatives, setShowAlternatives] = React.useState(false);
  const entitySearchRef = React.useRef<HTMLInputElement>(null);

  const handleDueBlur = React.useCallback(() => {
    if (!dueInput.trim()) {
      onUpdate({ due_at_ms: null });
      return;
    }
    const parsed = parseNaturalDate(dueInput);
    if (parsed) {
      onUpdate({ due_at_ms: parsed });
      setDueInput(formatTimestamp(parsed));
    }
  }, [dueInput, onUpdate]);

  const handleDueKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!entityQuery.trim() || entityQuery.length < 2) {
      setEntityResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await searchEntitiesAction(entityQuery);
      const combined: { type: string; id: string; name: string }[] = [
        ...res.contacts.map((c) => ({ type: "contact", id: c.id, name: c.name })),
        ...res.companies.map((c) => ({ type: "company", id: c.id, name: c.name })),
      ];
      setEntityResults(combined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [entityQuery]);

  const hasAlternatives =
    task.alternatives?.entity && task.alternatives.entity.length > 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={houseSpring}
      className="relative rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] p-4"
    >
      <div className="mb-3 flex items-start gap-2">
        <ConfidenceDot value={task.confidence.title} />
        <input
          type="text"
          value={task.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          disabled={disabled}
          className="flex-1 bg-transparent font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none placeholder:text-[color:var(--color-neutral-500)] focus-visible:border-b focus-visible:border-[color:var(--color-accent-cta)]"
          placeholder="Task title"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Remove task"
          className="shrink-0 rounded-sm p-1 text-[color:var(--color-neutral-500)] outline-none transition-colors hover:text-[color:var(--color-brand-red)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[length:var(--text-small)]">
        <InlineSelect
          value={task.kind}
          options={TASK_KINDS.map((k) => ({
            value: k,
            label: KIND_LABELS[k],
            color: KIND_COLORS[k],
          }))}
          onChange={(v) => onUpdate({ kind: v })}
          confidence={task.confidence.kind}
        />
        <InlineSelect
          value={task.priority}
          options={TASK_PRIORITIES.map((p) => ({
            value: p,
            label: PRIORITY_LABELS[p],
          }))}
          onChange={(v) => onUpdate({ priority: v })}
          confidence={task.confidence.priority}
        />
        <span className="inline-flex items-center gap-1">
          <ConfidenceDot value={task.confidence.due} />
          <input
            type="text"
            value={dueInput}
            onChange={(e) => setDueInput(e.target.value)}
            onBlur={handleDueBlur}
            onKeyDown={handleDueKeyDown}
            disabled={disabled}
            placeholder="due date"
            className="w-28 bg-transparent font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none placeholder:text-[color:var(--color-neutral-500)] focus-visible:border-b focus-visible:border-[color:var(--color-accent-cta)]"
          />
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[length:var(--text-small)]">
        <ConfidenceDot value={task.confidence.entity} />
        {task.entity_name ? (
          <span className="inline-flex items-center gap-1">
            <span className="font-[family-name:var(--font-dm-sans)] text-[color:var(--color-neutral-300)]">
              {task.entity_name}
            </span>
            {hasAlternatives && (
              <button
                type="button"
                onClick={() => setShowAlternatives(!showAlternatives)}
                disabled={disabled}
                className="rounded-sm px-1 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-brand-orange)] outline-none hover:underline focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
              >
                ⇄
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  entity_type: null,
                  entity_id: null,
                  entity_name: null,
                })
              }
              disabled={disabled}
              className="rounded-sm px-1 text-[color:var(--color-neutral-500)] outline-none hover:text-[color:var(--color-neutral-300)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
              aria-label="Clear entity link"
            >
              <X size={10} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowEntitySearch(true);
              setTimeout(() => entitySearchRef.current?.focus(), 50);
            }}
            disabled={disabled}
            className="rounded-sm font-[family-name:var(--font-dm-sans)] text-[color:var(--color-neutral-500)] outline-none hover:text-[color:var(--color-neutral-300)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
          >
            + link entity
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAlternatives && hasAlternatives && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="mt-1 overflow-hidden rounded border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-2)]"
          >
            {task.alternatives!.entity!.map((alt) => (
              <button
                key={`${alt.type}-${alt.id}`}
                type="button"
                onClick={() => {
                  onUpdate({
                    entity_type: alt.type,
                    entity_id: alt.id,
                    entity_name: alt.name,
                  });
                  setShowAlternatives(false);
                }}
                className="block w-full px-3 py-1.5 text-left font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none hover:bg-[color:var(--color-surface-3)] focus-visible:bg-[color:var(--color-surface-3)]"
              >
                {alt.name}
                <span className="ml-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
                  {alt.type}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEntitySearch && !task.entity_name && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="mt-1 overflow-hidden"
          >
            <input
              ref={entitySearchRef}
              type="text"
              value={entityQuery}
              onChange={(e) => setEntityQuery(e.target.value)}
              placeholder="Search contacts or companies…"
              className="w-full rounded border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-2)] px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)] outline-none placeholder:text-[color:var(--color-neutral-500)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
            />
            {entityResults.length > 0 && (
              <div className="mt-0.5 rounded border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-2)]">
                {entityResults.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    type="button"
                    onClick={() => {
                      onUpdate({
                        entity_type: r.type,
                        entity_id: r.id,
                        entity_name: r.name,
                      });
                      setShowEntitySearch(false);
                      setEntityQuery("");
                      setEntityResults([]);
                    }}
                    className="block w-full px-3 py-1.5 text-left font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none hover:bg-[color:var(--color-surface-3)] focus-visible:bg-[color:var(--color-surface-3)]"
                  >
                    {r.name}
                    <span className="ml-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
                      {r.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Content idea card
// ---------------------------------------------------------------------------

function ContentIdeaCard({
  idea,
  onUpdate,
  onDelete,
  disabled,
}: {
  idea: ParsedContentIdea;
  onUpdate: (updates: Partial<ParsedContentIdea>) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={houseSpring}
      className="relative rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] p-4"
    >
      <div className="mb-3 flex items-start gap-2">
        <ConfidenceDot value={idea.confidence} />
        <textarea
          value={idea.brief}
          onChange={(e) => onUpdate({ brief: e.target.value })}
          disabled={disabled}
          rows={2}
          className="flex-1 resize-none bg-transparent font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none placeholder:text-[color:var(--color-neutral-500)] focus-visible:border-b focus-visible:border-[color:var(--color-accent-cta)]"
          placeholder="Content brief"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Remove content idea"
          className="shrink-0 rounded-sm p-1 text-[color:var(--color-neutral-500)] outline-none transition-colors hover:text-[color:var(--color-brand-red)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[length:var(--text-small)]">
        <InlineSelect
          value={idea.content_type}
          options={CONTENT_TYPES.map((t) => ({
            value: t,
            label: CONTENT_TYPE_LABELS[t],
          }))}
          onChange={(v) => onUpdate({ content_type: v })}
        />
        <span className="inline-flex items-center gap-1.5">
          <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
            Slides
          </span>
          <select
            value={idea.slide_count}
            onChange={(e) => onUpdate({ slide_count: Number(e.target.value) })}
            disabled={disabled}
            className="cursor-pointer appearance-none border-none bg-transparent pr-3 font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-300)] outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)] rounded-sm"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Single" : `${n} slides`}
              </option>
            ))}
          </select>
        </span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Script idea card
// ---------------------------------------------------------------------------

function ScriptIdeaCard({
  idea,
  onUpdate,
  onDelete,
  disabled,
}: {
  idea: ParsedScriptIdea;
  onUpdate: (updates: Partial<ParsedScriptIdea>) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={houseSpring}
      className="relative rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] p-4"
    >
      <div className="mb-2 flex items-start gap-2">
        <ConfidenceDot value={idea.confidence} />
        <input
          type="text"
          value={idea.topic}
          onChange={(e) => onUpdate({ topic: e.target.value })}
          disabled={disabled}
          className="flex-1 bg-transparent font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none placeholder:text-[color:var(--color-neutral-500)] focus-visible:border-b focus-visible:border-[color:var(--color-accent-cta)]"
          placeholder="Script topic"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Remove script idea"
          className="shrink-0 rounded-sm p-1 text-[color:var(--color-neutral-500)] outline-none transition-colors hover:text-[color:var(--color-brand-red)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {idea.angle && (
        <p className="mb-3 pl-3.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] italic text-[color:var(--color-neutral-400)]">
          {idea.angle}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 text-[length:var(--text-small)]">
        <InlineSelect
          value={idea.pillar}
          options={PILLAR_SLUGS.map((p) => ({
            value: p,
            label: PILLAR_LABELS[p],
          }))}
          onChange={(v) => onUpdate({ pillar: v })}
        />
        <InlineSelect
          value={idea.format}
          options={SCRIPT_FORMATS.map((f) => ({
            value: f,
            label: FORMAT_LABELS[f],
          }))}
          onChange={(v) => onUpdate({ format: v })}
        />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Shimmer loading state
// ---------------------------------------------------------------------------

function ParseShimmer() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="relative h-20 overflow-hidden rounded-lg bg-[color:var(--color-surface-2)] motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-white/5 motion-safe:after:to-transparent motion-safe:after:animate-[shimmer_1.6s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
      <p className="text-center text-pretty font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] italic text-[color:var(--color-neutral-500)]">
        parsing your brain…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function BraindumpModal({
  onClose,
  surfaceContext,
}: {
  onClose: () => void;
  surfaceContext: SurfaceContext | null;
}) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = React.useState<ModalPhase>("input");
  const [rawText, setRawText] = React.useState("");
  const [tasks, setTasks] = React.useState<ParsedTask[]>([]);
  const [contentIdeas, setContentIdeas] = React.useState<ParsedContentIdea[]>([]);
  const [scriptIdeas, setScriptIdeas] = React.useState<ParsedScriptIdea[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const totalItems = tasks.length + contentIdeas.length + scriptIdeas.length;

  React.useEffect(() => {
    if (phase === "input") {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [phase]);

  React.useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleParse = React.useCallback(async () => {
    if (!rawText.trim()) return;
    setPhase("parsing");
    setError(null);
    const result = await parseBraindumpAction(rawText, surfaceContext);
    if (!result.ok) {
      setError(result.error);
      setPhase("input");
      return;
    }
    setTasks(result.data.tasks);
    setContentIdeas(result.data.content_ideas);
    setScriptIdeas(result.data.script_ideas);
    setPhase("review");
  }, [rawText, surfaceContext]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleParse();
      }
    },
    [handleParse],
  );

  const handleUpdateTask = React.useCallback(
    (id: string, updates: Partial<ParsedTask>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  const handleDeleteTask = React.useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUpdateContent = React.useCallback(
    (id: string, updates: Partial<ParsedContentIdea>) => {
      setContentIdeas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      );
    },
    [],
  );

  const handleDeleteContent = React.useCallback((id: string) => {
    setContentIdeas((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleUpdateScript = React.useCallback(
    (id: string, updates: Partial<ParsedScriptIdea>) => {
      setScriptIdeas((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      );
    },
    [],
  );

  const handleDeleteScript = React.useCallback((id: string) => {
    setScriptIdeas((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleCommit = React.useCallback(async () => {
    if (totalItems === 0) return;
    setPhase("committing");
    setError(null);

    const commitTasks: CommitTask[] = tasks.map((t) => ({
      title: t.title,
      kind: t.kind,
      priority: t.priority,
      due_at_ms: t.due_at_ms,
      entity_type: t.entity_type,
      entity_id: t.entity_id,
      checklist: t.checklist,
    }));

    const commitContent: CommitContentIdea[] = contentIdeas.map((c) => ({
      brief: c.brief,
      content_type: c.content_type,
      slide_count: c.slide_count,
    }));

    const commitScripts: CommitScriptIdea[] = scriptIdeas.map((s) => ({
      topic: s.topic,
      pillar: s.pillar,
      format: s.format,
      angle: s.angle,
    }));

    const result = await commitBraindumpAction(
      rawText,
      surfaceContext,
      commitTasks,
      commitContent,
      commitScripts,
    );

    if (!result.ok) {
      setError(result.error);
      setPhase("review");
      return;
    }
    onClose();
  }, [tasks, contentIdeas, scriptIdeas, totalItems, rawText, surfaceContext, onClose]);

  const handleBack = React.useCallback(() => {
    setPhase("input");
    setTasks([]);
    setContentIdeas([]);
    setScriptIdeas([]);
  }, []);

  const isLocked = phase === "parsing" || phase === "committing";

  return (
    <>
      {/* Overlay */}
      <motion.div
        key="braindump-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <motion.div
        key="braindump-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Braindump"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={reducedMotion ? { duration: 0 } : houseSpring}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-neutral-700)] px-5 py-3">
          <div className="flex items-center gap-2">
            {phase === "review" && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-sm p-1 text-[color:var(--color-neutral-500)] outline-none transition-colors hover:text-[color:var(--color-neutral-100)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
                aria-label="Back to input"
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
              </button>
            )}
            <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] font-medium text-[color:var(--color-neutral-100)]">
              Braindump
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1 text-[color:var(--color-neutral-500)] outline-none transition-colors hover:text-[color:var(--color-neutral-100)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-3 rounded-lg border border-[color:var(--color-brand-red)]/30 bg-[color:var(--color-brand-red)]/10 px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-brand-red)]">
              {error}
            </div>
          )}

          {/* Input phase */}
          {(phase === "input" || phase === "parsing") && (
            <div>
              <textarea
                ref={textareaRef}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLocked}
                placeholder="dump it. tasks, content ideas, video topics — we'll sort it."
                rows={8}
                className="w-full resize-none rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-2)] p-4 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)] outline-none placeholder:italic placeholder:text-[color:var(--color-neutral-500)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)] disabled:opacity-50"
              />
              {phase === "parsing" && (
                <div className="mt-4">
                  <ParseShimmer />
                </div>
              )}
            </div>
          )}

          {/* Review phase */}
          {(phase === "review" || phase === "committing") && (
            <div className="flex flex-col gap-1">
              {/* Tasks section */}
              {tasks.length > 0 && (
                <div>
                  <SectionLabel
                    icon={<CheckSquare size={12} strokeWidth={1.5} />}
                    label="Tasks"
                    count={tasks.length}
                  />
                  <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {tasks.map((task) => (
                        <ProtoTaskCard
                          key={task.id}
                          task={task}
                          onUpdate={(updates) => handleUpdateTask(task.id, updates)}
                          onDelete={() => handleDeleteTask(task.id)}
                          disabled={phase === "committing"}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Content ideas section */}
              {contentIdeas.length > 0 && (
                <div>
                  <SectionLabel
                    icon={<Image size={12} strokeWidth={1.5} />}
                    label="Content Studio"
                    count={contentIdeas.length}
                  />
                  <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {contentIdeas.map((idea) => (
                        <ContentIdeaCard
                          key={idea.id}
                          idea={idea}
                          onUpdate={(updates) => handleUpdateContent(idea.id, updates)}
                          onDelete={() => handleDeleteContent(idea.id)}
                          disabled={phase === "committing"}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Script ideas section */}
              {scriptIdeas.length > 0 && (
                <div>
                  <SectionLabel
                    icon={<Video size={12} strokeWidth={1.5} />}
                    label="Script Studio"
                    count={scriptIdeas.length}
                  />
                  <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {scriptIdeas.map((idea) => (
                        <ScriptIdeaCard
                          key={idea.id}
                          idea={idea}
                          onUpdate={(updates) => handleUpdateScript(idea.id, updates)}
                          onDelete={() => handleDeleteScript(idea.id)}
                          disabled={phase === "committing"}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {totalItems === 0 && (
                <p className="py-8 text-center text-pretty font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] italic text-[color:var(--color-neutral-500)]">
                  nothing parsed. try again?
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--color-neutral-700)] px-5 py-3">
          {phase === "input" && (
            <>
              <span className="mr-auto font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
                ⌘↵ to parse
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none transition-colors hover:text-[color:var(--color-neutral-100)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="rounded-lg bg-[color:var(--color-accent-cta)] px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-100)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-1)] disabled:opacity-40"
              >
                Parse
              </button>
            </>
          )}
          {phase === "parsing" && (
            <button
              type="button"
              disabled
              className="rounded-lg bg-[color:var(--color-accent-cta)] px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-100)] opacity-40"
            >
              Parsing…
            </button>
          )}
          {phase === "review" && (
            <>
              <span className="mr-auto font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] tabular-nums text-[color:var(--color-neutral-500)]">
                {totalItems} item{totalItems !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)] outline-none transition-colors hover:text-[color:var(--color-neutral-100)] focus-visible:ring-1 focus-visible:ring-[color:var(--color-accent-cta)]"
              >
                Re-parse
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={totalItems === 0}
                className="rounded-lg bg-[color:var(--color-accent-cta)] px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-100)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-1)] disabled:opacity-40"
              >
                Commit
              </button>
            </>
          )}
          {phase === "committing" && (
            <button
              type="button"
              disabled
              className="rounded-lg bg-[color:var(--color-accent-cta)] px-4 py-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-100)] opacity-40"
            >
              Committing…
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
