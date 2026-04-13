"use client"

import * as React from "react"

import {
  type ThemePreset,
  type TypefacePreset,
  type DensityPreference,
  type MotionPreference,
  type TextSizePreference,
  DEFAULT_THEME_PRESET,
  DEFAULT_TYPEFACE_PRESET,
  DEFAULT_DENSITY_PREFERENCE,
  DEFAULT_MOTION_PREFERENCE,
  DEFAULT_TEXT_SIZE_PREFERENCE,
  DEFAULT_SOUNDS_ENABLED,
} from "@/lib/design-tokens"

/**
 * ThemeProvider — exposes the active Display preferences to client code.
 *
 * In v1 the preferences are read server-side from cookies (see `lib/presets.ts`)
 * and the `<html>` class list is applied in `app/layout.tsx`. This provider
 * simply carries the resolved values into React context so client components
 * can branch (e.g. a chart that skips animation when `motion === 'reduced'`).
 *
 * Once A5 lands the `user` preference columns, A8's server session will pass
 * the per-user values here instead of the cookie defaults.
 *
 * Consumed tokens: all six preference axes from `lib/design-tokens.ts`.
 */
export type DisplayPreferences = {
  theme: ThemePreset
  typeface: TypefacePreset
  motion: MotionPreference
  density: DensityPreference
  textSize: TextSizePreference
  soundsEnabled: boolean
}

const DEFAULT_PREFERENCES: DisplayPreferences = {
  theme: DEFAULT_THEME_PRESET,
  typeface: DEFAULT_TYPEFACE_PRESET,
  motion: DEFAULT_MOTION_PREFERENCE,
  density: DEFAULT_DENSITY_PREFERENCE,
  textSize: DEFAULT_TEXT_SIZE_PREFERENCE,
  soundsEnabled: DEFAULT_SOUNDS_ENABLED,
}

const ThemeContext = React.createContext<DisplayPreferences>(DEFAULT_PREFERENCES)

export function ThemeProvider({
  value,
  children,
}: {
  value?: Partial<DisplayPreferences>
  children: React.ReactNode
}) {
  const resolved = React.useMemo<DisplayPreferences>(
    () => ({ ...DEFAULT_PREFERENCES, ...value }),
    [value]
  )
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
}

export function useDisplayPreferences(): DisplayPreferences {
  return React.useContext(ThemeContext)
}
