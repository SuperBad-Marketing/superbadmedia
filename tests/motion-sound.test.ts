import { describe, expect, it } from "vitest"

import {
  TIER_2_KEYS,
  pdfRenderOverlay,
  tier2,
} from "@/lib/motion/choreographies"
import { SOUND_KEYS, soundRegistry } from "@/lib/sounds"
import { houseSpring } from "@/lib/design-tokens"

describe("Tier 2 choreography registry", () => {
  it("has exactly 7 locked keys", () => {
    expect(TIER_2_KEYS).toHaveLength(7)
  })

  it("names the 7 moments from docs/specs/design-system-baseline.md §Motion", () => {
    expect([...TIER_2_KEYS].sort()).toEqual(
      [
        "dashboard-first-load",
        "morning-brief-open",
        "quote-accepted",
        "subscription-activated",
        "wizard-complete",
        "portal-first-load",
        "inbox-zero",
      ].sort()
    )
  })

  it("registers every key with variants, transition, and a reduced fallback", () => {
    for (const key of TIER_2_KEYS) {
      const entry = tier2[key]
      expect(entry.variants).toBeDefined()
      expect(entry.transition).toBeDefined()
      expect(entry.reduced.variants).toBeDefined()
      expect(entry.reduced.transition).toBeDefined()
      expect(entry.durationMs).toBeGreaterThan(0)
    }
  })

  it("exposes pdfRenderOverlay as a Tier 1 token", () => {
    expect(pdfRenderOverlay.variants.initial).toBeDefined()
    expect(pdfRenderOverlay.variants.animate).toBeDefined()
    expect(pdfRenderOverlay.reduced.transition).toBeDefined()
  })
})

describe("houseSpring preset", () => {
  it("matches the spec-locked Framer spring values", () => {
    expect(houseSpring).toEqual({
      type: "spring",
      mass: 1,
      stiffness: 220,
      damping: 25,
    })
  })
})

describe("Sound registry", () => {
  it("has exactly 7 locked keys", () => {
    expect(SOUND_KEYS).toHaveLength(7)
  })

  it("matches the spec's canonical kebab-case keys", () => {
    expect([...SOUND_KEYS].sort()).toEqual(
      [
        "quote-accepted",
        "subscription-activated",
        "kanban-drop",
        "morning-brief",
        "inbox-arrival",
        "deliverable-complete",
        "error",
      ].sort()
    )
  })

  it("registers every key with a public src path and sane volume", () => {
    for (const key of SOUND_KEYS) {
      const entry = soundRegistry[key]
      expect(entry.key).toBe(key)
      expect(entry.src).toMatch(/^\/sounds\/approved\/[a-z-]+\.mp3$/)
      expect(entry.volume).toBeGreaterThan(0)
      expect(entry.volume).toBeLessThanOrEqual(1)
      expect(entry.character.length).toBeGreaterThan(0)
    }
  })
})
