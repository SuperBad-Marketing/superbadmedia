"use server";

import { computeAvailableSlots, type Slot } from "@/lib/intro-funnel/calendar";

export async function fetchAvailableSlots(): Promise<Slot[]> {
  const now = new Date();
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  return computeAvailableSlots(now, sixtyDaysOut);
}

export async function bookSlot(
  token: string,
  startMs: number,
  endMs: number,
): Promise<{ ok: boolean; error?: string }> {
  const { bookSlotAction } = await import("@/lib/intro-funnel/booking-actions");
  return bookSlotAction(token, startMs, endMs);
}
