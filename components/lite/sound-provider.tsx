"use client"

import * as React from "react"

import { useDisplayPreferences } from "./theme-provider"

/**
 * SoundProvider — context stub for the Tier 2 sound registry.
 *
 * A3 ships the context shell so downstream components can call `play(key)`
 * today without every consumer needing to wait for A4. The play() call is
 * a no-op in A3 — the actual `use-sound` wiring and the locked 7-item
 * registry land in A4 (motion + sound registry session).
 *
 * Honours `soundsEnabled = false` unconditionally, even after A4 wires the
 * real registry. A muted preference is a hard gate, not a volume knob.
 *
 * Consumed tokens: `DEFAULT_SOUNDS_ENABLED` + the `sounds_enabled` user axis.
 */
export type SoundKey =
  | "morning_brief_arrival"
  | "quote_accepted"
  | "first_client_bell"
  | "milestone_crossed"
  | "brand_dna_complete"
  | "retainer_kickoff"
  | "lights_out"

type SoundContextValue = {
  enabled: boolean
  play: (key: SoundKey) => void
}

const SoundContext = React.createContext<SoundContextValue>({
  enabled: false,
  play: () => {},
})

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { soundsEnabled } = useDisplayPreferences()
  const value = React.useMemo<SoundContextValue>(
    () => ({
      enabled: soundsEnabled,
      // A3 stub — A4 replaces with the `use-sound` registry from `lib/sounds.ts`.
      play: () => {},
    }),
    [soundsEnabled]
  )
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound(): SoundContextValue {
  return React.useContext(SoundContext)
}
