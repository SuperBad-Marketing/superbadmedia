"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth/session";
import { generateBriefForSlot } from "@/lib/cockpit/generate-brief";
import { getCurrentSlot } from "@/lib/cockpit/queries";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { habit_completions } from "@/lib/db/schema/habits";
import { and, eq } from "drizzle-orm";
import { melbourneWallDate } from "@/lib/time/melbourne";

export async function regenerateBriefAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  const slot = getCurrentSlot();
  const result = await generateBriefForSlot(slot, {
    trigger: "material_event",
    triggerEvent: "manual_refresh",
  });

  revalidatePath("/lite/cockpit");

  if (!result.generated) {
    return { ok: true as const, quiet: true };
  }

  return { ok: true as const, quiet: false, prose: result.prose };
}

export async function toggleHabitAction(habitId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  const nowMs = Date.now();
  const { year, month, day } = melbourneWallDate(nowMs);
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const existing = await db.query.habit_completions.findFirst({
    where: and(
      eq(habit_completions.habit_id, habitId),
      eq(habit_completions.completed_date, todayStr),
    ),
  });

  if (existing) {
    await db.delete(habit_completions).where(eq(habit_completions.id, existing.id));
    revalidatePath("/lite/cockpit");
    return { ok: true as const, completed: false };
  }

  await db.insert(habit_completions).values({
    id: randomUUID(),
    habit_id: habitId,
    completed_date: todayStr,
    completed_at_ms: nowMs,
  });

  revalidatePath("/lite/cockpit");
  return { ok: true as const, completed: true };
}
