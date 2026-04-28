"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BookmarkIcon,
  BookmarkPlusIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { houseSpring } from "@/lib/design-tokens";
import type { PromptCategory } from "@/lib/db/schema/prompt-library";

export interface SavedPrompt {
  id: string;
  name: string;
  promptText: string;
  category: PromptCategory;
  tags: string[];
  useCount: number;
}

interface PromptLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
  onSave: (data: {
    name: string;
    promptText: string;
    category: PromptCategory;
    tags: string[];
  }) => Promise<void>;
  currentBrief?: string;
  prompts: SavedPrompt[];
  loading: boolean;
}

const CATEGORY_LABELS: Record<PromptCategory, string> = {
  cinematic: "Cinematic",
  composite: "Composite",
  animated: "Animated",
  static: "Static",
  general: "General",
};

export function PromptLibraryDrawer({
  open,
  onClose,
  onSelect,
  onSave,
  currentBrief,
  prompts,
  loading,
}: PromptLibraryDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<PromptCategory | "all">("all");
  const [saving, setSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState<PromptCategory>("general");

  const filtered = prompts.filter((p) => {
    if (filterCat !== "all" && p.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.promptText.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleSave = useCallback(async () => {
    if (!currentBrief || !saveName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: saveName.trim(),
        promptText: currentBrief,
        category: saveCategory,
        tags: [],
      });
      toast.success("Prompt saved to library.");
      setShowSaveForm(false);
      setSaveName("");
    } catch {
      toast.error("Failed to save prompt.");
    } finally {
      setSaving(false);
    }
  }, [currentBrief, saveName, saveCategory, onSave]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 320 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-sm flex-col"
            style={{
              backgroundColor: "var(--color-neutral-900)",
              borderLeft: "1px solid rgba(253, 245, 230, 0.06)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <BookmarkIcon
                  className="size-4"
                  style={{ color: "var(--color-brand-pink)" }}
                />
                <span
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase"
                  style={{
                    letterSpacing: "1.5px",
                    color: "var(--color-brand-cream)",
                  }}
                >
                  Prompt Library
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 transition-colors"
                style={{ color: "var(--color-neutral-500)" }}
                aria-label="Close prompt library"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Search + filter */}
            <div className="space-y-2 px-5 pb-3">
              <div className="relative">
                <SearchIcon
                  className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2"
                  style={{ color: "var(--color-neutral-500)" }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts..."
                  className="w-full rounded-lg py-2 pl-9 pr-3 font-[family-name:var(--font-body)] text-[13px] outline-none"
                  style={{
                    backgroundColor: "rgba(253, 245, 230, 0.04)",
                    color: "var(--color-brand-cream)",
                    border: "1px solid rgba(253, 245, 230, 0.08)",
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {(["all", ...Object.keys(CATEGORY_LABELS)] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCat(cat as PromptCategory | "all")}
                      className="rounded-md px-2 py-1 font-[family-name:var(--font-body)] text-[10px] uppercase transition-colors"
                      style={{
                        letterSpacing: "1px",
                        backgroundColor:
                          filterCat === cat
                            ? "rgba(178, 40, 72, 0.15)"
                            : "rgba(253, 245, 230, 0.04)",
                        color:
                          filterCat === cat
                            ? "var(--color-brand-pink)"
                            : "var(--color-neutral-500)",
                      }}
                    >
                      {cat === "all"
                        ? "All"
                        : CATEGORY_LABELS[cat as PromptCategory]}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Prompt list */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {loading ? (
                <div
                  className="py-8 text-center font-[family-name:var(--font-body)] text-[13px]"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div
                  className="py-8 text-center font-[family-name:var(--font-body)] text-[13px]"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {prompts.length === 0
                    ? "No saved prompts yet. Create something, then save it here."
                    : "No prompts match your search."}
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((p, i) => (
                    <motion.button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelect(p.promptText);
                        onClose();
                      }}
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 6 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { ...houseSpring, delay: i * 0.03 }
                      }
                      className="w-full rounded-lg p-3 text-left transition-colors"
                      style={{
                        backgroundColor: "var(--color-neutral-800)",
                        border: "1px solid rgba(253, 245, 230, 0.06)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                          style={{ color: "var(--color-brand-cream)" }}
                        >
                          {p.name}
                        </div>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 font-[family-name:var(--font-body)] text-[9px] uppercase"
                          style={{
                            letterSpacing: "0.5px",
                            backgroundColor: "rgba(253, 245, 230, 0.04)",
                            color: "var(--color-neutral-500)",
                          }}
                        >
                          {CATEGORY_LABELS[p.category]}
                        </span>
                      </div>
                      <div
                        className="mt-1 line-clamp-2 font-[family-name:var(--font-body)] text-[12px]"
                        style={{ color: "var(--color-neutral-400)" }}
                      >
                        {p.promptText}
                      </div>
                      {p.useCount > 0 && (
                        <div
                          className="mt-1.5 font-[family-name:var(--font-body)] text-[10px] tabular-nums"
                          style={{ color: "var(--color-neutral-500)" }}
                        >
                          Used {p.useCount} time{p.useCount !== 1 ? "s" : ""}
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Save current brief */}
            <div
              className="border-t px-5 py-4"
              style={{ borderColor: "rgba(253, 245, 230, 0.06)" }}
            >
              <AnimatePresence mode="wait">
                {showSaveForm ? (
                  <motion.div
                    key="form"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : houseSpring
                    }
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Name this prompt..."
                      className="w-full rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[13px] outline-none"
                      style={{
                        backgroundColor: "rgba(253, 245, 230, 0.04)",
                        color: "var(--color-brand-cream)",
                        border: "1px solid rgba(253, 245, 230, 0.08)",
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <select
                        value={saveCategory}
                        onChange={(e) =>
                          setSaveCategory(e.target.value as PromptCategory)
                        }
                        className="flex-1 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] outline-none"
                        style={{
                          backgroundColor: "rgba(253, 245, 230, 0.04)",
                          color: "var(--color-brand-cream)",
                          border: "1px solid rgba(253, 245, 230, 0.08)",
                        }}
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !saveName.trim()}
                        className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[12px] font-medium transition-opacity disabled:opacity-40"
                        style={{
                          backgroundColor: "var(--color-brand-red)",
                          color: "var(--color-brand-cream)",
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSaveForm(false)}
                        className="rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] transition-colors"
                        style={{
                          backgroundColor: "rgba(253, 245, 230, 0.04)",
                          color: "var(--color-neutral-500)",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="trigger"
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    type="button"
                    onClick={() => setShowSaveForm(true)}
                    disabled={!currentBrief}
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity disabled:opacity-30"
                    style={{
                      backgroundColor: "rgba(253, 245, 230, 0.06)",
                      color: "var(--color-brand-cream)",
                      border: "1px solid rgba(253, 245, 230, 0.08)",
                    }}
                  >
                    <BookmarkPlusIcon className="size-3.5" />
                    Save current brief to library
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
