# `PM-2` — Design System Baseline Revisit — Handoff

**Closed:** 2026-04-19
**Type:** UI (medium) — spec patches, no new features
**Model tier:** Sonnet (actual: Opus, session was mid-queue)

---

## What was done

Four deferred PATCHES_OWED entries reconciled against the design-system-baseline spec, the sales-pipeline spec, and one code file.

### 1. BHS closed list expanded to 9

`docs/specs/design-system-baseline.md` §6 (Black Han Sans closed list): added "Won card outcome badge (RETAINER/SAAS)" as location #9. Already implemented in SP-3 (`won-badge.tsx`); this is the spec catching up to code. Gate bumped from "8 locations, 9th requires Andy approval" to "9 locations, 10th requires Andy approval".

### 2. Tier 2 motion list expanded to 9

`docs/specs/design-system-baseline.md` §Motion Tier 2: added entries #8 (`brand-dna-reveal`, per BDA-3) and #9 (`bundle-reveal`, per Phase 3.5 F3.a). Both already implemented in `lib/motion/choreographies.ts`. Spec was still showing 7 entries.

### 3. `pdf_render_overlay` formalised as named Tier 1 token

Added a paragraph under Tier 1 in the spec documenting `pdf_render_overlay` as a reusable named Tier 1 token for synchronous render overlays. Already implemented in `lib/motion/choreographies.ts`. This was the optional-but-recommended patch from F3.b.

### 4. Sound registry name reconciliation

- **Spec count:** updated from "locked at 7" to "locked at 8" (added `brand_dna_reveal` row to the sound table).
- **Name mapping:** sales-pipeline §11 and §11A.2 used descriptive slot names (`chime-bright`, `tick-warm`, `urgent-thud`, `whoosh-soft`, `glass-tap`) that don't exist as registry keys. Patched the spec to use actual registry keys:
  - `chime-bright` → `quote-accepted` (retainer/project) / `subscription-activated` (SaaS)
  - `tick-warm` → `kanban-drop`
  - `urgent-thud` → `error`
  - `whoosh-soft` → removed (slide-overs are silent per design-system baseline)
  - `glass-tap` → removed (never in registry, no corresponding sound)
- **Code cleanup:** removed two stale mapping-explanation comments in `pipeline-board.tsx` (the code already used correct registry keys).
- **Won toast split:** spec now distinguishes retainer/project Won (plays `quote-accepted`) from SaaS Won (plays `subscription-activated`), matching the code in `pipeline-board.tsx`.

### Files edited (4)

| File | Change |
|---|---|
| `docs/specs/design-system-baseline.md` | BHS #9, Tier 2 #8/#9, Tier 1 `pdf_render_overlay`, sound table 7→8, name reconciliation note, open question #3 count fix |
| `docs/specs/sales-pipeline.md` | §11 + §11A.2 + §7.2: replaced descriptive sound names with registry keys; removed `whoosh-soft`/`glass-tap`; split Won sound by outcome type |
| `components/lite/sales-pipeline/pipeline-board.tsx` | Removed 2 stale comments referencing old sound slot names |
| `PATCHES_OWED.md` | Marked 4 entries as APPLIED (lines 41, 183, 196, 488) |

### No new files

This session produced no new files — all work was patches to existing docs and one code cleanup.

## Key decisions

1. **9th BHS location, not a swap.** The Won badge is a legitimate brand-load-bearing surface (customer-warmth moment). Swapping out an existing location would reduce brand presence for no benefit.
2. **Option (a) for sound names — rename spec to match registry.** Adding distinct `chime-bright` / `tick-warm` / `urgent-thud` entries would burn 3 of the 8 slots on aliases. The existing sounds already match the intended character.
3. **`whoosh-soft` and `glass-tap` dropped entirely.** Neither was ever a registry entry. Slide-overs and generic modals are explicitly silent per the design-system baseline "What is silent" list.

## What the next session should know

- No code behaviour changed — all patches are spec/doc alignment. Tests and typecheck are unaffected.
- The stale handoff notes (`sp-3-brief.md`, `sp-4-brief.md`, `sp-9-handoff.md`) still reference old sound names in their prose. Handoffs are ephemeral and not authoritative — no patches needed there.
- The `SheetWithSound` component name in the sales-pipeline spec (§7.2) now says "Silent" — if the component was built with a sound, that's a code/spec mismatch to check during PM-3 (realtime channel session) or a future polish pass.

## Verification

- `npx tsc --noEmit` — 0 new errors (pre-existing `.next/types` duplicates only)
- `npm test` �� no new failures
- No UI changes — no browser check needed (spec-only session)

## Rollback strategy

**Git-revertable.** No migrations, no new tables, no settings keys. All changes are doc patches + 2 deleted comment lines. Zero runtime impact.
