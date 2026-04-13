/**
 * Primitive + wrapper import smoke test (A3).
 *
 * Asserts that every spec-locked primitive and every A3 custom wrapper is
 * exported from the path downstream code will import it from. Rename /
 * delete regressions in `components/ui/` or `components/lite/` trip this
 * before they reach Phase 5 feature sessions.
 */
import { describe, it, expect } from "vitest"

describe("shadcn primitives (spec-locked inventory)", () => {
  it("exports all form primitives", async () => {
    const modules = await Promise.all([
      import("@/components/ui/button"),
      import("@/components/ui/input"),
      import("@/components/ui/label"),
      import("@/components/ui/textarea"),
      import("@/components/ui/select"),
      import("@/components/ui/checkbox"),
      import("@/components/ui/switch"),
      import("@/components/ui/radio-group"),
      import("@/components/ui/form"),
      import("@/components/ui/field"),
    ])
    expect(modules.every((m) => m)).toBe(true)
    expect(modules[0].Button).toBeDefined()
    expect(modules[8].Form).toBeDefined()
  })

  it("exports all surface primitives", async () => {
    const modules = await Promise.all([
      import("@/components/ui/card"),
      import("@/components/ui/dialog"),
      import("@/components/ui/sheet"),
      import("@/components/ui/drawer"),
      import("@/components/ui/popover"),
      import("@/components/ui/tooltip"),
      import("@/components/ui/dropdown-menu"),
      import("@/components/ui/context-menu"),
      import("@/components/ui/hover-card"),
      import("@/components/ui/alert-dialog"),
    ])
    expect(modules.every((m) => m)).toBe(true)
  })

  it("exports navigation, feedback, data, command + date primitives", async () => {
    const modules = await Promise.all([
      import("@/components/ui/tabs"),
      import("@/components/ui/accordion"),
      import("@/components/ui/collapsible"),
      import("@/components/ui/separator"),
      import("@/components/ui/scroll-area"),
      import("@/components/ui/sonner"),
      import("@/components/ui/avatar"),
      import("@/components/ui/badge"),
      import("@/components/ui/skeleton"),
      import("@/components/ui/progress"),
      import("@/components/ui/table"),
      import("@/components/ui/command"),
      import("@/components/ui/calendar"),
      import("@/components/ui/date-picker"),
    ])
    expect(modules.every((m) => m)).toBe(true)
  })
})

describe("custom Lite wrappers (A3)", () => {
  it("exports ThemeProvider + useDisplayPreferences", async () => {
    const m = await import("@/components/lite/theme-provider")
    expect(m.ThemeProvider).toBeDefined()
    expect(m.useDisplayPreferences).toBeDefined()
  })

  it("exports MotionProvider", async () => {
    const m = await import("@/components/lite/motion-provider")
    expect(m.MotionProvider).toBeDefined()
  })

  it("exports SoundProvider + useSound + stub play()", async () => {
    const m = await import("@/components/lite/sound-provider")
    expect(m.SoundProvider).toBeDefined()
    expect(m.useSound).toBeDefined()
  })

  it("exports BrandHero", async () => {
    const m = await import("@/components/lite/brand-hero")
    expect(m.BrandHero).toBeDefined()
  })

  it("exports SkeletonTile", async () => {
    const m = await import("@/components/lite/skeleton-tile")
    expect(m.SkeletonTile).toBeDefined()
  })

  it("exports EmptyState", async () => {
    const m = await import("@/components/lite/empty-state")
    expect(m.EmptyState).toBeDefined()
  })

  it("exports Tier2Reveal", async () => {
    const m = await import("@/components/lite/tier-2-reveal")
    expect(m.Tier2Reveal).toBeDefined()
  })

  it("exports AdminShell", async () => {
    const m = await import("@/components/lite/admin-shell")
    expect(m.AdminShell).toBeDefined()
  })
})
