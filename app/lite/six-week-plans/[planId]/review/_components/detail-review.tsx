"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  approveDetail,
  regenWeeks,
  rejectToStrategy,
} from "@/lib/six-week-plan/actions";
import type { WeeksOutput, WeekPlan } from "@/lib/ai/prompts/six-week-plan/weeks";
import type { PlanForReview } from "@/lib/six-week-plan/queries";

interface DetailReviewProps {
  planId: string;
  weeks: WeeksOutput;
  prospect: PlanForReview["prospect"];
  selfReviewPassed: boolean | null;
  selfReviewIssues: string[] | null;
  regenCount: number;
  isApproved: boolean;
}

const springTransition = {
  type: houseSpring.type,
  mass: houseSpring.mass,
  stiffness: houseSpring.stiffness,
  damping: houseSpring.damping,
};

const CATEGORY_COLOURS: Record<string, string> = {
  infrastructure: "bg-blue-100 text-blue-800",
  content: "bg-purple-100 text-purple-800",
  distribution: "bg-green-100 text-green-800",
  conversion: "bg-amber-100 text-amber-800",
  measurement: "bg-gray-100 text-gray-800",
};

const EFFORT_LABELS: Record<string, string> = {
  quick: "Quick",
  half_day: "Half day",
  full_day: "Full day",
  multi_day: "Multi-day",
};

export function DetailReview({
  planId,
  weeks,
  prospect,
  selfReviewPassed,
  selfReviewIssues,
  regenCount,
  isApproved,
}: DetailReviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  const [regenNote, setRegenNote] = useState("");
  const [showRegenNote, setShowRegenNote] = useState(false);

  const toggleWeek = (weekNum: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      return next;
    });
  };

  const toggleSelect = (weekNum: number) => {
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      return next;
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveDetail(planId);
      if (result.ok) router.refresh();
    });
  };

  const handleRegenSelected = () => {
    if (!regenNote.trim() && selectedWeeks.size === 0) return;
    startTransition(async () => {
      await regenWeeks(
        planId,
        regenNote.trim(),
        selectedWeeks.size > 0 ? [...selectedWeeks] : undefined,
      );
      router.refresh();
    });
  };

  const handleRegenContentAngles = () => {
    startTransition(async () => {
      await regenWeeks(planId, "Regen content angles only across all weeks.");
      router.refresh();
    });
  };

  const handleRejectToStrategy = () => {
    startTransition(async () => {
      await rejectToStrategy(planId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Self-review warning banner */}
      {selfReviewPassed === false && selfReviewIssues && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <p className="text-sm font-medium text-red-800">
            Automated review flagged issues with this plan. See below.
          </p>
          <ul className="mt-2 space-y-1">
            {selfReviewIssues.map((issue, i) => (
              <li key={i} className="text-xs text-red-700">
                • {issue}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Approved banner */}
      {isApproved && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            This plan has been approved.
          </p>
        </div>
      )}

      {/* Plan intro */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="space-y-2"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Plan Intro
        </h2>
        <p className="text-sm leading-relaxed italic">
          {weeks.plan_intro}
        </p>
      </motion.section>

      {/* Week cards */}
      <div className="space-y-3">
        {weeks.weeks.map((week, i) => (
          <WeekCard
            key={week.week_number}
            week={week}
            index={i}
            expanded={expandedWeeks.has(week.week_number)}
            selected={selectedWeeks.has(week.week_number)}
            onToggle={() => toggleWeek(week.week_number)}
            onSelect={() => toggleSelect(week.week_number)}
            showSelect={!isApproved}
          />
        ))}
      </div>

      {/* Regen note */}
      <AnimatePresence>
        {showRegenNote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springTransition}
            className="overflow-hidden"
          >
            <Textarea
              value={regenNote}
              onChange={(e) => setRegenNote(e.target.value)}
              placeholder="What should change in the selected weeks?"
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
      {!isApproved && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button onClick={handleApprove} disabled={isPending}>
            {isPending ? "Processing…" : "Approve plan"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (showRegenNote) handleRegenSelected();
              else setShowRegenNote(true);
            }}
            disabled={isPending}
          >
            {selectedWeeks.size > 0
              ? `Regen ${selectedWeeks.size} week${selectedWeeks.size > 1 ? "s" : ""}`
              : showRegenNote
                ? "Send regen"
                : "Regen selected weeks"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleRegenContentAngles}
            disabled={isPending}
          >
            Regen content angles only
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={handleRejectToStrategy}
            disabled={isPending}
          >
            Back to strategy
          </Button>
        </div>
      )}
    </div>
  );
}

function WeekCard({
  week,
  index,
  expanded,
  selected,
  onToggle,
  onSelect,
  showSelect,
}: {
  week: WeekPlan;
  index: number;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  showSelect: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: index * 0.04 }}
      className="rounded-lg border bg-card overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
      >
        {showSelect && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <Checkbox checked={selected} />
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
          Week {week.week_number}
        </span>
        <span className="flex-1 text-sm font-medium">{week.theme}</span>
        <span className="text-xs text-muted-foreground">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springTransition}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4 pt-1 border-t">
              {/* Why this week */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Why this week
                </p>
                <p className="text-sm">{week.why_this_week}</p>
              </div>

              {/* Content angles */}
              {week.content_angles.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Content angles
                  </p>
                  <div className="space-y-2">
                    {week.content_angles.map((angle, i) => (
                      <div key={i} className="text-sm space-y-0.5">
                        <p>{angle.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Asset: {angle.shoot_asset_ref}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Direction: {angle.caption_direction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Channel mix */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Channels
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {week.channel_mix.map((ch, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {ch}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tasks */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Tasks ({week.tasks.length})
                </p>
                <div className="space-y-2">
                  {week.tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge
                        className={`shrink-0 text-xs ${CATEGORY_COLOURS[task.category] ?? ""}`}
                      >
                        {task.category}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.detail}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {EFFORT_LABELS[task.effort_estimate] ?? task.effort_estimate}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success signal + fallback */}
              <div className="rounded-md bg-accent/50 p-3 space-y-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Success signal
                  </p>
                  <p className="text-sm">{week.success_signal}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Fallback
                  </p>
                  <p className="text-sm">{week.fallback}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
