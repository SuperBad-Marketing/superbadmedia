"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Flame,
  Palette,
  Video,
  Target,
  Inbox,
  Send,
  Check,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { toggleHabitAction } from "@/app/lite/cockpit/actions";
import type { HabitWithStatus } from "@/lib/habits/queries";

const ICON_MAP: Record<string, LucideIcon> = {
  palette: Palette,
  video: Video,
  target: Target,
  inbox: Inbox,
  send: Send,
};

const ALL_DONE_LINES = [
  "Nothing left. Suspicious.",
  "Clean sweep. Don't get used to it.",
  "All done. The hard part is tomorrow.",
];

function pickAllDoneLine(): string {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return ALL_DONE_LINES[dayIndex % ALL_DONE_LINES.length];
}

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

  function handleToggle(habitId: string) {
    startTransition(async () => {
      toggleOptimistic(habitId);
      await toggleHabitAction(habitId);
    });
  }

  return (
    <div>
      {/* Section header with count */}
      <div className="mb-4 flex items-baseline justify-between">
        <h2
          className="font-[family-name:var(--font-label)] text-[12px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          The Routine
        </h2>
        <span
          className="font-[family-name:var(--font-label)] text-[11px] tabular-nums"
          style={{ color: allDone ? "var(--color-success)" : "var(--color-neutral-600)" }}
        >
          {completed} of {total}
        </span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {optimisticHabits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            onToggle={handleToggle}
            reducedMotion={reducedMotion ?? false}
          />
        ))}
      </div>

      {/* All-done state */}
      <AnimatePresence>
        {allDone && (
          <motion.p
            className="mt-5 text-center font-[family-name:var(--font-narrative)] text-[14px] italic"
            style={{ color: "var(--color-neutral-500)" }}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
          >
            {pickAllDoneLine()}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function HabitCard({
  habit,
  onToggle,
  reducedMotion,
}: {
  habit: OptimisticHabit;
  onToggle: (id: string) => void;
  reducedMotion: boolean;
}) {
  const Icon = (habit.icon && ICON_MAP[habit.icon]) || Palette;
  const done = habit.completedToday;

  return (
    <motion.div
      className="relative flex flex-col gap-3 rounded-[var(--radius-generous)] p-4"
      style={{
        backgroundColor: done ? "var(--color-surface-2)" : "var(--color-surface-0)",
        border: done
          ? "1px solid rgba(123, 174, 126, 0.12)"
          : "1px solid rgba(253, 245, 230, 0.06)",
        boxShadow: done
          ? "none"
          : "var(--surface-highlight), 0 2px 12px rgba(0,0,0,0.2)",
      }}
      initial={false}
      animate={
        reducedMotion
          ? undefined
          : { opacity: done ? 0.65 : 1 }
      }
      transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
    >
      {/* Top row: icon + cadence + check */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-[var(--radius-default)]"
            style={{
              backgroundColor: done
                ? "rgba(123, 174, 126, 0.1)"
                : "rgba(242, 140, 82, 0.1)",
            }}
          >
            <Icon
              className="size-4"
              style={{
                color: done
                  ? "var(--color-success)"
                  : "var(--color-brand-orange)",
              }}
            />
          </div>
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "0.5px",
              color: "var(--color-neutral-600)",
            }}
          >
            {habit.cadenceLabel}
          </span>
        </div>

        {/* Check button */}
        <button
          onClick={() => onToggle(habit.id)}
          className="group/check flex size-7 items-center justify-center rounded-full transition-colors"
          style={{
            backgroundColor: done
              ? "var(--color-success)"
              : "transparent",
            border: done
              ? "2px solid var(--color-success)"
              : "2px solid var(--color-neutral-600)",
          }}
          aria-label={done ? `Uncheck ${habit.title}` : `Mark ${habit.title} done`}
        >
          <AnimatePresence>
            {done && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.5 }}
                transition={reducedMotion ? { duration: 0 } : houseSpring}
              >
                <Check
                  className="size-3.5"
                  strokeWidth={3}
                  style={{ color: "var(--color-brand-cream)" }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Title + description */}
      <div className="min-w-0">
        <p
          className="text-[15px] font-medium font-[family-name:var(--font-body)]"
          style={{ color: "var(--color-neutral-100)" }}
        >
          {habit.title}
        </p>
        {habit.description && (
          <p
            className="mt-0.5 text-[13px] font-[family-name:var(--font-narrative)] italic"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {habit.description}
          </p>
        )}
      </div>

      {/* Bottom row: link + streak */}
      <div className="flex items-center justify-between">
        {habit.linkHref ? (
          <Link
            href={habit.linkHref}
            className="group/link inline-flex items-center gap-1 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
            style={{
              letterSpacing: "0.5px",
              color: done
                ? "var(--color-neutral-600)"
                : "var(--color-brand-pink)",
            }}
          >
            Open
            <ArrowRight
              className="size-3 transition-transform group-hover/link:translate-x-0.5"
              style={{ color: "inherit" }}
            />
          </Link>
        ) : (
          <span />
        )}

        {habit.streak > 0 && (
          <motion.div
            className="flex items-center gap-1"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : houseSpring}
          >
            <Flame
              className="size-3.5"
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
      </div>
    </motion.div>
  );
}
