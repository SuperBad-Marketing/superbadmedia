"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, X, Wifi, BarChart3, Database, Image } from "lucide-react";

interface SyncEvent {
  phase: string;
  progress: number;
  label: string;
  detail?: string;
  followers?: number;
  postsSynced?: number;
  error?: string;
}

interface SyncProgressOverlayProps {
  open: boolean;
  onComplete: (result: { followers: number; postsSynced: number } | null) => void;
  onError: (message: string) => void;
}

const PHASES = [
  { key: "connect", label: "Connecting", icon: Wifi },
  { key: "metrics", label: "Account metrics", icon: BarChart3 },
  { key: "insights", label: "Reach & impressions", icon: BarChart3 },
  { key: "snapshot", label: "Saving snapshot", icon: Database },
  { key: "posts", label: "Syncing posts", icon: Image },
] as const;

const PHASE_ORDER: string[] = PHASES.map((p) => p.key);

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function SyncProgressOverlay({ open, onComplete, onError }: SyncProgressOverlayProps) {
  const shouldReduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("");
  const [currentLabel, setCurrentLabel] = useState("");
  const [currentDetail, setCurrentDetail] = useState("");
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number>(0);
  const targetProgressRef = useRef(0);

  const animateCounter = useCallback(() => {
    setDisplayProgress((prev) => {
      const target = targetProgressRef.current;
      if (Math.abs(prev - target) < 0.5) return target;
      return prev + (target - prev) * 0.12;
    });
    frameRef.current = requestAnimationFrame(animateCounter);
  }, []);

  useEffect(() => {
    if (!open) return;

    setProgress(0);
    setDisplayProgress(0);
    setCurrentPhase("");
    setCurrentLabel("");
    setCurrentDetail("");
    setCompletedPhases(new Set());
    setDone(false);
    setError(null);
    targetProgressRef.current = 0;

    frameRef.current = requestAnimationFrame(animateCounter);

    const abort = new AbortController();
    abortRef.current = abort;

    (async () => {
      try {
        const res = await fetch("/api/lite/instagram-sync", {
          method: "POST",
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          onError("Sync request failed.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event: SyncEvent = JSON.parse(line.slice(6));

              if (event.phase === "error") {
                setError(event.error ?? "Sync failed");
                onError(event.error ?? "Sync failed");
                return;
              }

              setProgress(event.progress);
              targetProgressRef.current = event.progress;
              setCurrentPhase(event.phase);
              setCurrentLabel(event.label);
              setCurrentDetail(event.detail ?? "");

              const phaseIdx = PHASE_ORDER.indexOf(event.phase);
              if (phaseIdx > 0) {
                setCompletedPhases((prev) => {
                  const next = new Set(prev);
                  for (let i = 0; i < phaseIdx; i++) {
                    next.add(PHASE_ORDER[i]);
                  }
                  return next;
                });
              }

              if (event.phase === "done") {
                setDone(true);
                setCompletedPhases(new Set(PHASE_ORDER));
                setTimeout(() => {
                  onComplete(
                    event.followers != null
                      ? { followers: event.followers, postsSynced: event.postsSynced ?? 0 }
                      : null,
                  );
                }, 1400);
              }
            } catch {
              // skip malformed event
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Connection lost during sync.");
          onError("Connection lost during sync.");
        }
      }
    })();

    return () => {
      abort.abort();
      cancelAnimationFrame(frameRef.current);
    };
  }, [open, onComplete, onError, animateCounter]);

  const strokeOffset = RING_CIRCUMFERENCE - (displayProgress / 100) * RING_CIRCUMFERENCE;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(10, 10, 8, 0.75)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-[380px] rounded-2xl border p-8"
            style={{
              backgroundColor: "var(--color-neutral-900)",
              borderColor: "rgba(253, 245, 230, 0.08)",
            }}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* Ring + percentage */}
            <div className="relative mx-auto mb-6 size-[140px]">
              <svg
                viewBox="0 0 120 120"
                className="size-full -rotate-90"
                aria-hidden="true"
              >
                {/* Track */}
                <circle
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgba(253, 245, 230, 0.06)"
                  strokeWidth="5"
                />
                {/* Indicator */}
                <motion.circle
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--color-brand-pink)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                  style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
                />
              </svg>

              {/* Percentage in centre */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="font-[family-name:var(--font-display)] text-[36px] leading-none tabular-nums text-[color:var(--color-brand-cream)]"
                >
                  {Math.round(displayProgress)}
                </span>
                <span
                  className="mt-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]"
                >
                  {done ? "Complete" : "Percent"}
                </span>
              </div>

              {/* Glow pulse on the ring when active */}
              {!done && !error && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(244, 160, 176, 0.08) 0%, transparent 70%)",
                  }}
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>

            {/* Current action label */}
            <div className="mb-6 text-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentLabel}
                  className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {done ? "All synced" : error ? "Sync failed" : currentLabel || "Preparing"}
                </motion.p>
              </AnimatePresence>
              {currentDetail && !done && !error && (
                <motion.p
                  className="mt-1 font-[family-name:var(--font-body)] text-[12px] tabular-nums text-[color:var(--color-neutral-500)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {currentDetail}
                </motion.p>
              )}
              {error && (
                <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-red)]">
                  {error}
                </p>
              )}
            </div>

            {/* Phase steps */}
            <div className="space-y-0">
              {PHASES.map((phase, i) => {
                const isActive = currentPhase === phase.key && !done && !error;
                const isComplete = done || completedPhases.has(phase.key) ||
                  (currentPhase === phase.key && progress > 0 && PHASE_ORDER.indexOf(currentPhase) > i);
                const Icon = phase.icon;

                return (
                  <div
                    key={phase.key}
                    className="flex items-center gap-3 py-[7px]"
                    style={{
                      borderTop: i > 0 ? "1px solid rgba(253, 245, 230, 0.04)" : undefined,
                    }}
                  >
                    <div className="flex size-5 shrink-0 items-center justify-center">
                      <AnimatePresence mode="wait">
                        {isComplete ? (
                          <motion.div
                            key="done"
                            initial={shouldReduceMotion ? false : { scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 260, damping: 24 }}
                            className="flex size-5 items-center justify-center rounded-full"
                            style={{ backgroundColor: "rgba(123, 174, 126, 0.15)" }}
                          >
                            <Check className="size-3 text-[#7BAE7E]" strokeWidth={2} />
                          </motion.div>
                        ) : isActive ? (
                          <motion.div
                            key="active"
                            initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative flex size-5 items-center justify-center"
                          >
                            <motion.div
                              className="absolute inset-0 rounded-full"
                              style={{ backgroundColor: "var(--color-brand-pink)" }}
                              animate={{ opacity: [0.15, 0.3, 0.15] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <Icon
                              className="relative size-3 text-[color:var(--color-brand-pink)]"
                              strokeWidth={1.5}
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="pending"
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: "var(--color-neutral-700)" }}
                          />
                        )}
                      </AnimatePresence>
                    </div>

                    <span
                      className="font-[family-name:var(--font-body)] text-[13px] transition-colors duration-300"
                      style={{
                        color: isActive
                          ? "var(--color-brand-cream)"
                          : isComplete
                            ? "var(--color-neutral-500)"
                            : "var(--color-neutral-600)",
                      }}
                    >
                      {phase.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Error dismiss */}
            {error && (
              <button
                onClick={() => onComplete(null)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)] transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--color-neutral-800)", border: "1px solid rgba(253, 245, 230, 0.08)" }}
              >
                <X className="size-3" strokeWidth={1.5} />
                Dismiss
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
