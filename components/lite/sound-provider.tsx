"use client"

import * as React from "react"
import { Howl } from "howler"

import { soundRegistry, type SoundKey } from "@/lib/sounds"

import { useDisplayPreferences } from "./theme-provider"

/**
 * SoundProvider — Howler-backed playback of the 7 locked sounds.
 *
 * Hard-gated on `soundsEnabled` (mutes every call), and also silenced when
 * the user's `motion_preference` is anything other than `full` — per spec
 * §Sound, audio respects `prefers-reduced-motion: reduce`. Reduced motion
 * without sound is the quieter experience those users asked for.
 *
 * Sound files live at `/public/sounds/approved/<key>.mp3`. Files are added
 * in a later "sound review" admin session (Freesound + ElevenLabs sourcing,
 * Andy reviews 2–3 candidates per sound). Until a file exists, `play()` is
 * silent — Howler's `onloaderror` handler catches the 404 without throwing.
 *
 * Instances are lazy-initialised on first `play(key)` and reused, so we
 * don't allocate 7 Howl objects up-front on every mount.
 *
 * Consumed tokens: `sounds_enabled`, `motion_preference`.
 */
export type SoundContextValue = {
  enabled: boolean
  play: (key: SoundKey) => void
}

const SoundContext = React.createContext<SoundContextValue>({
  enabled: false,
  play: () => {},
})

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { soundsEnabled, motion } = useDisplayPreferences()
  const enabled = soundsEnabled && motion === "full"
  const howlsRef = React.useRef<Partial<Record<SoundKey, Howl>>>({})

  React.useEffect(() => {
    // Dispose Howl instances when the provider unmounts so the audio
    // context doesn't leak across HMR boundaries.
    const howls = howlsRef.current
    return () => {
      for (const howl of Object.values(howls)) {
        howl?.unload()
      }
      howlsRef.current = {}
    }
  }, [])

  const play = React.useCallback(
    (key: SoundKey) => {
      if (!enabled) return
      if (typeof window === "undefined") return
      const entry = soundRegistry[key]
      let howl = howlsRef.current[key]
      if (!howl) {
        howl = new Howl({
          src: [entry.src],
          volume: entry.volume,
          preload: true,
          // Missing files (not yet sourced) should silently no-op, not throw.
          onloaderror: () => {
            // Expected while `/public/sounds/approved/*` is empty. Replace
            // with a real warning path once files land and a missing file
            // would be a regression.
          },
          onplayerror: () => {
            // Autoplay policy can block the very first play(); resubscribe
            // and retry on unlock.
            howl?.once("unlock", () => howl?.play())
          },
        })
        howlsRef.current[key] = howl
      }
      howl.play()
    },
    [enabled]
  )

  const value = React.useMemo<SoundContextValue>(
    () => ({ enabled, play }),
    [enabled, play]
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound(): SoundContextValue {
  return React.useContext(SoundContext)
}

export type { SoundKey }
