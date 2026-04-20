"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PauseCircleIcon, PlayCircleIcon } from "lucide-react";
import { brand, neutral, semantic, houseSpring } from "@/lib/design-tokens";
import type { CandidateBenchStatus } from "@/lib/db/schema/candidates";
import {
  togglePauseAction,
  updateCapacityAction,
} from "@/app/bench/(authenticated)/actions";

interface AvailabilitySurfaceProps {
  benchStatus: CandidateBenchStatus | null;
  pausedUntilMs: number | null;
  weeklyCapacityHours: number;
}

function formatDateInput(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

export function AvailabilitySurface({
  benchStatus,
  pausedUntilMs,
  weeklyCapacityHours,
}: AvailabilitySurfaceProps) {
  const router = useRouter();
  const isPaused = benchStatus === "paused";
  const [pausing, setPausing] = useState(false);
  const [pauseDate, setPauseDate] = useState(formatDateInput(pausedUntilMs));
  const [capacity, setCapacity] = useState(weeklyCapacityHours);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [capacitySaved, setCapacitySaved] = useState(false);
  const [error, setError] = useState("");

  async function handleTogglePause() {
    setPausing(true);
    setError("");

    if (isPaused) {
      const result = await togglePauseAction(false);
      if (!result.ok) setError(result.error);
    } else {
      const untilMs = pauseDate
        ? new Date(pauseDate).getTime()
        : undefined;
      const result = await togglePauseAction(true, untilMs);
      if (!result.ok) setError(result.error);
    }

    setPausing(false);
    router.refresh();
  }

  async function handleSaveCapacity() {
    setSavingCapacity(true);
    setError("");
    setCapacitySaved(false);

    const result = await updateCapacityAction(capacity);
    if (result.ok) {
      setCapacitySaved(true);
      setTimeout(() => setCapacitySaved(false), 2000);
    } else {
      setError(result.error);
    }

    setSavingCapacity(false);
  }

  return (
    <div className="space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
        className="text-xl font-semibold tracking-tight"
        style={{ color: neutral[900] }}
      >
        Availability
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, delay: 0.05 }}
        className="rounded-xl border p-4 space-y-4"
        style={{ borderColor: neutral[300] }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: neutral[900] }}
            >
              Status
            </p>
            <p className="text-xs" style={{ color: neutral[500] }}>
              {isPaused ? "You're paused — no new assignments." : "Active — available for work."}
            </p>
          </div>

          <button
            onClick={handleTogglePause}
            disabled={pausing}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: isPaused ? semantic.success : neutral[300],
              color: isPaused ? "#fff" : neutral[900],
            }}
          >
            {isPaused ? (
              <>
                <PlayCircleIcon size={14} />
                Resume
              </>
            ) : (
              <>
                <PauseCircleIcon size={14} />
                Pause
              </>
            )}
          </button>
        </div>

        {!isPaused && (
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: neutral[500] }}
            >
              Pause until (optional)
            </label>
            <input
              type="date"
              value={pauseDate}
              onChange={(e) => setPauseDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: neutral[300],
                color: neutral[900],
                backgroundColor: "var(--color-surface-0)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: neutral[500] }}>
              Set a date before pausing to auto-resume.
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, delay: 0.1 }}
        className="rounded-xl border p-4 space-y-4"
        style={{ borderColor: neutral[300] }}
      >
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: neutral[900] }}
          >
            Weekly capacity
          </p>
          <p className="text-xs" style={{ color: neutral[500] }}>
            How many hours per week you're available.
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min={1}
            max={60}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full accent-[var(--color-brand-orange)]"
            style={
              {
                "--color-brand-orange": brand.orange,
              } as React.CSSProperties
            }
          />
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: neutral[500] }}>
              {capacity}h / week
            </span>
            <button
              onClick={handleSaveCapacity}
              disabled={savingCapacity || capacity === weeklyCapacityHours}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: brand.orange, color: "#fff" }}
            >
              {capacitySaved ? "Saved" : savingCapacity ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </motion.div>

      {error && (
        <p className="text-xs" style={{ color: semantic.error }}>
          {error}
        </p>
      )}
    </div>
  );
}
