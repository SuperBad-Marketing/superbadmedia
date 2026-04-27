import "server-only";
import { db } from "@/lib/db";
import { habits, habit_completions } from "@/lib/db/schema/habits";
import { eq, and, gte, desc } from "drizzle-orm";
import { melbourneWallDate } from "@/lib/time/melbourne";
import type { HabitCadence } from "@/lib/db/schema/habits";

function toDateString(ms: number): string {
  const { year, month, day } = melbourneWallDate(ms);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function melbourneDayOfWeek(ms: number): number {
  const { year, month, day } = melbourneWallDate(ms);
  return new Date(year, month - 1, day).getDay();
}

const CADENCE_DAYS: Record<Exclude<HabitCadence, "custom">, number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  "3x_week": [1, 3, 5],
  "2x_week": [2, 4],
};

function getApplicableDays(cadence: HabitCadence, cadenceDays: string | null): number[] {
  if (cadence === "custom" && cadenceDays) {
    return cadenceDays.split(",").map(Number);
  }
  return CADENCE_DAYS[cadence as Exclude<HabitCadence, "custom">] ?? [0, 1, 2, 3, 4, 5, 6];
}

function cadenceLabel(cadence: HabitCadence, cadenceDays: string | null): string {
  switch (cadence) {
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "3x_week":
      return "3×/week";
    case "2x_week":
      return "2×/week";
    case "custom": {
      const days = getApplicableDays(cadence, cadenceDays);
      return `${days.length}×/week`;
    }
  }
}

function computeStreak(
  applicableDays: number[],
  completedDates: Set<string>,
  todayStr: string,
  todayCompleted: boolean,
): number {
  if (!todayCompleted && completedDates.size === 0) return 0;

  let streak = 0;
  const d = new Date(todayStr + "T00:00:00");

  if (todayCompleted) {
    streak = 1;
    d.setDate(d.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dow = d.getDay();
    if (applicableDays.includes(dow)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (completedDates.has(ds)) {
        streak++;
      } else {
        break;
      }
    }
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

export type HabitWithStatus = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  linkHref: string | null;
  cadence: HabitCadence;
  cadenceLabel: string;
  completedToday: boolean;
  streak: number;
  sortOrder: number;
};

export async function getTodayHabits(nowMs: number = Date.now()): Promise<HabitWithStatus[]> {
  const todayStr = toDateString(nowMs);
  const dow = melbourneDayOfWeek(nowMs);

  const allHabits = await db.query.habits.findMany({
    where: eq(habits.active, true),
    orderBy: [habits.sort_order],
  });

  const todayHabits = allHabits.filter((h) => {
    const days = getApplicableDays(h.cadence as HabitCadence, h.cadence_days);
    return days.includes(dow);
  });

  if (todayHabits.length === 0) return [];

  const lookbackDate = new Date(todayStr + "T00:00:00");
  lookbackDate.setDate(lookbackDate.getDate() - 60);
  const lookbackStr = `${lookbackDate.getFullYear()}-${String(lookbackDate.getMonth() + 1).padStart(2, "0")}-${String(lookbackDate.getDate()).padStart(2, "0")}`;

  const completions = await db.query.habit_completions.findMany({
    where: and(
      gte(habit_completions.completed_date, lookbackStr),
    ),
    orderBy: [desc(habit_completions.completed_date)],
  });

  const completionsByHabit = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!completionsByHabit.has(c.habit_id)) {
      completionsByHabit.set(c.habit_id, new Set());
    }
    completionsByHabit.get(c.habit_id)!.add(c.completed_date);
  }

  return todayHabits.map((h) => {
    const dates = completionsByHabit.get(h.id) ?? new Set<string>();
    const completedToday = dates.has(todayStr);
    const applicableDays = getApplicableDays(h.cadence as HabitCadence, h.cadence_days);
    const streak = computeStreak(applicableDays, dates, todayStr, completedToday);

    return {
      id: h.id,
      title: h.title,
      description: h.description,
      icon: h.icon,
      linkHref: h.link_href,
      cadence: h.cadence as HabitCadence,
      cadenceLabel: cadenceLabel(h.cadence as HabitCadence, h.cadence_days),
      completedToday,
      streak,
      sortOrder: h.sort_order,
    };
  });
}
