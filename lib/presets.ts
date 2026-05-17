/**
 * Theme + typeface preset selection (server-side).
 *
 * For authenticated users, reads preferences from the `user` table.
 * Falls back to cookies for unauthenticated visitors and the design
 * playground.
 */
import { cookies } from "next/headers";

import {
  DEFAULT_THEME_PRESET,
  DEFAULT_TYPEFACE_PRESET,
  DEFAULT_MOTION_PREFERENCE,
  DEFAULT_DENSITY_PREFERENCE,
  DEFAULT_TEXT_SIZE_PREFERENCE,
  DEFAULT_SOUNDS_ENABLED,
  THEME_PRESETS,
  TYPEFACE_PRESETS,
  themePresetClass,
  typefacePresetClass,
  type ThemePreset,
  type TypefacePreset,
  type MotionPreference,
  type DensityPreference,
  type TextSizePreference,
} from "./design-tokens";

export const THEME_COOKIE = "sb_theme_preset";
export const TYPEFACE_COOKIE = "sb_typeface_preset";

function parseThemePreset(value: string | undefined): ThemePreset {
  return (THEME_PRESETS as readonly string[]).includes(value ?? "")
    ? (value as ThemePreset)
    : DEFAULT_THEME_PRESET;
}

function parseTypefacePreset(value: string | undefined): TypefacePreset {
  return (TYPEFACE_PRESETS as readonly string[]).includes(value ?? "")
    ? (value as TypefacePreset)
    : DEFAULT_TYPEFACE_PRESET;
}

export type ActivePresets = {
  theme: ThemePreset;
  typeface: TypefacePreset;
  motion: MotionPreference;
  density: DensityPreference;
  textSize: TextSizePreference;
  soundsEnabled: boolean;
  htmlClassNames: string;
};

async function loadUserPresets(userId: string) {
  try {
    const [{ eq }, { db }, { user }] = await Promise.all([
      import("drizzle-orm"),
      import("@/lib/db"),
      import("@/lib/db/schema/user"),
    ]);

    return db
      .select({
        theme_preset: user.theme_preset,
        typeface_preset: user.typeface_preset,
        motion_preference: user.motion_preference,
        density_preference: user.density_preference,
        text_size_preference: user.text_size_preference,
        sounds_enabled: user.sounds_enabled,
      })
      .from(user)
      .where(eq(user.id, userId))
      .get();
  } catch {
    return null;
  }
}

export async function getActivePresets(): Promise<ActivePresets> {
  let theme: ThemePreset = DEFAULT_THEME_PRESET;
  let typeface: TypefacePreset = DEFAULT_TYPEFACE_PRESET;
  let motion: MotionPreference = DEFAULT_MOTION_PREFERENCE;
  let density: DensityPreference = DEFAULT_DENSITY_PREFERENCE;
  let textSize: TextSizePreference = DEFAULT_TEXT_SIZE_PREFERENCE;
  let soundsEnabled: boolean = DEFAULT_SOUNDS_ENABLED;
  let foundUser = false;

  if (process.env.NEXTAUTH_SECRET) {
    const { auth } = await import("@/lib/auth/session");
    const session = await auth();
    const row = session?.user?.id
      ? await loadUserPresets(session.user.id)
      : null;

    if (row) {
      foundUser = true;
      theme = parseThemePreset(row.theme_preset);
      typeface = parseTypefacePreset(row.typeface_preset);
      motion = row.motion_preference as MotionPreference;
      density = row.density_preference as DensityPreference;
      textSize = row.text_size_preference as TextSizePreference;
      soundsEnabled = row.sounds_enabled;
    }
  }

  if (!foundUser) {
    const jar = await cookies();
    theme = parseThemePreset(jar.get(THEME_COOKIE)?.value);
    typeface = parseTypefacePreset(jar.get(TYPEFACE_COOKIE)?.value);
  }

  const classes = [
    "dark",
    themePresetClass[theme],
    typefacePresetClass[typeface],
  ].filter(Boolean) as string[];

  return {
    theme,
    typeface,
    motion,
    density,
    textSize,
    soundsEnabled,
    htmlClassNames: classes.join(" "),
  };
}
