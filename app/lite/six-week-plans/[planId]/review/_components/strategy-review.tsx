"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  approveStrategy,
  regenStrategy,
  pausePlan,
} from "@/lib/six-week-plan/actions";
import type { StrategyOutput, FlaggedAssumption } from "@/lib/ai/prompts/six-week-plan/strategy";
import type { PlanForReview } from "@/lib/six-week-plan/queries";

interface StrategyReviewProps {
  planId: string;
  strategy: StrategyOutput;
  prospect: PlanForReview["prospect"];
  regenCount: number;
}

const springTransition = {
  type: houseSpring.type,
  mass: houseSpring.mass,
  stiffness: houseSpring.stiffness,
  damping: houseSpring.damping,
};

export function StrategyReview({
  planId,
  strategy,
  prospect,
  regenCount,
}: StrategyReviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRegenNote, setShowRegenNote] = useState(false);
  const [regenNote, setRegenNote] = useState("");
  const [corrections, setCorrections] = useState<string[]>([]);

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveStrategy(planId);
      if (result.ok) router.refresh();
    });
  };

  const handleRegen = () => {
    if (!regenNote.trim() && corrections.length === 0) return;
    const fullNote = [
      ...corrections.map((c) => `Correction: ${c}`),
      regenNote.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    startTransition(async () => {
      await regenStrategy(planId, fullNote);
      router.refresh();
    });
  };

  const handlePause = () => {
    startTransition(async () => {
      await pausePlan(planId);
      router.refresh();
    });
  };

  const addCorrection = (assumption: FlaggedAssumption) => {
    const prompt = window.prompt(
      `What's actually true about: "${assumption.statement}"`,
    );
    if (prompt) {
      setCorrections((prev) => [...prev, `"${assumption.statement}" → ${prompt}`]);
      setShowRegenNote(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Context summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="rounded-lg border bg-card p-4"
      >
        <p className="text-sm text-muted-foreground">
          {prospect.name} — {prospect.businessName}
        </p>
      </motion.div>

      {/* Current state diagnosis */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.05 }}
        className="space-y-2"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Current State
        </h2>
        <p className="text-sm leading-relaxed">
          {strategy.current_state_diagnosis}
        </p>
      </motion.section>

      {/* Primary goal */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.1 }}
        className="space-y-2"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Primary Goal
        </h2>
        <p className="text-base font-medium">{strategy.primary_goal}</p>
      </motion.section>

      {/* Chosen primitives */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.15 }}
        className="space-y-2"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Chosen Primitives
        </h2>
        <div className="flex flex-wrap gap-2">
          {strategy.chosen_primitives.map((p, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {i + 1}. {p.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      </motion.section>

      {/* Theme arc */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.2 }}
        className="space-y-2"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Theme Arc
        </h2>
        <ol className="space-y-1.5">
          {strategy.theme_arc.map((t) => (
            <li key={t.week_number} className="text-sm">
              <span className="font-medium text-muted-foreground">
                Week {t.week_number}:
              </span>{" "}
              {t.theme}
            </li>
          ))}
        </ol>
      </motion.section>

      {/* Flagged assumptions */}
      {strategy.flagged_assumptions.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: 0.25 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Flagged Assumptions
          </h2>
          <div className="space-y-2">
            {strategy.flagged_assumptions.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <ConfidenceBadge confidence={a.confidence} />
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{a.statement}</p>
                  <p className="text-xs text-muted-foreground">
                    Verify: {a.what_to_verify}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addCorrection(a)}
                  className="shrink-0 text-xs text-primary hover:underline"
                >
                  Correct this
                </button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Regen note area */}
      <AnimatePresence>
        {(showRegenNote || corrections.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springTransition}
            className="space-y-2 overflow-hidden"
          >
            {corrections.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Corrections queued:
                </p>
                {corrections.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    • {c}
                  </p>
                ))}
              </div>
            )}
            <Textarea
              value={regenNote}
              onChange={(e) => setRegenNote(e.target.value)}
              placeholder="What should the strategy do differently? e.g. &quot;They're not ready for ads — lean heavier on organic for the first 4 weeks.&quot;"
              rows={3}
              className="text-sm"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regen warning */}
      {regenCount >= 4 && (
        <p className="text-xs text-amber-600">
          This plan has had {regenCount} regens — want to pause and sketch it
          differently?
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={handleApprove} disabled={isPending}>
          {isPending ? "Generating weeks…" : "Approve & generate weeks"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (showRegenNote) handleRegen();
            else setShowRegenNote(true);
          }}
          disabled={isPending}
        >
          {showRegenNote ? "Send regen" : "Regen with note"}
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={handlePause}
          disabled={isPending}
        >
          Pause this plan
        </Button>
      </div>
    </div>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: "low" | "medium" | "high";
}) {
  if (confidence === "low") {
    return (
      <Badge variant="destructive" className="shrink-0 text-xs">
        Low confidence
      </Badge>
    );
  }
  if (confidence === "medium") {
    return (
      <Badge className="shrink-0 bg-amber-100 text-amber-800 text-xs hover:bg-amber-100">
        Medium
      </Badge>
    );
  }
  return (
    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500 mt-1.5" />
  );
}
