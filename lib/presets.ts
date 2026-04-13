/**
 * Theme + typeface preset selection (server-side).
 *
 * The real source of truth for a signed-in user's preferences is the
 * `user` table (landing in A5 / post-A8). Until that lands, presets are
 * driven by cookies so the /lite/_design playground can exercise every
 * variant and any unauthenticated surface picks a sensible default.
 *
 * Cookie names are stable — when the user-table read lands, the cookie
 * becomes a fallback for logged-out visitors only.
 */
import { cookies } from "next/headers";

import {
  DEFAULT_THEME_PRESET,
  DEFAULT_TYPEFACE_PRESET,
  THEME_PRESETS,
  TYPEFACE_PRESETS,
  themePresetClass,
  typefacePresetClass,
  type ThemePreset,
  type TypefacePreset,
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

export async function getActivePresets(): Promise<{
  theme: ThemePreset;
  typeface: TypefacePreset;
  /** Space-separated class list safe to paste onto <html>. */
  htmlClassNames: string;
}> {
  const jar = await cookies();
  const theme = parseThemePreset(jar.get(THEME_COOKIE)?.value);
  const typeface = parseTypefacePreset(jar.get(TYPEFACE_COOKIE)?.value);

  const classes = [
    "dark",
    themePresetClass[theme],
    typefacePresetClass[typeface],
  ].filter(Boolean) as string[];

  return {
    theme,
    typeface,
    htmlClassNames: classes.join(" "),
  };
}
