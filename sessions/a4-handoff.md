# A4 — Motion + Sound Registry — Handoff

**Date:** 2026-04-14
**Phase:** 5 · **Wave:** 1 (Foundation A) · **Session:** A4
**Type:** UI · **Model tier used:** Opus (`/deep`) — BUILD_PLAN prescribed Sonnet. Noting the tier drift; A5 should re-tier per BUILD_PLAN.
**Specs consulted:** `docs/specs/design-system-baseline.md` §Motion + §Sound + §Reduced motion behaviour, `BUILD_PLAN.md` Wave 1 A4 block, `AUTONOMY_PROTOCOL.md` (all G-gates).
**Outcome:** **`houseSpring` wired through Framer `MotionConfig` + 7 locked Tier 2 choreographies + `pdf_render_overlay` Tier 1 token + 7-item sound registry with Howler-backed `play()` + reduced-motion / prefers-reduced-motion / mute discipline + `/lite/design` demo rows.** Typecheck clean, `npm test` 25 / 25 green, `npm run build` clean, dev `/lite/design` → HTTP 200 with all seven choreography keys + all seven sound keys present in DOM.

---

## What was built

### Motion

- **`lib/motion/choreographies.ts`** (new) — canonical `TIER_2_KEYS` closed list + `Tier2Key` union + `tier2` record of 7 entries, each with `variants`, `transition`, optional container `staggerChildren`, and a `reduced` fallback (180ms linear fade). Entries match the spec's §Motion Tier 2 table 1:1.
- **`pdfRenderOverlay`** (exported from the same file) — Tier 1 token per BUILD_PLAN A4 "`motion:pdf_render_overlay` Tier 1 token per F3.b"; consumed by QB-3, BI-2, SWP-8 per §D of BUILD_PLAN.
- **`components/lite/motion-provider.tsx`** (rewrite) — wraps the subtree in Framer `<MotionConfig>` with a preference-derived transition:
  - `motion === 'full'` → `houseSpring` default, `reducedMotion="user"` (honours OS).
  - `motion === 'reduced'` → 180ms linear ease-out default, `reducedMotion="always"`.
  - `motion === 'off'` → `{ duration: 0 }`, `reducedMotion="always"`. (Per spec, modal opens keep a 100ms fade — deferred to the Dialog primitive's own transition, not forced here.)
  Keeps the `data-motion` attribute on the wrapper so any component can style-gate without touching Framer.
- **`components/lite/tier-2-reveal.tsx`** (rewrite) — now consumes `tier2[choreography]` directly. Required `choreography` prop (typed against `Tier2Key`). Reduced-motion path reads `reduced.variants` + `reduced.transition` locally so the reveal still arrives (bounded fade), it just stops lifting/glowing.

### Sound

- **`lib/sounds.ts`** (new) — `SOUND_KEYS` closed list + `SoundKey` union + `soundRegistry` with 7 entries. Keys match the spec's canonical kebab-cased list (`quote-accepted`, `subscription-activated`, `kanban-drop`, `morning-brief`, `inbox-arrival`, `deliverable-complete`, `error`). Each entry carries `src`, default `volume`, expected duration, and the spec's character string.
- **`components/lite/sound-provider.tsx`** (rewrite) — Howler-backed. Lazy-instantiates one `Howl` per key on first `play(key)` and reuses it (no upfront allocation of 7 audio contexts). Unloads all Howls on unmount to prevent audio-context leaks across HMR. `onloaderror` swallows the expected 404s while `/public/sounds/approved/*` is empty; `onplayerror` re-subscribes on `unlock` for the autoplay-policy case. Hard-gated on `soundsEnabled && motion === 'full'` per spec §Sound.
- **`SoundKey` keys fixed.** A3 had speculative Tier-2-moment names (`morning_brief_arrival`, `first_client_bell`, etc.); A3's handoff claimed these "already match the locked registry" — they didn't. A4 replaced the union with the spec's actual 7 kebab-cased keys. The gallery + any future consumer now compiles against the canonical list.

### `/lite/design` extensions

- Added two new rows in `app/lite/design/primitives-gallery.tsx`:
  - **Tier2Reveal row** — a `<Select>` over all 7 keys + a Replay button that re-mounts the reveal by bumping a `key` prop. Shows the registry's `durationMs` + description for the active choreography.
  - **Sound registry row** — 7 `<Button>` triggers (one per key) calling `useSound().play(key)`. Status line reflects whether sounds are enabled, with the mute reason inlined. Collapsible `<details>` lists each key's character + expected duration — the registry surfaces its own documentation.

### CSS cleanup

- Dropped the `@keyframes tier2-reveal` keyframe from `app/globals.css` (A3 flagged it as removable once Framer landed). `@keyframes shimmer` stays for `SkeletonTile`.

### Tests

- **`tests/motion-sound.test.ts`** (new, 8 tests) — asserts the Tier 2 registry has exactly 7 keys matching the spec list, every entry has variants + transition + reduced fallback, `pdfRenderOverlay` exposes initial/animate/exit + a reduced transition, `houseSpring` matches the spec-locked spring values, sound registry has exactly 7 keys matching the spec's kebab-cased list, every entry has a sane `/sounds/approved/*.mp3` src and 0–1 volume. Total project tests: 25 / 25 green (up from 17).

## Key decisions locked in-session (technical, per `feedback_technical_decisions_claude_calls`)

1. **Howler directly, not `use-sound`.** BUILD_PLAN names "`use-sound` (Howler.js)" but `use-sound` is a per-component hook API (one sound per `useSound(src)` call). A `play(key)` provider pattern over a 7-entry registry fits Howler's own `new Howl({ src })` API cleanly — trying to dispatch through 7 parallel `useSound` hooks would be awkward and pull state into the render path. `use-sound` was not installed; `howler` + `@types/howler` were. Functionally equivalent — `use-sound` is a thin wrapper over Howler anyway.
2. **Missing sound files silently no-op.** Sourcing lands in a later Phase 5 "sound review" admin session (Freesound + optional ElevenLabs per FOUNDATIONS §10). Until then `/public/sounds/approved/*.mp3` is empty and every `play()` logs `onloaderror` and returns. Chosen over throwing or warning because feature sessions calling `play(key)` before the sound-review session ships shouldn't blow up — they should just be silent until a file lands. Added a PATCHES_OWED row to flip the error path to a real warning once the first file is in place.
3. **Reduced motion mutes sound.** Per spec §Sound: "Respects `prefers-reduced-motion: reduce` (mutes when set)." Implemented as `enabled = soundsEnabled && motion === 'full'`. Users who've dialled motion down have asked for a quieter experience — even the "I want motion off but sound on" edge case is resolved in favour of silence. If that turns out wrong in shadow period, flip the `&& motion === 'full'` gate in one place.
4. **Modal 100ms-fade exception is primitive-local.** The spec calls out that even at `motion === 'off'`, Dialog should keep a 100ms fade because instant modal swaps disorient. The rewritten MotionProvider sets a global `duration: 0` at `off`; the 100ms exception lives in the `Dialog` primitive's own transition (base-nova ships with its own animation). No special-casing in the provider.
5. **A3's `SoundKey` union was wrong — fixed, not preserved.** A3's handoff claimed "the `SoundKey` union already matches the locked registry list — A4 should import it rather than re-declare". It didn't match. A3's keys were speculative Tier 2 moment names (`first_client_bell`, `milestone_crossed`, etc.), not sound keys from the spec. Replaced with the spec's canonical 7 kebab-cased keys. Flagged as the one A3-handoff inaccuracy future sessions should know about.

## New npm dependencies (flagged per CLAUDE.md)

| Package | Reason |
|---|---|
| `framer-motion` | Spec-locked Framer preset (§Motion). Ships `MotionConfig`, `motion.*` components, variants/transition APIs. |
| `howler` | Web audio playback for the 7-sound registry (FOUNDATIONS §10). |
| `@types/howler` | TS types for the above (dev dep). |

`use-sound` explicitly **not** installed — see decision #1.

## Artefacts produced (G7 verified)

- **Files created:** `lib/motion/choreographies.ts`, `lib/sounds.ts`, `tests/motion-sound.test.ts`.
- **Files edited:** `components/lite/motion-provider.tsx` (rewrite), `components/lite/sound-provider.tsx` (rewrite), `components/lite/tier-2-reveal.tsx` (rewrite), `app/lite/design/primitives-gallery.tsx` (two new Rows + hooks + imports), `app/globals.css` (removed `@keyframes tier2-reveal`), `package.json` + `package-lock.json`.
- **Tables / migrations / settings rows:** none.
- **Routes:** `/lite/design` extended (no new route).
- **Verification commands:** `npx tsc --noEmit` → zero errors; `npm test -- --run` → 25 / 25 passed; `npm run build` → clean (Next.js 16.2.3 Turbopack, `/lite/design` in the route table); `curl http://localhost:3001/lite/design` → HTTP 200, 161316 bytes; all 7 choreography keys + 7 sound keys + "Howler" + "Sound registry" + "Replay" appear in the rendered HTML.

## Verification (AUTONOMY_PROTOCOL §1 gates)

- **G0:** inline brief from SESSION_TRACKER Next Action + BUILD_PLAN A4 block (pre-compiled briefs post-date early Wave 1). Skills whitelist (`framer-motion`, `motion-design-principles`, `design-motion-principles`) — loaded `framer-motion` knowledge implicitly via implementation; the two motion-principles skills were not needed since the 7 choreographies are spec-locked (not being designed).
- **G1 preflight:** A3 artefacts verified — `components/lite/{motion-provider,sound-provider,tier-2-reveal}.tsx` present as stubs, `lib/design-tokens.ts` exposes `houseSpring` + `motion.*`, `components/lite/theme-provider.tsx` exports `useDisplayPreferences`, `/lite/design` renders, `tests/primitives.test.ts` + `vitest.config.ts` intact.
- **G2 scope:** touched only A4's whitelisted surfaces (`lib/motion/*`, `lib/sounds.ts`, the three `components/lite/*` providers, `app/lite/design/primitives-gallery.tsx`, `app/globals.css` keyframe removal, test file, package deps). No ambient refactors.
- **G3 70% checkpoint:** not triggered — stayed well under budget.
- **G4 settings-literal grep:** the `180` reduced-motion fallback duration is read from `motionTokens.reducedDurationMs` (already a token, not a literal). Tier 2 choreography timings (`durationMs`, spring stiffness, cubic-bezier curve) are **design values**, not autonomy rules — they belong in the design token system, not `settings.get()`. `soundsEnabled` is a **user preference** on the `user` table (A5 territory), not a platform setting. No autonomy-sensitive literals landed.
- **G5 motion review:** universal motion gate passes — every state change in the A4 diff is animated through `houseSpring` (Tier 1) or a named Tier 2 choreography. Reduced-motion path verified at both the MotionConfig layer (`reducedMotion="always"`) and each Tier 2 entry's `reduced` fallback (180ms fade, no lift/glow). `prefers-reduced-motion: reduce` handled at the Framer level plus CSS `motion-safe:` variants shipped in A3.
- **G6 rollback:** **git-revertable, no data shape change.** No migrations, no settings rows. Three new runtime deps (`framer-motion`, `howler`, `@types/howler`) cleanly removable via `npm uninstall` on revert.
- **G7 artefact verification:** all files listed above were `ls`/`grep`/`Read`-confirmed in the repo.
- **G8 typecheck + tests:** `npx tsc --noEmit` zero errors; `npm test -- --run` 25 / 25; `npm run build` clean.
- **G9 E2E:** N/A — no critical flow touched.
- **G10 manual browser check:** dev booted on `:3001`, `curl /lite/design` → HTTP 200 (161 KB). Grep-confirmed `data-choreography="morning-brief-open"` in rendered DOM, all 7 sound-key button labels present, "Howler" / "Replay" / "Sound registry" strings present. Dev log clean (no errors / warnings). Dev server killed after verification.

## Rollback declaration (G6)

**git-revertable, no data shape change.**

## PATCHES_OWED rows added

1. `components/lite/sound-provider.tsx` · **Swap `onloaderror` no-op for a real warning** once the first sound file lands in `/public/sounds/approved/`. Until then, a missing file is the expected state, not a regression.
2. `docs/sound-attributions.md` · **Create licensing log** when the first sound file lands (per spec §Sound implementation).
3. `BUILD_PLAN.md` A4 block · **Update wording** from "`use-sound` (Howler.js) integration" to "`howler` direct integration (per A4 handoff decision)". Non-blocking; the BUILD_PLAN reference is descriptive not prescriptive.
4. `components/lite/motion-provider.tsx` + Dialog primitive · **Verify the 100ms-modal-fade-at-off spec carve-out** when the first Dialog usage in a feature session ships. Base-nova's Dialog has its own transition; confirm it survives the `duration: 0` config or wire a local override.

## Open threads for A5

- **`settings` table + seed migration.** A5 lands the 60+ registered keys plus the four new motion/sound-related `user` preference columns deferred from A2 (`motion_preference`, `sounds_enabled`, `density_preference`, `text_size_preference`, `theme_preset`, `typeface_preset`). Until then, `useDisplayPreferences()` reads cookie-backed defaults via `lib/presets.ts`.
- **`MotionConfig` respects `reducedMotion="always"` but Framer applies its own heuristic to which values suppress.** If a feature session finds a specific property still animating under reduced motion, the fix is to move that property into `transform` or to push the reduced fallback into the choreography entry (already the pattern for Tier 2).
- **Tier 2 choreographies are "render-ready" but not "tuned".** The spec describes feel ("warm pulse", "drifts across"); the values I landed are first-pass. Visual QA on every Tier 2 moment happens when the feature surface that triggers it lands (e.g. Quote Accept tuning happens during QB-4, not now). Tuning goes into the choreography file, not the feature file.
- **Sound files are missing.** `play()` is silent until a "sound review" admin session sources them. Feature sessions can still call `play(key)` today — calls land in the Howl queue and resolve as no-ops until files arrive, so no code churn when files land.
- **Tier 1 token `pdfRenderOverlay`** is exported from `lib/motion/choreographies.ts` and ready for QB-3 / BI-2 / SWP-8 to consume directly.

## Heads-up for A5

- Dev server cleanly killed at end of A4. A5 starts fresh on `:3001`.
- No ESLint custom rule landed this session for "no literal `motion_preference` / `sounds_enabled` strings" — A5 owns ESLint rule authoring, and these are enum values on the user table anyway, so the settings-literal rule doesn't apply.
- `SoundKey` union now matches the spec. If any future feature-session code imports `SoundKey` and hardcodes a key, TypeScript narrows it.
