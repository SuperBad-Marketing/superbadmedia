"use client";

import { useState, useOptimistic, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { toggleHabitAction } from "@/app/lite/cockpit/actions";
import type { HabitWithStatus } from "@/lib/habits/queries";

type OptimisticHabit = HabitWithStatus & { pending?: boolean };

export function HabitsPanel({ habits }: { habits: HabitWithStatus[] }) {
  const reducedMotion = useReducedMotion();
  const [, startTransition] = useTransition();

  const [optimisticHabits, toggleOptimistic] = useOptimistic(
    habits,
    (state: OptimisticHabit[], habitId: string) =>
      state.map((h) =>
        h.id === habitId
          ? {
              ...h,
              completedToday: !h.completedToday,
              streak: h.completedToday
                ? Math.max(0, h.streak - 1)
                : h.streak + 1,
              pending: true,
            }
          : h,
      ),
  );

  const completed = optimisticHabits.filter((h) => h.completedToday).length;
  const total = optimisticHabits.length;
  const allDone = completed === total;
  const progress = total > 0 ? completed / total : 0;

  function handleToggle(habitId: string) {
    startTransition(async () => {
      toggleOptimistic(habitId);
      await toggleHabitAction(habitId);
    });
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-5 flex items-center gap-3">
        <div
          className="relative h-1 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--color-surface-1)" }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 w-full rounded-full"
            style={{
              backgroundColor: allDone ? "var(--color-success)" : "var(--color-brand-red)",
              transformOrigin: "left",
            }}
            initial={false}
            animate={{ scaleX: progress }}
            transition={reducedMotion ? { duration: 0 } : { ...houseSpring }}
          />
        </div>
        <span
          className="font-[family-name:var(--font-label)] text-[11px] tabular-nums"
          style={{ color: allDone ? "var(--color-success)" : "var(--color-neutral-500)" }}
        >
          {completed}/{total}
        </span>
      </div>

      {/* Habit list */}
      <div className="flex flex-col gap-1">
        {optimisticHabits.map((habit, i) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            index={i}
            onToggle={handleToggle}
            reducedMotion={reducedMotion ?? false}
          />
        ))}
      </div>

      {/* All-done state */}
      <AnimatePresence>
        {allDone && (
          <motion.p
            className="mt-4 text-center font-[family-name:var(--font-narrative)] text-[14px] italic"
            style={{ color: "var(--color-neutral-500)" }}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
          >
            Done for the day. Nice one.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function HabitRow({
  habit,
  index,
  onToggle,
  reducedMotion,
}: {
  habit: OptimisticHabit;
  index: number;
  onToggle: (id: string) => void;
  reducedMotion: boolean;
}) {
  const [justCompleted, setJustCompleted] = useState(false);

  function handleClick() {
    if (!habit.completedToday) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
    }
    onToggle(habit.id);
  }

  return (
    <motion.button
      onClick={handleClick}
      className="group flex w-full items-center gap-3 rounded-[var(--radius-default)] px-3 py-3 text-left transition-colors"
      style={{
        backgroundColor: "transparent",
      }}
      whileHover={reducedMotion ? undefined : { backgroundColor: "rgba(253, 245, 230, 0.03)" }}
      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.1 }}
      layout={!reducedMotion}
    >
      {/* Checkbox */}
      <div className="relative flex-shrink-0" style={{ width: 22, height: 22 }}>
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: habit.completedToday
              ? "2px solid var(--color-brand-red)"
              : "2px solid var(--color-neutral-600)",
            backgroundColor: habit.completedToday
              ? "var(--color-brand-red)"
              : "transparent",
          }}
          initial={false}
          animate={
            reducedMotion
              ? undefined
              : {
                  scale: justCompleted ? 1.2 : 1,
                }
          }
          transition={reducedMotion ? { duration: 0 } : houseSpring}
        />
        {/* Checkmark */}
        <AnimatePresence>
          {habit.completedToday && (
            <motion.svg
              viewBox="0 0 22 22"
              className="absolute inset-0"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.5 }}
              transition={reducedMotion ? { duration: 0 } : { ...houseSpring, delay: 0.05 }}
            >
              <motion.path
                d="M6 11.5L9.5 15L16 8"
                fill="none"
                stroke="var(--color-brand-cream)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reducedMotion ? undefined : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.25, delay: 0.1, ease: "easeOut" }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>

      {/* Title + cadence */}
      <div className="flex flex-1 items-baseline gap-2 min-w-0">
        <motion.span
          className="text-[14px] font-[family-name:var(--font-body)] truncate"
          initial={false}
          animate={{
            opacity: habit.completedToday ? 0.4 : 1,
            x: habit.completedToday && !reducedMotion ? 2 : 0,
          }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
          style={{
            color: "var(--color-neutral-100)",
            textDecorationLine: habit.completedToday ? "line-through" : "none",
            textDecorationColor: "var(--color-neutral-600)",
          }}
        >
          {habit.title}
        </motion.span>
        <span
          className="flex-shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{
            color: "var(--color-neutral-600)",
            letterSpacing: "0.5px",
          }}
        >
          {habit.cadenceLabel}
        </span>
      </div>

      {/* Streak */}
      {habit.streak > 0 && (
        <motion.div
          className="flex flex-shrink-0 items-center gap-1"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reducedMotion ? { duration: 0 } : houseSpring}
        >
          <Flame
            className="h-3.5 w-3.5"
            style={{ color: "var(--color-brand-orange)" }}
          />
          <span
            className="font-[family-name:var(--font-label)] text-[11px] tabular-nums"
            style={{ color: "var(--color-brand-orange)" }}
          >
            {habit.streak}
          </span>
        </motion.div>
      )}
    </motion.button>
  );
}
