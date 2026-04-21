# SD-8 Handoff — Surprise & Delight: CRT Turn-Off Egg Renderer

**Date:** 2026-04-21
**Wave:** 20
**Status:** COMPLETE

## What was built

### CRT turn-off overlay component

`components/lite/crt-turn-off-overlay.tsx`:
- Client component listening for `admin-egg-fired` CustomEvent on `window`
- Filters for `eggId === "crt_turn_off"` only; ignores all other eggs
- Four-phase animation sequence:
  1. **dim** (300ms) — screen dims to 70% opacity via `neutral[950]` overlay
  2. **static** (180ms) — warm analog static (SVG feTurbulence noise) flashes at 15% opacity, dim deepens to 85%
  3. **collapse** (600ms) — CRT horizontal line collapses from full viewport height to 2px with warm glow, then to 0px
  4. **frozen** (terminal) — black screen with spec-mandated copy
- Copy: *"you've been up until 2am three nights running. I'm pulling the plug."* (serif, italic, neutral-300)
- Exit instruction: *"close this tab."* (uppercase, tracking-widest, neutral-500)
- No dismiss button, no alternative exit — closing the tab is the only way out
- Scanline overlay (repeating-linear-gradient, 2px pitch) persists throughout all phases for CRT texture
- z-index 9999 — above all other platform content including modals

### Admin layout integration

`app/lite/admin/layout.tsx`:
- Added `<CrtTurnOffOverlay />` alongside existing `<AdminEggOrchestrator />`
- Orchestrator dispatches `admin-egg-fired` CustomEvent → overlay listens and activates

## New files

- `components/lite/crt-turn-off-overlay.tsx`
- `tests/sd8-crt-overlay.test.ts`

## Edited files

- `app/lite/admin/layout.tsx` — added CrtTurnOffOverlay import + render

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 266 files, 2594 passed, 1 skipped (11 new tests)
- Browser: admin layout loads with CrtTurnOffOverlay mounted (no visual change in idle state — correct). Cannot trigger in dev because egg requires 3 late-night sessions in real activity_log data (per SD-7 handoff).

## Rollback

- All new files additive; git-revertable
- Admin layout edit is backward-compatible (new component render only)
- No schema changes, no settings keys consumed

## Key decisions

- **Separated `CrtActive` from `CrtTurnOffOverlay`** — avoids TypeScript narrowing issue where `phase !== "idle"` guard in AnimatePresence didn't narrow the type for nested conditionals. The inner component receives `ActivePhase` (excludes "idle") directly.
- **SVG feTurbulence for analog static** — lightweight, no image assets, renders at any resolution. Filter ID `crt-noise` is scoped to the overlay SVG.
- **Phase timers use individual `setTimeout` per phase** — each phase's useEffect sets one timer for the next phase. Cleanup on unmount or phase change prevents leaked timers.
- **No sound effect** — the 8-slot sound registry is full and the spec doesn't mention sound for this egg. The visual sequence is the entire effect.
- **Frozen state has no timeout** — it stays forever until the tab is closed. This matches spec: "Closing the tab is the exit."

## Next session should know

- **SD-9+** continues S&D. The milestone spotter egg renderer and the Three Wons inline toast are not yet built.
- **The public CRT turn-off egg (#12 in spec)** is a separate trigger (`public_crt_turn_off`) with its own renderer — it will need its own overlay component mounted in the public layout, not the admin layout. The visual effect can share the same animation approach but the copy and enforcement are different (cookie-gated re-entry block until 07:00).
- **Testing the admin CRT overlay in-browser requires seeding `activity_log` with 3 late-night sessions** — or dispatching `admin-egg-fired` CustomEvent manually via devtools: `window.dispatchEvent(new CustomEvent("admin-egg-fired", { detail: { eggId: "crt_turn_off", evidence: {} } }))`.
