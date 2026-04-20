"use client";

import { motion } from "framer-motion";
import { ClockIcon, AlertCircleIcon } from "lucide-react";
import { brand, neutral, semantic, houseSpring } from "@/lib/design-tokens";
import type { CandidateBenchStatus } from "@/lib/db/schema/candidates";

interface ActiveTask {
  id: string;
  task_description: string;
  budget_cap_aud: number;
  due_at_ms: number;
  disposition: string;
}

interface BenchDashboardProps {
  candidateName: string;
  benchStatus: CandidateBenchStatus | null;
  pausedUntilMs: number | null;
  activeTasks: ActiveTask[];
}

function formatRelativeDate(ms: number): string {
  const now = Date.now();
  const diff = ms - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

export function BenchDashboard({
  candidateName,
  benchStatus,
  pausedUntilMs,
  activeTasks,
}: BenchDashboardProps) {
  const firstName = candidateName.split(" ")[0];
  const isPaused = benchStatus === "paused";
  const nextDeadline = activeTasks.length > 0
    ? Math.min(...activeTasks.map((t) => t.due_at_ms))
    : null;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
      >
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: neutral[900] }}
        >
          Hey, {firstName}.
        </h1>
        {isPaused && pausedUntilMs ? (
          <p className="mt-1 text-sm" style={{ color: neutral[500] }}>
            You&apos;re paused until {formatDate(pausedUntilMs)}.
          </p>
        ) : isPaused ? (
          <p className="mt-1 text-sm" style={{ color: neutral[500] }}>
            You&apos;re paused. Unpause when you&apos;re ready.
          </p>
        ) : null}
      </motion.div>

      {nextDeadline && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...houseSpring, delay: 0.05 }}
          className="flex items-center gap-3 rounded-xl border p-4"
          style={{ borderColor: neutral[300] }}
        >
          <ClockIcon size={18} style={{ color: brand.orange }} />
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: neutral[900] }}
            >
              Next deadline {formatRelativeDate(nextDeadline)}
            </p>
            <p className="text-xs" style={{ color: neutral[500] }}>
              {formatDate(nextDeadline)}
            </p>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, delay: 0.1 }}
      >
        <h2
          className="mb-3 text-sm font-medium"
          style={{ color: neutral[500] }}
        >
          Active assignments
        </h2>
        {activeTasks.length === 0 ? (
          <div
            className="rounded-xl border p-6 text-center"
            style={{ borderColor: neutral[300] }}
          >
            <p className="text-sm" style={{ color: neutral[500] }}>
              No active assignments right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task, i) => {
              const isOverdue = task.due_at_ms < Date.now();
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...houseSpring, delay: 0.1 + i * 0.03 }}
                  className="rounded-xl border p-4"
                  style={{ borderColor: isOverdue ? semantic.error : neutral[300] }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{ color: neutral[900] }}
                  >
                    {task.task_description}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: neutral[500] }}>
                    <span>${task.budget_cap_aud} cap</span>
                    <span className="flex items-center gap-1">
                      {isOverdue && (
                        <AlertCircleIcon size={12} style={{ color: semantic.error }} />
                      )}
                      Due {formatRelativeDate(task.due_at_ms)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
