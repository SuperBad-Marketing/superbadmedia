"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical, Pencil, ExternalLink } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import type { BrandVoiceExampleRow } from "@/lib/db/schema/brand-voice-examples";

import {
  createExampleAction,
  updateExampleAction,
  deleteExampleAction,
  reorderExamplesAction,
} from "./actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

type SurfaceConfig = {
  key: string;
  label: string;
  description: string;
};

const SURFACES: SurfaceConfig[] = [
  {
    key: "outreach",
    label: "Outreach",
    description:
      "Cold and warm outreach emails. These examples anchor the voice when the AI generates prospect emails.",
  },
];

type Draft = {
  id: string | null;
  title: string;
  body_markdown: string;
};

const BLANK: Draft = { id: null, title: "", body_markdown: "" };

export function BrandVoiceAdmin({
  initialExamples,
  brandDnaStatus,
}: {
  initialExamples: BrandVoiceExampleRow[];
  brandDnaStatus: "complete" | "in_progress" | "not_started";
}) {
  const [examples, setExamples] =
    React.useState<BrandVoiceExampleRow[]>(initialExamples);
  const [expandedSurface, setExpandedSurface] = React.useState<string | null>(
    "outreach",
  );
  const [draft, setDraft] = React.useState<{
    surface: string;
    data: Draft;
  } | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  React.useEffect(() => setExamples(initialExamples), [initialExamples]);

  function examplesForSurface(surface: string) {
    return examples
      .filter((e) => e.surface === surface)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function toggleSurface(surface: string) {
    setExpandedSurface((prev) => (prev === surface ? null : surface));
  }

  function openNew(surface: string) {
    setDraft({ surface, data: { ...BLANK } });
  }

  function openEdit(surface: string, example: BrandVoiceExampleRow) {
    setDraft({
      surface,
      data: {
        id: example.id,
        title: example.title,
        body_markdown: example.body_markdown,
      },
    });
  }

  function closeDraft() {
    setDraft(null);
  }

  function onSave() {
    if (!draft) return;
    const { surface, data } = draft;
    startTransition(async () => {
      const res = data.id
        ? await updateExampleAction(data.id, {
            title: data.title,
            body_markdown: data.body_markdown,
          })
        : await createExampleAction({
            surface,
            title: data.title,
            body_markdown: data.body_markdown,
          });
      if (res.ok) {
        toast.success(data.id ? "Example updated." : "Example added.");
        closeDraft();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete(example: BrandVoiceExampleRow) {
    if (!confirm(`Delete "${example.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteExampleAction(example.id);
      if (res.ok) toast.success("Deleted.");
      else toast.error(res.error);
    });
  }

  function onMoveUp(surface: string, example: BrandVoiceExampleRow) {
    const surfaceExamples = examplesForSurface(surface);
    const idx = surfaceExamples.findIndex((e) => e.id === example.id);
    if (idx <= 0) return;
    const reordered = [...surfaceExamples];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    const orderedIds = reordered.map((e) => e.id);
    startTransition(async () => {
      const res = await reorderExamplesAction(surface, orderedIds);
      if (!res.ok) toast.error(res.error);
    });
  }

  function onMoveDown(surface: string, example: BrandVoiceExampleRow) {
    const surfaceExamples = examplesForSurface(surface);
    const idx = surfaceExamples.findIndex((e) => e.id === example.id);
    if (idx < 0 || idx >= surfaceExamples.length - 1) return;
    const reordered = [...surfaceExamples];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    const orderedIds = reordered.map((e) => e.id);
    startTransition(async () => {
      const res = await reorderExamplesAction(surface, orderedIds);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* Brand DNA Card */}
      <div
        className="rounded-[12px] px-5 py-5"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "2px" }}
            >
              Brand DNA
            </div>
            <h3
              className="mt-2 font-[family-name:var(--font-display)] text-[20px] leading-[1.15] text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "-0.2px" }}
            >
              {brandDnaStatus === "complete"
                ? "SuperBad's identity is mapped."
                : brandDnaStatus === "in_progress"
                  ? "Assessment in progress."
                  : "Brand DNA not started yet."}
            </h3>
            <p className="mt-2 max-w-[480px] font-[family-name:var(--font-body)] text-[13px] leading-[1.55] text-[color:var(--color-neutral-400)]">
              {brandDnaStatus === "complete"
                ? "The full profile drives every AI-generated surface — outreach, quotes, portal chat, content. Retake anytime to evolve it."
                : "The Brand DNA assessment maps SuperBad's voice, personality, and aesthetic. Every AI surface reads from it."}
            </p>
          </div>
          <Link
            href="/lite/brand-dna?subject=superbad_self"
            className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-4 py-2.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px"
            style={{
              letterSpacing: "1.8px",
              color: "var(--color-brand-cream)",
              background:
                brandDnaStatus === "complete"
                  ? "transparent"
                  : "var(--color-brand-red)",
              border:
                brandDnaStatus === "complete"
                  ? "1px solid rgba(253, 245, 230, 0.1)"
                  : "1px solid var(--color-brand-red)",
              boxShadow:
                brandDnaStatus === "complete"
                  ? "none"
                  : "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
            }}
          >
            {brandDnaStatus === "complete" ? "Retake" : "Take assessment"}
            <ExternalLink className="size-3 opacity-50" />
          </Link>
        </div>
        {brandDnaStatus === "complete" && (
          <div
            className="mt-3 rounded-[8px] px-3 py-2 font-[family-name:var(--font-narrative)] text-[12px] italic leading-[1.55] text-[color:var(--color-brand-pink)]"
            style={{
              background: "rgba(253, 245, 230, 0.02)",
              border: "1px solid rgba(253, 245, 230, 0.04)",
            }}
          >
            identity locked in. everything downstream reads from here.
          </div>
        )}
      </div>

      {/* Surface sections */}
      {SURFACES.map((surface) => {
        const surfaceExamples = examplesForSurface(surface.key);
        const isExpanded = expandedSurface === surface.key;

        return (
          <div
            key={surface.key}
            className="overflow-hidden rounded-[12px]"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
              border: "1px solid rgba(253, 245, 230, 0.06)",
            }}
          >
            {/* Section header */}
            <button
              onClick={() => toggleSurface(surface.key)}
              className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-[family-name:var(--font-label)] text-[12px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]"
                >
                  {surface.label}
                </span>
                {surfaceExamples.length > 0 && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[10px] tabular-nums"
                    style={{
                      letterSpacing: "1px",
                      background: "rgba(253, 245, 230, 0.06)",
                      color: "var(--color-neutral-400)",
                    }}
                  >
                    {surfaceExamples.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className="size-4 text-[color:var(--color-neutral-500)] transition-transform duration-200"
                style={{
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {/* Expanded content */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transition}
                  className="overflow-hidden"
                >
                  <div
                    className="px-5 pb-5"
                    style={{
                      borderTop: "1px solid rgba(253, 245, 230, 0.04)",
                    }}
                  >
                    <p className="mt-3 font-[family-name:var(--font-body)] text-[13px] leading-[1.55] text-[color:var(--color-neutral-400)]">
                      {surface.description}
                    </p>

                    {surfaceExamples.length === 0 ? (
                      <div
                        className="mt-4 flex flex-col items-start gap-2 rounded-[10px] px-5 py-5"
                        style={{
                          border: "1px dashed rgba(253, 245, 230, 0.07)",
                          background: "rgba(15, 15, 14, 0.3)",
                        }}
                      >
                        <div
                          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
                          style={{ letterSpacing: "2px" }}
                        >
                          No examples yet
                        </div>
                        <p className="max-w-[400px] font-[family-name:var(--font-body)] text-[13px] leading-[1.55] text-[color:var(--color-neutral-400)]">
                          Add 5–10 reference emails in the SuperBad voice. The
                          AI uses these as its north star when generating{" "}
                          {surface.label.toLowerCase()} copy.
                        </p>
                        <div className="mt-0.5 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
                          teach it how you actually sound.
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-1.5">
                        <AnimatePresence initial={false}>
                          {surfaceExamples.map((example, idx) => (
                            <motion.div
                              key={example.id}
                              layout="position"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={transition}
                              className="group flex items-start gap-2 rounded-[8px] px-3 py-2.5 transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                            >
                              <GripVertical className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-neutral-600)]" />
                              <div className="min-w-0 flex-1">
                                <div className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                                  {example.title}
                                </div>
                                <div className="mt-0.5 line-clamp-2 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-500)]">
                                  {example.body_markdown.slice(0, 150)}
                                  {example.body_markdown.length > 150
                                    ? "…"
                                    : ""}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                <button
                                  onClick={() => onMoveUp(surface.key, example)}
                                  disabled={idx === 0 || isPending}
                                  className="rounded-[5px] p-1 text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)] disabled:opacity-30"
                                  title="Move up"
                                >
                                  <ChevronUp className="size-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    onMoveDown(surface.key, example)
                                  }
                                  disabled={
                                    idx === surfaceExamples.length - 1 ||
                                    isPending
                                  }
                                  className="rounded-[5px] p-1 text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)] disabled:opacity-30"
                                  title="Move down"
                                >
                                  <ChevronDown className="size-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    openEdit(surface.key, example)
                                  }
                                  className="rounded-[5px] p-1 text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                                  title="Edit"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => onDelete(example)}
                                  disabled={isPending}
                                  className="rounded-[5px] p-1 text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}

                    <button
                      onClick={() => openNew(surface.key)}
                      className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-[8px] border-none px-3 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-pink)] transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.03)]"
                      style={{
                        letterSpacing: "1.5px",
                        background: "transparent",
                      }}
                    >
                      <Plus className="size-3.5" />
                      Add example
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Edit / New dialog */}
      <Dialog
        open={draft != null}
        onOpenChange={(open) => !open && closeDraft()}
      >
        <DialogContent
          className="sm:max-w-lg"
          style={{
            background: "var(--color-surface-2)",
            borderRadius: "12px",
            border: "1px solid rgba(253, 245, 230, 0.06)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-[family-name:var(--font-display)] text-[22px] leading-none text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "-0.2px" }}
            >
              {draft?.data.id ? "Edit voice example" : "New voice example"}
            </DialogTitle>
            <DialogDescription className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              Write the email as you would actually send it. The AI uses this as
              a reference for tone, structure, and length.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <label className="block space-y-1">
                <span
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Title
                </span>
                <Input
                  value={draft.data.title}
                  placeholder='e.g. "First touch — café owner"'
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      data: { ...draft.data, title: e.target.value },
                    })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Email body
                </span>
                <Textarea
                  rows={12}
                  value={draft.data.body_markdown}
                  placeholder="Write the full email as you'd send it. Markdown supported."
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      data: { ...draft.data, body_markdown: e.target.value },
                    })
                  }
                  className="font-[family-name:var(--font-body)] text-[13px] leading-[1.6]"
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={closeDraft}
              disabled={isPending}
              className="rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
              style={{
                letterSpacing: "1.5px",
                background: "transparent",
                border: "1px solid rgba(253, 245, 230, 0.1)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isPending}
              className="rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:opacity-50"
              style={{
                letterSpacing: "1.8px",
                background: "var(--color-brand-red)",
                boxShadow:
                  "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
              }}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
