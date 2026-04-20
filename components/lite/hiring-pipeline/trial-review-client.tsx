"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { houseSpring } from "@/lib/design-tokens";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import {
  markTrialTaskDeliveredAction,
  reviewTrialTaskAction,
} from "@/app/lite/admin/hiring/actions";

// ── Types ──────────────────────────────────────────────────────────────

interface TrialTaskData {
  id: string;
  candidateId: string;
  candidateName: string;
  taskDescription: string;
  budgetCapAud: number;
  ratePerUnitAud: number;
  rateUnit: string;
  sentAtMs: number;
  dueAtMs: number;
  deliveredAtMs: number | null;
  deliveryUrl: string | null;
  notes: string | null;
  rating: number | null;
  disposition: string;
}

interface TrialReviewClientProps {
  task: TrialTaskData;
}

// ── Component ─────────────────────────────────────────────────────────

export function TrialReviewClient({ task }: TrialReviewClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toast = useToastWithSound();

  const [deliveryUrl, setDeliveryUrl] = useState(task.deliveryUrl ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [rating, setRating] = useState(task.rating ?? 0);

  const isReviewed = task.disposition !== "pending";
  const isDelivered = !!task.deliveredAtMs;
  const isOverdue = !isDelivered && Date.now() > task.dueAtMs;

  function handleMarkDelivered() {
    if (!deliveryUrl.trim()) {
      toast.error("Enter a delivery URL.");
      return;
    }
    startTransition(async () => {
      const result = await markTrialTaskDeliveredAction(task.id, deliveryUrl.trim());
      if (result.ok) {
        toast.success("Delivery received.", { sound: "deliverable-complete" });
        router.refresh();
      } else {
        toast.error(result.error, { sound: "error" });
      }
    });
  }

  function handleReview(disposition: "shipped" | "archived" | "redelivered") {
    if (rating < 1 || rating > 5) {
      toast.error("Rate 1–5 before submitting.");
      return;
    }
    startTransition(async () => {
      const result = await reviewTrialTaskAction(
        task.id,
        notes.trim(),
        rating,
        disposition,
      );
      if (result.ok) {
        const labels = {
          shipped: "Shipped",
          archived: "Archived",
          redelivered: "Revision requested",
        };
        const sounds = {
          shipped: "deliverable-complete" as const,
          archived: "error" as const,
          redelivered: "kanban-drop" as const,
        };
        toast.success(labels[disposition], { sound: sounds[disposition] });
        router.refresh();
      } else {
        toast.error(result.error, { sound: "error" });
      }
    });
  }

  const sentDate = new Date(task.sentAtMs).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dueDate = new Date(task.dueAtMs).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={houseSpring}
      className="grid h-full gap-6 overflow-auto md:grid-cols-2"
    >
      {/* ── Left: Task brief ─────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-neutral-800)] bg-[color:var(--color-neutral-900)] p-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Task Brief
        </div>

        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[color:var(--color-brand-cream)]">
          {task.taskDescription}
        </p>

        <div className="mt-auto flex flex-wrap gap-3 text-[12px] text-[color:var(--color-neutral-400)]">
          <span>Budget: ${task.budgetCapAud} AUD</span>
          <span className="text-[color:var(--color-neutral-700)]">·</span>
          <span>Rate: ${task.ratePerUnitAud}/{task.rateUnit.replace("per_", "")}</span>
          <span className="text-[color:var(--color-neutral-700)]">·</span>
          <span>Sent: {sentDate}</span>
          <span className="text-[color:var(--color-neutral-700)]">·</span>
          <span>
            Due: {dueDate}
            {isOverdue && !isDelivered && (
              <Badge variant="destructive" className="ml-1.5 text-[10px]">
                Overdue
              </Badge>
            )}
          </span>
        </div>

        {task.disposition !== "pending" && (
          <div className="mt-2 flex items-center gap-2">
            <DispositionBadge disposition={task.disposition} />
            {task.rating && (
              <span className="text-[12px] text-[color:var(--color-neutral-400)]">
                Rating: {task.rating}/5
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Right: Delivery + Review ─────────────────────── */}
      <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-neutral-800)] bg-[color:var(--color-neutral-900)] p-5">
        {/* Delivery section */}
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          {isDelivered ? "Delivery" : "Mark Delivered"}
        </div>

        {isDelivered ? (
          <a
            href={task.deliveryUrl ?? deliveryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[14px] text-[color:var(--color-brand-gold)] underline decoration-[color:var(--color-brand-gold)]/30 underline-offset-2 transition-colors hover:text-[color:var(--color-brand-cream)]"
          >
            {task.deliveryUrl ?? deliveryUrl}
          </a>
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              value={deliveryUrl}
              onChange={(e) => setDeliveryUrl(e.target.value)}
              placeholder="Dropbox / Google Drive / WeTransfer link"
              disabled={isReviewed || pending}
              className="flex-1 rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-950)] px-3 py-2 text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-gold)] focus:outline-none disabled:opacity-50"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkDelivered}
              disabled={isReviewed || pending || !deliveryUrl.trim()}
            >
              Received
            </Button>
          </div>
        )}

        {/* Review section — only show when delivered and not yet reviewed */}
        <AnimatePresence>
          {isDelivered && !isReviewed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={houseSpring}
              className="flex flex-col gap-4 overflow-hidden"
            >
              <div className="h-px bg-[color:var(--color-neutral-800)]" />

              <div
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "2px" }}
              >
                Review
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1">
                <span className="mr-2 text-[12px] text-[color:var(--color-neutral-400)]">
                  Rating
                </span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    disabled={pending}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-[14px] font-medium transition-colors ${
                      n <= rating
                        ? "bg-[color:var(--color-brand-gold)] text-[color:var(--color-neutral-950)]"
                        : "bg-[color:var(--color-neutral-800)] text-[color:var(--color-neutral-500)] hover:bg-[color:var(--color-neutral-700)]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional, max 1000 chars)"
                maxLength={1000}
                rows={3}
                disabled={pending}
                className="resize-none border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-950)] text-[13px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-600)]"
              />

              {/* Disposition buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleReview("shipped")}
                  disabled={pending || rating < 1}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Ship it
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReview("redelivered")}
                  disabled={pending || rating < 1}
                >
                  Request revision
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReview("archived")}
                  disabled={pending || rating < 1}
                >
                  Archive
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Already reviewed */}
        {isReviewed && task.notes && (
          <div className="mt-2">
            <div
              className="mb-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "2px" }}
            >
              Review Notes
            </div>
            <p className="whitespace-pre-wrap text-[13px] text-[color:var(--color-neutral-300)]">
              {task.notes}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function DispositionBadge({ disposition }: { disposition: string }) {
  const styles: Record<string, string> = {
    shipped: "bg-emerald-900/50 text-emerald-400 border-emerald-800",
    archived: "bg-red-900/30 text-red-400 border-red-800",
    redelivered: "bg-amber-900/30 text-amber-400 border-amber-800",
    pending: "bg-neutral-800 text-neutral-400 border-neutral-700",
  };
  const labels: Record<string, string> = {
    shipped: "Shipped",
    archived: "Archived",
    redelivered: "Revision Requested",
    pending: "Pending",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[disposition] ?? styles.pending}`}
    >
      {labels[disposition] ?? disposition}
    </span>
  );
}
