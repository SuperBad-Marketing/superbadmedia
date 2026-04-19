"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { RefreshReviewData } from "@/lib/six-week-plan/refresh-review-queries";
import type { WeekPlan } from "@/lib/ai/prompts/six-week-plan/weeks";
import {
  approveRefreshReview,
  regenerateForRetainer,
  saveHandEditedStrategy,
} from "@/lib/six-week-plan/refresh-review-actions";

interface Props {
  activeStrategy: RefreshReviewData["activeStrategy"];
  client: RefreshReviewData["client"];
}

type Mode = "review" | "editing" | "regen" | "done";

export function RefreshReviewShell({ activeStrategy, client }: Props) {
  const shouldReduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>(
    activeStrategy.status === "live" ? "done" : "review",
  );
  const [approving, setApproving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenNote, setRegenNote] = useState("");
  const [editedWeeks, setEditedWeeks] = useState<WeekPlan[]>(
    activeStrategy.payload.weeks_json,
  );
  const [doneMessage, setDoneMessage] = useState(
    activeStrategy.status === "live" ? "Strategy is already live." : "",
  );

  const handleApprove = useCallback(async () => {
    setApproving(true);
    const result = await approveRefreshReview(activeStrategy.id);
    if (result.ok) {
      setDoneMessage("Strategy approved and set live.");
      setMode("done");
    }
    setApproving(false);
  }, [activeStrategy.id]);

  const handleRegenerate = useCallback(async () => {
    if (!regenNote.trim()) return;
    setRegenerating(true);
    const result = await regenerateForRetainer(activeStrategy.id, regenNote);
    if (result.ok) {
      setDoneMessage(
        "Plan is regenerating against retainer scope. Check back when the pipeline finishes.",
      );
      setMode("done");
    }
    setRegenerating(false);
  }, [activeStrategy.id, regenNote]);

  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    const result = await saveHandEditedStrategy(activeStrategy.id, editedWeeks);
    if (result.ok) {
      setDoneMessage("Strategy hand-edited and set live.");
      setMode("done");
    }
    setSaving(false);
  }, [activeStrategy.id, editedWeeks]);

  const updateWeekTheme = useCallback(
    (weekNumber: number, value: string) => {
      setEditedWeeks((prev) =>
        prev.map((w) =>
          w.week_number === weekNumber ? { ...w, theme: value } : w,
        ),
      );
    },
    [],
  );

  const updateWeekWhy = useCallback(
    (weekNumber: number, value: string) => {
      setEditedWeeks((prev) =>
        prev.map((w) =>
          w.week_number === weekNumber
            ? { ...w, why_this_week: value }
            : w,
        ),
      );
    },
    [],
  );

  if (mode === "done") {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-lg font-medium">{doneMessage}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <a
            href={`/lite/admin/companies/${client.companyId}`}
            className="underline hover:text-foreground"
          >
            Back to {client.companyName}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: plan overview */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Migrated plan
        </h2>
        {activeStrategy.payload.intro && (
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {activeStrategy.payload.intro}
          </p>
        )}
        {activeStrategy.payload.theme_arc && (
          <div className="mb-4 rounded-md bg-muted/40 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Theme arc:
            </span>{" "}
            <span className="text-sm">{activeStrategy.payload.theme_arc}</span>
          </div>
        )}

        {mode === "editing" ? (
          <div className="space-y-3">
            {editedWeeks.map((week) => (
              <motion.div
                key={week.week_number}
                initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { ...houseSpring, delay: 0.03 * week.week_number }
                }
                className="border-b pb-3 last:border-b-0"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-orange-400">
                    W{week.week_number}
                  </span>
                  <input
                    value={week.theme}
                    onChange={(e) =>
                      updateWeekTheme(week.week_number, e.target.value)
                    }
                    className="flex-1 rounded border bg-background px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <textarea
                  value={week.why_this_week}
                  onChange={(e) =>
                    updateWeekWhy(week.week_number, e.target.value)
                  }
                  rows={2}
                  className="mt-1 w-full resize-none rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </motion.div>
            ))}
          </div>
        ) : (
          activeStrategy.payload.weeks_json.map((week) => (
            <motion.div
              key={week.week_number}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { ...houseSpring, delay: 0.03 * week.week_number }
              }
              className="mb-3 border-b pb-3 last:border-b-0"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-orange-400">
                  W{week.week_number}
                </span>
                <span className="text-sm font-medium">{week.theme}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {week.why_this_week}
              </p>
            </motion.div>
          ))
        )}
      </div>

      {/* Right: actions */}
      <div className="flex flex-col gap-4">
        {activeStrategy.payload.chosen_primitives.length > 0 && (
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Chosen primitives
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {activeStrategy.payload.chosen_primitives.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === "review" && (
            <motion.div
              key="actions"
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
              className="flex flex-col gap-2"
            >
              <button
                onClick={handleApprove}
                disabled={approving}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {approving ? "Approving…" : "Approve as-is — set live"}
              </button>
              <button
                onClick={() => setMode("regen")}
                className="rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Regenerate against retainer scope
              </button>
              <button
                onClick={() => setMode("editing")}
                className="rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Hand-edit weeks
              </button>
            </motion.div>
          )}

          {mode === "regen" && (
            <motion.div
              key="regen"
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
              className="rounded-lg border bg-card p-5"
            >
              <h3 className="mb-2 text-sm font-semibold">
                Retainer context note
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Describe the retainer's deliverables, budget, or time horizon
                adjustments. The generator re-runs with this context injected.
              </p>
              <textarea
                value={regenNote}
                onChange={(e) => setRegenNote(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. Retainer includes monthly shoots, expanded budget for paid distribution…"
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => {
                    setMode("review");
                    setRegenNote("");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || !regenNote.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {regenerating ? "Regenerating…" : "Regenerate"}
                </button>
              </div>
            </motion.div>
          )}

          {mode === "editing" && (
            <motion.div
              key="edit-actions"
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
              className="flex flex-col gap-2"
            >
              <p className="text-xs text-muted-foreground">
                Edit week themes and rationale directly in the left panel, then
                save.
              </p>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save & set live"}
              </button>
              <button
                onClick={() => {
                  setMode("review");
                  setEditedWeeks(activeStrategy.payload.weeks_json);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel editing
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
