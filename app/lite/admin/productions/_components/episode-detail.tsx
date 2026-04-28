"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Lightbulb,
  RefreshCw,
  Calendar,
  MapPin,
  Film,
  Mic,
  Camera,
  Wrench,
  CheckSquare,
  Scissors,
  ArrowUpRight,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { ProductionRow, ProductionChatMessageRow } from "@/lib/db/schema/productions";
import { EpisodeChat } from "./episode-chat";
import {
  updateProductionAction,
  promoteToProductionAction,
  regenerateAnglesAction,
  deleteProductionAction,
  updateStatusAction,
} from "../actions";

interface Angle {
  angle: string;
  story: string;
  momentToHunt: string;
  voiceoverHook: string;
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface Clip {
  title: string;
  description?: string;
  status?: string;
}

interface EpisodeDetailProps {
  production: ProductionRow | null;
  chatMessages: ProductionChatMessageRow[];
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type DetailTab = "overview" | "story" | "production" | "chat";

export function EpisodeDetail({
  production,
  chatMessages,
  open,
  onClose,
  onUpdated,
}: EpisodeDetailProps) {
  const [tab, setTab] = React.useState<DetailTab>("overview");
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const isIdea = production?.status === "idea";

  React.useEffect(() => {
    if (open) setTab(isIdea ? "overview" : "story");
  }, [open, isIdea]);

  if (!production) return null;

  const angles = (production.generated_angles_json ?? []) as Angle[];
  const keyMoments = (production.key_moments_json ?? []) as string[];
  const shotList = (production.shot_list_json ?? []) as string[];
  const checklist = (production.release_checklist_json ?? []) as ChecklistItem[];
  const clips = (production.clips_json ?? []) as Clip[];

  const TABS: { id: DetailTab; label: string; show: boolean }[] = [
    { id: "overview", label: "Overview", show: true },
    { id: "story", label: "Story", show: !isIdea },
    { id: "production", label: "Production", show: !isIdea },
    { id: "chat", label: "Brainstorm", show: true },
  ];

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      await regenerateAnglesAction(production!.id);
      onUpdated();
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handlePromote() {
    await promoteToProductionAction(production!.id);
    onUpdated();
  }

  async function handleDelete() {
    await deleteProductionAction(production!.id);
    onClose();
    onUpdated();
  }

  async function handleFieldSave(field: string, value: unknown) {
    await updateProductionAction({ id: production!.id, [field]: value });
    onUpdated();
  }

  async function handleStatusChange(status: string) {
    await updateStatusAction(production!.id, status as ProductionRow["status"]);
    onUpdated();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton
        className="!w-full !max-w-[580px] flex flex-col overflow-hidden !border-[color:rgba(253,245,230,0.06)] !p-0"
        style={{ background: "var(--color-surface-1)" }}
      >
        <SheetTitle className="sr-only">{production.title}</SheetTitle>
        <SheetDescription className="sr-only">Episode details</SheetDescription>

        {/* Header */}
        <div className="border-b border-[color:rgba(253,245,230,0.06)] px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <StatusBadge status={production.status} />
            {production.subject_type && (
              <span
                className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                {production.subject_type}
              </span>
            )}
          </div>
          <h2
            className="mt-2 font-[family-name:var(--font-display)] text-[24px] leading-tight text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            {production.title}
          </h2>
          {production.initial_thought && (
            <p className="mt-1.5 font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[color:var(--color-neutral-400)]">
              {production.initial_thought}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[color:rgba(253,245,230,0.06)] px-5">
          {TABS.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="relative cursor-pointer border-none bg-transparent px-3 py-2.5 font-[family-name:var(--font-label)] text-[10px] uppercase"
              style={{
                letterSpacing: "1.5px",
                color:
                  tab === t.id
                    ? "var(--color-brand-cream)"
                    : "var(--color-neutral-500)",
                transition: "color 180ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {t.label}
              {tab === t.id && (
                <motion.div
                  layoutId="episode-tab-indicator"
                  className="absolute inset-x-0 -bottom-px h-px"
                  style={{ background: "var(--color-brand-pink)" }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", mass: 1, stiffness: 220, damping: 25 }
                  }
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === "overview" && (
              <TabPanel key="overview" reduceMotion={reduceMotion}>
                <OverviewTab
                  production={production}
                  angles={angles}
                  isRegenerating={isRegenerating}
                  onRegenerate={handleRegenerate}
                  onPromote={handlePromote}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              </TabPanel>
            )}
            {tab === "story" && (
              <TabPanel key="story" reduceMotion={reduceMotion}>
                <StoryTab
                  production={production}
                  keyMoments={keyMoments}
                  shotList={shotList}
                  onSave={handleFieldSave}
                />
              </TabPanel>
            )}
            {tab === "production" && (
              <TabPanel key="production" reduceMotion={reduceMotion}>
                <ProductionTab
                  production={production}
                  checklist={checklist}
                  clips={clips}
                  onSave={handleFieldSave}
                />
              </TabPanel>
            )}
            {tab === "chat" && (
              <div key="chat" className="flex h-full min-h-[400px] flex-col">
                <EpisodeChat
                  productionId={production.id}
                  initialMessages={chatMessages}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabPanel({
  children,
  reduceMotion,
}: {
  children: React.ReactNode;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }
      }
      className="px-5 py-4"
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({
  production,
  angles,
  isRegenerating,
  onRegenerate,
  onPromote,
  onDelete,
  onStatusChange,
}: {
  production: ProductionRow;
  angles: Angle[];
  isRegenerating: boolean;
  onRegenerate: () => void;
  onPromote: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  const isIdea = production.status === "idea";

  return (
    <div className="flex flex-col gap-5">
      {/* Angles */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <SectionLabel icon={Lightbulb}>Episode Angles</SectionLabel>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex cursor-pointer items-center gap-1 border-none bg-transparent font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-pink)] disabled:cursor-default disabled:opacity-40"
            style={{
              letterSpacing: "1.2px",
              transition: "color 180ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {isRegenerating ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="size-3" strokeWidth={1.5} />
            )}
            Regenerate
          </button>
        </div>

        {angles.length === 0 ? (
          <div
            className="rounded-[8px] px-3 py-6 text-center"
            style={{ background: "rgba(253,245,230,0.02)" }}
          >
            <p className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-neutral-500)]">
              angles are being generated…
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {angles.map((a, i) => (
              <div
                key={i}
                className="rounded-[8px] border border-[color:rgba(253,245,230,0.04)] p-3"
                style={{ background: "rgba(253,245,230,0.02)" }}
              >
                <p className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                  {a.angle}
                </p>
                <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] leading-relaxed text-[color:var(--color-neutral-400)]">
                  {a.story}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-start gap-1.5">
                    <Camera
                      className="mt-0.5 size-3 shrink-0 text-[color:var(--color-brand-orange)]"
                      strokeWidth={1.5}
                    />
                    <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-400)]">
                      {a.momentToHunt}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Mic
                      className="mt-0.5 size-3 shrink-0 text-[color:var(--color-brand-pink)]"
                      strokeWidth={1.5}
                    />
                    <span className="font-[family-name:var(--font-narrative)] text-[11px] italic text-[color:var(--color-neutral-400)]">
                      &ldquo;{a.voiceoverHook}&rdquo;
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logistics (if in pipeline) */}
      {!isIdea && (
        <div className="flex flex-col gap-2">
          {production.shoot_date && (
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 text-[color:var(--color-neutral-500)]" strokeWidth={1.5} />
              <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
                {production.shoot_date}
              </span>
            </div>
          )}
          {production.location && (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 text-[color:var(--color-neutral-500)]" strokeWidth={1.5} />
              <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
                {production.location}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status controls */}
      {!isIdea && (
        <div>
          <SectionLabel icon={Film}>Status</SectionLabel>
          <div className="mt-2 flex gap-2">
            {(["scheduled", "shot", "in_edit", "published"] as const).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatusChange(s)}
                  className="cursor-pointer rounded-[6px] border-none px-3 py-1.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                  style={{
                    letterSpacing: "1.2px",
                    background:
                      production.status === s
                        ? "rgba(244, 160, 176, 0.15)"
                        : "rgba(253, 245, 230, 0.04)",
                    color:
                      production.status === s
                        ? "var(--color-brand-pink)"
                        : "var(--color-neutral-500)",
                    transition: "all 180ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  {s.replace("_", " ")}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-[color:rgba(253,245,230,0.06)] pt-4">
        {isIdea && (
          <button
            type="button"
            onClick={onPromote}
            className="flex cursor-pointer items-center gap-1.5 rounded-[8px] border-none px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)]"
            style={{
              letterSpacing: "1.5px",
              background: "var(--color-brand-red)",
              transition: "opacity 180ms",
            }}
          >
            <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            Promote to Production
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto flex cursor-pointer items-center gap-1.5 border-none bg-transparent font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-600)] hover:text-[color:var(--color-brand-red)]"
          style={{
            letterSpacing: "1.2px",
            transition: "color 180ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <Trash2 className="size-3" strokeWidth={1.5} />
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Story tab
// ---------------------------------------------------------------------------

function StoryTab({
  production,
  keyMoments,
  shotList,
  onSave,
}: {
  production: ProductionRow;
  keyMoments: string[];
  shotList: string[];
  onSave: (field: string, value: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <EditableField
        label="Narrative Angle"
        icon={Film}
        value={production.narrative_angle ?? ""}
        placeholder="What's the story? The one-line pitch…"
        onSave={(v) => onSave("narrativeAngle", v || null)}
      />
      <EditableField
        label="Voiceover Hook"
        icon={Mic}
        value={production.voiceover_hook ?? ""}
        placeholder="That one dry line…"
        onSave={(v) => onSave("voiceoverHook", v || null)}
        italic
      />
      <EditableListField
        label="Key Moments"
        icon={Camera}
        items={keyMoments}
        placeholder="A moment to hunt for…"
        onSave={(items) => onSave("keyMoments", items.length > 0 ? items : null)}
      />
      <EditableListField
        label="Shot List"
        icon={Camera}
        items={shotList}
        placeholder="A shot to get…"
        onSave={(items) => onSave("shotList", items.length > 0 ? items : null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Production tab
// ---------------------------------------------------------------------------

function ProductionTab({
  production,
  checklist,
  clips,
  onSave,
}: {
  production: ProductionRow;
  checklist: ChecklistItem[];
  clips: Clip[];
  onSave: (field: string, value: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <EditableField
        label="Shoot Date"
        icon={Calendar}
        value={production.shoot_date ?? ""}
        placeholder="YYYY-MM-DD"
        onSave={(v) => onSave("shootDate", v || null)}
      />
      <EditableField
        label="Location"
        icon={MapPin}
        value={production.location ?? ""}
        placeholder="Where's the shoot?"
        onSave={(v) => onSave("location", v || null)}
      />
      <EditableField
        label="Gear Notes"
        icon={Wrench}
        value={production.gear_notes ?? ""}
        placeholder="Camera, lenses, audio…"
        onSave={(v) => onSave("gearNotes", v || null)}
        multiline
      />

      {/* Release Checklist */}
      <div>
        <SectionLabel icon={CheckSquare}>Release Checklist</SectionLabel>
        <div className="mt-2 flex flex-col gap-1.5">
          {checklist.map((item, i) => (
            <label
              key={i}
              className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 hover:bg-[color:rgba(253,245,230,0.02)]"
              style={{ transition: "background 150ms" }}
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => {
                  const updated = checklist.map((c, j) =>
                    j === i ? { ...c, done: !c.done } : c,
                  );
                  onSave("releaseChecklist", updated);
                }}
                className="accent-[var(--color-brand-pink)]"
              />
              <span
                className={`font-[family-name:var(--font-body)] text-[13px] ${
                  item.done
                    ? "text-[color:var(--color-neutral-600)] line-through"
                    : "text-[color:var(--color-neutral-300)]"
                }`}
              >
                {item.label}
              </span>
            </label>
          ))}
          <AddItemButton
            placeholder="Add checklist item…"
            onAdd={(label) => {
              onSave("releaseChecklist", [
                ...checklist,
                { label, done: false },
              ]);
            }}
          />
        </div>
      </div>

      {/* Clips */}
      <div>
        <SectionLabel icon={Scissors}>Short-Form Clips</SectionLabel>
        <div className="mt-2 flex flex-col gap-1.5">
          {clips.map((clip, i) => (
            <div
              key={i}
              className="rounded-[6px] border border-[color:rgba(253,245,230,0.04)] px-3 py-2"
              style={{ background: "rgba(253,245,230,0.02)" }}
            >
              <p className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-neutral-300)]">
                {clip.title}
              </p>
              {clip.description && (
                <p className="mt-0.5 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                  {clip.description}
                </p>
              )}
            </div>
          ))}
          <AddItemButton
            placeholder="Add a clip idea…"
            onAdd={(title) => {
              onSave("clips", [...clips, { title }]);
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3.5 text-[color:var(--color-neutral-500)]" strokeWidth={1.5} />
      <span
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {children}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    idea: {
      bg: "rgba(244, 160, 176, 0.12)",
      text: "var(--color-brand-pink)",
    },
    scheduled: {
      bg: "rgba(253, 245, 230, 0.08)",
      text: "var(--color-brand-cream)",
    },
    shot: {
      bg: "rgba(242, 140, 82, 0.12)",
      text: "var(--color-brand-orange)",
    },
    in_edit: {
      bg: "rgba(242, 140, 82, 0.18)",
      text: "var(--color-brand-orange)",
    },
    published: {
      bg: "rgba(123, 174, 126, 0.12)",
      text: "var(--color-success)",
    },
  };
  const c = colors[status] ?? colors.idea;

  return (
    <span
      className="inline-flex rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{
        letterSpacing: "1.2px",
        background: c.bg,
        color: c.text,
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function EditableField({
  label,
  icon: Icon,
  value,
  placeholder,
  onSave,
  multiline,
  italic,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  italic?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => setDraft(value), [value]);

  function commit() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  const textClasses = `font-[family-name:var(--font-body)] text-[13px] leading-relaxed ${
    italic ? "italic font-[family-name:var(--font-narrative)]" : ""
  }`;

  return (
    <div>
      <SectionLabel icon={Icon}>{label}</SectionLabel>
      <div className="mt-1.5">
        {editing ? (
          multiline ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(value);
                  setEditing(false);
                }
              }}
              rows={3}
              placeholder={placeholder}
              className={`w-full resize-none rounded-[6px] border border-[color:rgba(253,245,230,0.08)] bg-[color:rgba(253,245,230,0.02)] px-3 py-2 text-[color:var(--color-neutral-300)] focus:border-[color:var(--color-brand-pink)] focus:outline-none ${textClasses}`}
              style={{ transition: "border-color 180ms" }}
            />
          ) : (
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(value);
                  setEditing(false);
                }
              }}
              placeholder={placeholder}
              className={`w-full rounded-[6px] border border-[color:rgba(253,245,230,0.08)] bg-[color:rgba(253,245,230,0.02)] px-3 py-2 text-[color:var(--color-neutral-300)] focus:border-[color:var(--color-brand-pink)] focus:outline-none ${textClasses}`}
              style={{ transition: "border-color 180ms" }}
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`w-full cursor-pointer rounded-[6px] border-none px-3 py-2 text-left hover:bg-[color:rgba(253,245,230,0.03)] ${textClasses} ${
              value
                ? "text-[color:var(--color-neutral-300)]"
                : "text-[color:var(--color-neutral-600)]"
            }`}
            style={{ transition: "background 150ms" }}
          >
            {value || placeholder}
          </button>
        )}
      </div>
    </div>
  );
}

function EditableListField({
  label,
  icon: Icon,
  items,
  placeholder,
  onSave,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  items: string[];
  placeholder: string;
  onSave: (items: string[]) => void;
}) {
  return (
    <div>
      <SectionLabel icon={Icon}>{label}</SectionLabel>
      <div className="mt-1.5 flex flex-col gap-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="group flex items-center gap-2 rounded-[6px] px-2.5 py-1.5"
            style={{ background: "rgba(253,245,230,0.02)" }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--color-brand-pink)] opacity-40" />
            <span className="flex-1 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
              {item}
            </span>
            <button
              type="button"
              onClick={() => onSave(items.filter((_, j) => j !== i))}
              className="cursor-pointer border-none bg-transparent text-[color:var(--color-neutral-600)] opacity-0 group-hover:opacity-100"
              style={{ transition: "opacity 150ms" }}
              aria-label={`Remove ${item}`}
            >
              <Trash2 className="size-3" strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <AddItemButton
          placeholder={placeholder}
          onAdd={(v) => onSave([...items, v])}
        />
      </div>
    </div>
  );
}

function AddItemButton({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="cursor-pointer border-none bg-transparent px-2.5 py-1 text-left font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-600)] hover:text-[color:var(--color-brand-pink)]"
        style={{ transition: "color 180ms" }}
      >
        + Add…
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim()) onAdd(draft.trim());
        setDraft("");
        setAdding(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && draft.trim()) {
          onAdd(draft.trim());
          setDraft("");
        }
        if (e.key === "Escape") {
          setDraft("");
          setAdding(false);
        }
      }}
      placeholder={placeholder}
      className="rounded-[6px] border border-[color:rgba(253,245,230,0.08)] bg-[color:rgba(253,245,230,0.02)] px-2.5 py-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)] placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-pink)] focus:outline-none"
      style={{ transition: "border-color 180ms" }}
    />
  );
}
