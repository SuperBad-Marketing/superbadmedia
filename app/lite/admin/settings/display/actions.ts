"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/user";
import {
  MOTION_PREFERENCES,
  DENSITY_PREFERENCES,
  TEXT_SIZE_PREFERENCES,
  THEME_PRESETS,
  TYPEFACE_PRESETS,
} from "@/lib/design-tokens";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session.user.id;
}

export async function updateMotionPreference(formData: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const value = formData.get("value");
  if (
    typeof value !== "string" ||
    !(MOTION_PREFERENCES as readonly string[]).includes(value)
  )
    return;
  db.update(user)
    .set({ motion_preference: value as (typeof MOTION_PREFERENCES)[number] })
    .where(eq(user.id, userId))
    .run();
  revalidatePath("/lite/admin/settings/display");
}

export async function updateSoundsEnabled(formData: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const value = formData.get("value");
  if (value !== "true" && value !== "false") return;
  db.update(user)
    .set({ sounds_enabled: value === "true" })
    .where(eq(user.id, userId))
    .run();
  revalidatePath("/lite/admin/settings/display");
}

export async function updateDensityPreference(formData: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const value = formData.get("value");
  if (
    typeof value !== "string" ||
    !(DENSITY_PREFERENCES as readonly string[]).includes(value)
  )
    return;
  db.update(user)
    .set({
      density_preference: value as (typeof DENSITY_PREFERENCES)[number],
    })
    .where(eq(user.id, userId))
    .run();
  revalidatePath("/lite/admin/settings/display");
}

export async function updateTextSizePreference(formData: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const value = formData.get("value");
  if (
    typeof value !== "string" ||
    !(TEXT_SIZE_PREFERENCES as readonly string[]).includes(value)
  )
    return;
  db.update(user)
    .set({
      text_size_preference: value as (typeof TEXT_SIZE_PREFERENCES)[number],
    })
    .where(eq(user.id, userId))
    .run();
  revalidatePath("/lite/admin/settings/display");
}

export async function updateThemePreset(formData: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const value = formData.get("value");
  if (
    typeof value !== "string" ||
    !(THEME_PRESETS as readonly string[]).includes(value)
  )
    return;
  db.update(user)
    .set({ theme_preset: value as (typeof THEME_PRESETS)[number] })
    .where(eq(user.id, userId))
    .run();
  revalidatePath("/lite/admin/settings/display");
}

export async function updateTypefacePreset(formData: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const value = formData.get("value");
  if (
    typeof value !== "string" ||
    !(TYPEFACE_PRESETS as readonly string[]).includes(value)
  )
    return;
  db.update(user)
    .set({ typeface_preset: value as (typeof TYPEFACE_PRESETS)[number] })
    .where(eq(user.id, userId))
    .run();
  revalidatePath("/lite/admin/settings/display");
}

export async function updateTricksEnabled(formData: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const value = formData.get("value");
  if (value !== "true" && value !== "false") return;
  db.update(user)
    .set({ hidden_egg_tricks_enabled: value === "true" })
    .where(eq(user.id, userId))
    .run();
  revalidatePath("/lite/admin/settings/display");
}
