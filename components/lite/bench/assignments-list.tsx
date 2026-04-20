"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClockIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SendIcon,
  LinkIcon,
} from "lucide-react";
import { brand, neutral, semantic, houseSpring } from "@/lib/design-tokens";
import { submitDeliverableAction } from "@/app/bench/(authenticated)/actions";

interface Task {
  id: string;
  task_description: string;
  budget_cap_aud: number;
  due_at_ms: number;
  delivered_at_ms: number | null;
  delivery_url_or_asset: string | null;
  disposition: string;
  sent_at_ms: number;
}

interface AssignmentsListProps {
  activeTasks: Task[];
  completedTasks: Task[];
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
    year: "numeric",
  });
}

function TaskCard({
  task,
  index,
  showSubmit,
}: {
  task: Task;
  index: number;
  showSubmit: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const isOverdue = task.due_at_ms < Date.now();
  const isDelivered = task.disposition === "shipped";

  async function handleSubmit() {
    if (!url.trim()) {
      setError("Please enter a delivery URL");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await submitDeliverableAction(task.id, url);
    if (result.ok) {
      setShowUrlInput(false);
      setUrl("");
      router.refresh();
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...houseSpring, delay: index * 0.03 }}
      className="rounded-xl border p-4"
      style={{
        borderColor: isOverdue && showSubmit ? semantic.error : neutral[300],
      }}
    >
      <p
        className="text-sm font-medium"
        style={{ color: neutral[900] }}
      >
        {task.task_description}
      </p>

      <div
        className="mt-2 flex items-center gap-4 text-xs"
        style={{ color: neutral[500] }}
      >
        <span>${task.budget_cap_aud} cap</span>
        <span className="flex items-center gap-1">
          {isOverdue && showSubmit && (
            <AlertCircleIcon size={12} style={{ color: semantic.error }} />
          )}
          {isDelivered && (
            <CheckCircleIcon size={12} style={{ color: semantic.success }} />
          )}
          {showSubmit ? (
            <>Due {formatRelativeDate(task.due_at_ms)}</>
          ) : (
            <>Delivered {task.delivered_at_ms ? formatDate(task.delivered_at_ms) : ""}</>
          )}
        </span>
      </div>

      {showSubmit && !showUrlInput && (
        <button
          onClick={() => setShowUrlInput(true)}
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
          style={{
            backgroundColor: brand.orange,
            color: "#fff",
          }}
        >
          <SendIcon size={14} />
          Submit deliverable
        </button>
      )}

      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="mt-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <LinkIcon size={14} style={{ color: neutral[500] }} />
              <input
                type="url"
                placeholder="Delivery URL (Dropbox, Drive, etc.)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: neutral[300],
                  color: neutral[900],
                  backgroundColor: "var(--color-surface-0)",
                }}
              />
            </div>
            {error && (
              <p className="text-xs" style={{ color: semantic.error }}>
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                style={{ backgroundColor: brand.orange, color: "#fff" }}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
              <button
                onClick={() => {
                  setShowUrlInput(false);
                  setUrl("");
                  setError("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ color: neutral[500] }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AssignmentsList({
  activeTasks,
  completedTasks,
}: AssignmentsListProps) {
  return (
    <div className="space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
        className="text-xl font-semibold tracking-tight"
        style={{ color: neutral[900] }}
      >
        Assignments
      </motion.h1>

      <div>
        <h2
          className="mb-3 text-sm font-medium"
          style={{ color: neutral[500] }}
        >
          Active
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
            {activeTasks.map((task, i) => (
              <TaskCard key={task.id} task={task} index={i} showSubmit />
            ))}
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div>
          <h2
            className="mb-3 text-sm font-medium"
            style={{ color: neutral[500] }}
          >
            Completed
          </h2>
          <div className="space-y-3">
            {completedTasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                showSubmit={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
