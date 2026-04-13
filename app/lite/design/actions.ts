"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  THEME_PRESETS,
  TYPEFACE_PRESETS,
  type ThemePreset,
  type TypefacePreset,
} from "@/lib/design-tokens";
import { THEME_COOKIE, TYPEFACE_COOKIE } from "@/lib/presets";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setThemePreset(formData: FormData): Promise<void> {
  const value = formData.get("preset");
  if (typeof value !== "string" || !(THEME_PRESETS as readonly string[]).includes(value)) {
    return;
  }
  const jar = await cookies();
  jar.set(THEME_COOKIE, value as ThemePreset, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  revalidatePath("/lite/design");
}

export async function setTypefacePreset(formData: FormData): Promise<void> {
  const value = formData.get("preset");
  if (typeof value !== "string" || !(TYPEFACE_PRESETS as readonly string[]).includes(value)) {
    return;
  }
  const jar = await cookies();
  jar.set(TYPEFACE_COOKIE, value as TypefacePreset, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  revalidatePath("/lite/design");
}
