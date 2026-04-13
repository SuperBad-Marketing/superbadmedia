# A3 — Design System Primitives — Handoff

**Date:** 2026-04-14
**Phase:** 5 · **Wave:** 1 (Foundation A) · **Session:** A3
**Type:** UI · **Model tier used:** Sonnet (`/normal`) — matches brief.
**Specs consulted:** `docs/specs/design-system-baseline.md` (Component primitive inventory + Build-time disciplines + §accessibility), `BUILD_PLAN.md` Wave 1 A3, `AUTONOMY_PROTOCOL.md` (all G-gates).
**Outcome:** **35 primitives in `components/ui/` + 8 custom Lite wrappers in `components/lite/` + `/lite/design` extended with a primitives gallery and a 6-axis accessibility panel.** Typecheck clean, `npm test` green (17 tests across 2 files), `npm run build` clean, dev `/lite/design` HTTP 200.

---

## What was built

### Primitives scaffolded via `npx shadcn add` (base-nova style, Base UI runtime)

Form / surface / navigation / feedback / data / command / date groups — 32 shadcn-generated files plus two that base-nova doesn't ship from the registry (built by hand):

- **`components/ui/form.tsx`** — react-hook-form integration layered on base-nova's `Field` family (`FieldLabel`, `FieldError`, `FieldDescription`). Exports `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`. Includes a minimal local `Slot` (cloneElement-based) to avoid pulling `@radix-ui/react-slot` just for this composition.
- **`components/ui/date-picker.tsx`** — Popover + Button + Calendar composition (base-nova doesn't register a standalone DatePicker). Uses Base UI's `PopoverTrigger render={…}` composition and `date-fns`' `format` for the button label.

Plus `components/ui/field.tsx` + `components/ui/input-group.tsx` were pulled as dependencies during the install pass (`field` is base-nova's reusable Form-field skeleton; `input-group` was dragged in via `field`).

### Custom Lite wrappers (`components/lite/`)

All eight named in the spec's "Custom Lite primitives" table, each with a JSDoc listing its consumed tokens per spec rule 11:

| File | Purpose | Notes |
|---|---|---|
| `theme-provider.tsx` | React context carrying resolved `DisplayPreferences` (theme, typeface, motion, density, text size, sounds) | Server reads cookies via `lib/presets.ts`; A5 switches to `user` table values |
| `motion-provider.tsx` | Applies `data-motion` attribute to subtree; CSS + `motion-safe:` Tailwind variants honour it | A4 layers Framer `MotionConfig` on top |
| `sound-provider.tsx` | `useSound()` hook with a no-op `play(key)` stub and locked `SoundKey` union of the 7 registry keys | A4 wires `use-sound` + real registry |
| `admin-shell.tsx` | Sidebar + main grid per Q9; respects page-level `[data-density="compact"]` to narrow the sidebar 240→200 | No nav items yet — per-feature sessions own sidebar content |
| `brand-hero.tsx` | `location: BhsLocation` prop (typed against the closed list); renders the only `h1/h2` allowed to use Black Han Sans | Build-time enforcement of spec rule 2 |
| `skeleton-tile.tsx` | Surface-tinted shimmer tile; `motion-safe:` gate degrades cleanly under `prefers-reduced-motion: reduce` | Pairs with the shadcn `Skeleton` |
| `empty-state.tsx` | BHS hero + italic narrative message + optional CTA slot; `location="empty_state_hero"` is locked | Copy banks at `lib/copy/empty-states.ts` owed when features start landing |
| `tier-2-reveal.tsx` | CSS-based fade + lift entrance; degrades under reduced-motion and explicit `data-motion="off"` | A4 replaces with the Framer Motion choreography registry |

### `/lite/design` extensions

- **`app/lite/design/primitives-gallery.tsx`** (client component) — one row per primitive cluster: buttons, form inputs, toggles + radios, Card/Badge/Avatar, Dialog/Popover/Tooltip, Accordion/Tabs, Separator + Progress + Skeleton (both `Skeleton` and `SkeletonTile`), Table, DatePicker, Toast (Sonner), BrandHero, Tier2Reveal, EmptyState.
- **`app/lite/design/a11y-panel.tsx`** (client component) — 6 toggleable data-attribute axes (motion, sounds, text-size, density, contrast, focus) + a 7th keyboard-walk button that focuses the first focusable element. Covers the 10-axis spec via direct toggles (6), documented axes (keyboard, screen-reader labels, aria-live toast) and an OS-level axis (`prefers-reduced-motion: reduce` — verified in browser DevTools).

### Layout wiring

- `app/layout.tsx` now wraps `{children}` in `ThemeProvider → MotionProvider → SoundProvider` and mounts `<Toaster />` (sonner) so `toast()` calls from anywhere render into an `aria-live` region for free.
- `ThemeProvider` receives server-resolved `{ theme, typeface }` from `getActivePresets()`; other preference axes default until A5+A8 land user-table reads.

### CSS additions (`app/globals.css`)

- `@keyframes shimmer` (SkeletonTile) + `@keyframes tier2-reveal` (Tier2Reveal). Both are declared outside `@layer base` so Tailwind's arbitrary-value animate utilities can reference them.
- `[data-text-size="large"]` override (body 16→18, small 14→16) — feeds Q7 accessibility toggle without touching the typography token.
- `[data-density="compact"]` override (space-5 16→16, space-6 32→24) — enables per-page compact pages before a user-level density preference exists.

### Test harness

- **`tests/primitives.test.ts`** — 11 tests asserting every spec-locked primitive + every A3 wrapper is importable from the expected path. Catches rename / delete regressions before they hit feature sessions.
- `vitest.config.ts` — raised `testTimeout` to 30s. Cold-starting Next.js's Turbopack pipeline for 30 module imports exceeds Vitest's default 5s ceiling; 30s leaves comfortable headroom.

## Key decisions locked in-session (technical calls, no Andy question)

Per memory `feedback_technical_decisions_claude_calls`.

1. **Kept `base-nova` + Base UI, not Radix.** A1 scaffolded with `base-nova` (Base UI runtime). `npx shadcn add` pulled 32 Base-UI-flavoured primitives cleanly. Swapping to Radix mid-foundation would be a breaking rework for zero product value.
2. **`Form` primitive hand-rolled on `Field` family.** Vanilla shadcn `Form` expects Radix `Slot` + its form primitives; base-nova ships `Field*` instead. Built a lean `Form` that pairs `react-hook-form`'s `FormProvider` + `Controller` with base-nova's `Field` components, plus a 20-line local `Slot` (cloneElement) so we don't install `@radix-ui/react-slot` as a second primitive library.
3. **`DatePicker` composed, not primitive.** base-nova's registry 404s on `date-picker`. Shadcn's docs themselves compose it from Calendar + Popover + Button — implemented that way as a first-class `components/ui/date-picker.tsx` so feature code imports it identically to any other primitive.
4. **`MotionProvider` / `SoundProvider` / `Tier2Reveal` ship as stubs.** A4 owns the registries. Shipping context-shells now (with typed keys + locked `SoundKey` union) lets feature-spec surfaces in Waves 5+ call `play(key)` without circular A4 blocking; A4 swaps implementations under the same APIs.
5. **No Framer Motion installed in A3.** Every primitive transition ships through Base UI's built-in animations or CSS keyframes + `motion-safe:` Tailwind variants. A4 introduces `motion` (or `framer-motion`) when it lands `houseSpring` as a Framer preset for the Tier 2 registry.
6. **Accordion — no `type`/`collapsible` prop.** Base UI's Accordion diverges from Radix; doesn't take those flags. Gallery uses the default (multi-expand) behaviour. Feature specs that want single-expand can manage it via controlled state.

## New npm dependencies (flagged per CLAUDE.md)

| Package | Reason |
|---|---|
| `react-hook-form` | Spec-locked `Form` primitive (design-system-baseline §component inventory: "`Form` (react-hook-form integration)"). |
| `@hookform/resolvers` | Standard companion for `zod`-validated rhf forms; feature specs will rely on it. |
| `sonner` | Spec-locked `Toast` (shadcn uses Sonner under the hood; installed via `npx shadcn add sonner`). |
| `cmdk` | Spec-locked `Command` primitive. |
| `react-day-picker` + `date-fns` | Spec-locked `Calendar` + `DatePicker`. |
| `vaul` | Spec-locked `Drawer`. |
| `next-themes` | Pulled by `npx shadcn add sonner`; not actively used — our dark-only setup sets the `dark` class at the root via `getActivePresets()`. Kept for zero-risk removal later if we audit dep weight. |

## Artefacts produced (G7 verified)

- **Files created** — 32 primitives via `npx shadcn add` (listed above), plus `components/ui/form.tsx`, `components/ui/date-picker.tsx`, `components/lite/{admin-shell,brand-hero,empty-state,motion-provider,skeleton-tile,sound-provider,theme-provider,tier-2-reveal}.tsx`, `app/lite/design/primitives-gallery.tsx`, `app/lite/design/a11y-panel.tsx`, `tests/primitives.test.ts`.
- **Files edited** — `app/globals.css` (keyframes + text-size + density overrides), `app/layout.tsx` (provider stack + Toaster), `app/lite/design/page.tsx` (two new Sections), `vitest.config.ts` (raised testTimeout), `package.json` + `package-lock.json` (deps).
- **Tables** — none.
- **Migrations** — none.
- **Settings rows** — none.
- **Routes** — `/lite/design` extended (no new route).
- **Scripts** — `npm test` → 17 / 17 passed; `npx tsc --noEmit` → 0 errors; `npm run build` → clean, `/lite/design` in the route table.

## Verification

- **G0 session kickoff:** brief contents inlined from `SESSION_TRACKER.md` Next Action + BUILD_PLAN A3 block (no pre-compiled brief file yet — A3 pre-dates the brief compilation workflow).
- **G1 preflight:** A2 artefacts verified — `app/globals.css` full SuperBad token set present, `lib/design-tokens.ts` exports match, `lib/fonts.ts` + `lib/presets.ts` present, `/lite/design` renders 200, `tests/tokens.test.ts` + `vitest.config.ts` intact, Vitest script in `package.json`.
- **G2 scope:** touched only A3's whitelisted surfaces (`components/ui/`, `components/lite/`, `app/lite/design/`, layout wiring, globals.css additions, test file, vitest.config). No ambient refactors.
- **G3 70% checkpoint:** not triggered — stayed under budget.
- **G4 settings-literal grep:** N/A — no autonomy-sensitive rules touched (design-system timing literals are token values, not autonomy knobs).
- **G5 motion review:** every state change in the diff is animated:
  - Base UI primitives (Dialog / Popover / Tooltip / Accordion / Tabs / DropdownMenu / etc.) ship with their own spring transitions via base-nova.
  - `SkeletonTile` shimmer + `Tier2Reveal` entrance use CSS keyframes gated by `motion-safe:` Tailwind variants — degrade cleanly under `prefers-reduced-motion: reduce` and under explicit `data-motion="off"`.
  - Toast (Sonner) ships with its own reduced-motion parity.
- **G6 rollback:** **git-revertable, no data shape change.** No migrations, no settings rows.
- **G7 artefact verification:** see above.
- **G8 typecheck + tests:** `npx tsc --noEmit` clean; `npm test` 17 / 17 green; `npm run build` clean.
- **G9 E2E:** N/A (no critical flow touched).
- **G10 manual browser check:** dev server booted; `curl http://localhost:3001/lite/design` → HTTP 200 (148 KB); `curl http://localhost:3001/` → HTTP 200. Dev log shows zero warnings / errors. Gallery + a11y panel both render in the response HTML (server-rendered + hydration targets present).

## Open threads for A4

- **MotionProvider is a CSS-only shim.** A4 layers Framer Motion's `MotionConfig` + the seven locked Tier 2 choreographies on top. Subtree selector pattern (`[data-motion="off"] &`) stays — Framer reads the config prop, CSS/attribute keeps the overrides honest.
- **`Tier2Reveal` will move off CSS keyframes.** A4 replaces with the named choreography registry; the component name/API stays stable so feature code doesn't churn.
- **`SoundProvider.play()` is a no-op.** A4 wires `use-sound` + Howler + the 7-item registry at `lib/sounds.ts`. The `SoundKey` union in `components/lite/sound-provider.tsx` already matches the locked registry list — A4 should import it rather than re-declare.
- **Density + text-size preferences are page-level attributes, not user-table reads.** A5 adds the `user` columns; A8 + the post-A8 Settings → Display session wire the attributes from the session user. Until then, `/lite/design` toggles them transiently from the a11y panel.
- **`next-themes` is dead weight.** Dropped by `npx shadcn add sonner`. If anyone audits dep bloat before launch, `next-themes` can be removed without effect.
- **A4 may install `motion` / `framer-motion`.** Spec-locked for Tier 1 `houseSpring` + Tier 2 choreographies. Flag in A4's handoff.

## Rollback declaration (G6)

**git-revertable, no data shape change.**

## PATCHES_OWED rows (added)

1. `components/ui/form.tsx` · **Replace the local `Slot` with a library `Slot`** once a primitive session needs richer composition semantics (e.g. Radix-style `asChild` ref forwarding across complex children). Non-blocking; every consumer today passes a single element child.
2. `package.json` · **Audit `next-themes` removal.** Unused; pulled transitively. Candidate for deletion during `LAUNCH_READY` dep audit.
3. `lib/copy/empty-states.ts` · **Create empty-state copy bank** once feature sessions start calling `EmptyState`. Spec rule 12 (voice is part of the design system) requires bank-sourced copy; A3 accepts inline strings only because no feature surface consumes `EmptyState` yet.

## Heads-up for A4

- **Dev server left running on `:3001`** (consistent with A2's precedent). Inherit or kill.
- **`Toaster` is already mounted** at the root layout; A4 can fire toasts from its motion-registry demo without wiring providers.
- **CSS keyframes `shimmer` + `tier2-reveal` live in `app/globals.css`.** A4 may drop `tier2-reveal` when the Framer choreography registry lands — SkeletonTile keeps `shimmer`.
- **No new tables / migrations / settings keys produced.** A4 remains CSS + TS only; A5 is still the first infra-touching session.
