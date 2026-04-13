# A2 — Design System Tokens + Theme/Typeface Presets — Handoff

**Date:** 2026-04-13
**Phase:** 5 · **Wave:** 1 (Foundation A) · **Session:** A2
**Type:** UI · **Model tier used:** Opus (`/deep`) — session shipped while on Opus; BUILD_PLAN prescribed Sonnet. Noted so the loop can re-tier A3 to Sonnet as planned without perceived regression.
**Specs consulted:** `docs/specs/design-system-baseline.md` (full), `FOUNDATIONS.md` §9 (visual design system) + §10 (sound) + §11.6 (LLM registry — not touched, read for context).
**Outcome:** **Full SuperBad token set live in `app/globals.css` + typed mirror at `lib/design-tokens.ts` + 3 theme presets + 3 typeface presets + `/lite/design` reference route + Vitest harness + token-parity smoke test.** Typecheck green, `npm test` green (6 tests), `npm run build` green.

---

## What was built

- **`app/globals.css`** — full rewrite. Shadcn's grey neutral OKLCH palette replaced with SuperBad warm-neutral scale (8 steps), brand tokens (red/cream/pink/orange/charcoal), surface tiers (`surface-0/1/2/3`), semantic tokens (`success/warning/error/info`), accent CTA + focus ring vars, full spacing scale, three purpose-mapped radii (`tight/default/generous`), 8-size type scale, motion constants (Tier 1 + Tier 2 timings), plus shadcn-compatibility shims so `components/ui/button.tsx` (shadcn-default) still renders on-brand without edits. Dark-only: everything lives on `:root`, no light variant.
- **Theme presets** — `theme-late-shift` + `theme-quiet-hours` implemented as `<html>` class overrides (standard = no class). Exact override values from the spec's §Theme presets block.
- **Typeface presets** — `typeface-long-read` + `typeface-dispatch` swap body + narrative faces via CSS class overrides (house = no class). Brand spine (Display/Label/Logo) never swaps.
- **`@theme inline` mapping** — every SuperBad token exposed to Tailwind v4 utility classes (`bg-surface-0`, `text-neutral-100`, `bg-accent-cta`, `border-neutral-600`, etc.), plus full shadcn compatibility shims so existing primitives keep working.
- **`lib/design-tokens.ts`** — typed TS mirror: `brand`, `neutral`, `surface`, `semantic`, `space`, `radius`, `typography`, `motion` (incl. `houseSpring` Framer preset), three preset axes with `THEME_PRESETS` / `TYPEFACE_PRESETS` / `DEFAULT_*` exports, closed-list type unions for BHS locations + generous-radius surfaces, enum shells for the six user preferences (columns + UI land in later sessions — see PATCHES_OWED).
- **`lib/fonts.ts`** — all nine Google-hosted faces instantiated with `next/font/google`, CSS variables exposed (`--font-dm-sans`, `--font-playfair-display`, `--font-plus-jakarta-sans`, `--font-cormorant-garamond`, `--font-outfit`, `--font-dm-serif-display`, `--font-black-han-sans`, `--font-righteous`, `--font-pacifico`). All nine variables attached to `<html>` via `allFontVariables`. (Dispatch's General Sans isn't on Google Fonts — Outfit used as on-brand substitute; tracked in PATCHES_OWED.)
- **`lib/presets.ts`** — server-side `getActivePresets()` reads `sb_theme_preset` + `sb_typeface_preset` cookies, validates against the preset lists, returns the `<html>` class string (`dark` + optional preset classes). Cookie names stable so they can later coexist as the logged-out fallback once per-user prefs land.
- **`app/layout.tsx`** — attaches every font variable + the active preset classes to `<html>` each request. Metadata still `"SuperBad"` (no "Lite" on customer-facing surfaces per `feedback_no_lite_on_client_facing`).
- **`app/page.tsx`** — root placeholder reskinned onto the token set (display face heading, narrative-italic byline, pink link to the design route).
- **`app/lite/design/page.tsx` + `actions.ts`** — internal reference route covering: active preset readout, click-to-flip preset forms (server actions write cookies + `revalidatePath`), neutral scale swatches, brand palette swatches, semantic swatches, surface-tier tiles (with inner-highlight preview), every type-role sample at its real size + family, spacing-scale visualisation (pink bars), radius tiles, motion-constant summary, focus-ring preview, active-preset typography sample. `robots: noindex,nofollow`. Admin gate is a stub — A8 wires the real role check (tracked in PATCHES_OWED).
- **Vitest harness** — `vitest.config.ts`, `test` + `test:watch` scripts in `package.json`, `@/` alias wired. **`tests/tokens.test.ts`** parses `:root` from `globals.css` and asserts every neutral, brand, semantic, spacing, radius, and type-scale value matches `lib/design-tokens.ts`. A spec-violating drift now fails `npm test` loudly. Closes the A1 PATCHES_OWED row for "first real assertion" and satisfies the Token storage discipline (`design-system-baseline.md` §Token storage: "a typecheck-time guard (a unit test that asserts all three are aligned)").

## Scope call locked in-session (BUILD_PLAN divergence)

BUILD_PLAN A2 `Owns` block claimed A2 ships:
1. Six user-preference columns on the `user` table, and
2. A Settings → Display UI.

Neither was buildable in A2's position:
- Drizzle + SQLite + migration tooling belong to A5 (the session that owns the `settings` table). A2 can't create a `user`-table migration before that infrastructure exists.
- Per-user preferences require auth; NextAuth + the portal-guard middleware land in A8.
- The UI needs A3 primitives (Button, Switch, RadioGroup, Form) to render cleanly.

**Decision (technical, no Andy question per `feedback_technical_decisions_claude_calls`):** scope A2 to the CSS + TS token set + presets + `/lite/design` route + Vitest, and roll the two blocked items forward. PATCHES_OWED rows added for **A5** (user-preference columns) and a **post-A8 UI session** (Settings → Display panel). BUILD_PLAN will see both at the Wave-2 housekeeping pass. Zero runtime impact — `/lite/design` already exercises every preset via cookies, and `lib/design-tokens.ts` exports the enum + default shells so consumers can speak the types today.

## Second divergence: `/lite/_design` → `/lite/design`

Next.js App Router treats `_foo` folders as **private** (excluded from routing, 404). Verified empirically — `/lite/_design` returned 404 while `/lite/design` returned 200. Dropped the underscore in code; BUILD_PLAN §R + the A2 `Owns` block owe a one-character edit. Tracked in PATCHES_OWED.

## Artefacts produced (G7 verified)

- **Files created:** `lib/design-tokens.ts`, `lib/fonts.ts`, `lib/presets.ts`, `app/lite/design/page.tsx`, `app/lite/design/actions.ts`, `vitest.config.ts`, `tests/tokens.test.ts`.
- **Files edited:** `app/globals.css` (full rewrite), `app/layout.tsx`, `app/page.tsx`, `package.json` (`test` + `test:watch` scripts, Vitest devDeps).
- **Routes added:** `/lite/design` — verified via `curl http://localhost:3001/lite/design` → HTTP 200; cookie-driven preset toggling verified via `curl -b "sb_theme_preset=late-shift; sb_typeface_preset=dispatch"` → `theme-late-shift` + `typeface-dispatch` classes both present on `<html>`.
- **Build output:** `npm run build` lists `/lite/design` in the App Router route table alongside `/` and `/_not-found`.
- **Tables:** none (deferred — see scope call).
- **Migrations:** none.
- **Settings rows:** none (A5 seeds).
- **Scripts:** `npm test` → 6 passed / 0 failed; `npm run typecheck` → zero errors; `npm run build` → clean.

## Verification

- **G1 preflight:** A1 handoff preconditions verified — Next.js 16.2.3 scaffold present, Tailwind v4 + shadcn + `tw-animate-css` imports intact, dev on `:3001`, env validator via `instrumentation.ts` still firing.
- **G2 scope:** touched only A2's whitelisted surfaces (CSS + lib + `/lite/design` + layout/root placeholder + test harness). No ambient refactors.
- **G3 70% checkpoint:** not triggered — session stayed well under budget.
- **G4 settings-literal grep:** not applicable to A2's scope (no autonomy rules touched). The new CSS has literal pixel values for spacing/type/radius but those are token *definitions*, not autonomy knobs; the settings-registry is deliberately empty of design values.
- **G5 motion review:** not applicable — no state changes shipped. Motion constants declared but the first animated surface is A3/A4's problem. Reduced-motion parity will be verified per-primitive in A3 and per-choreography in A4.
- **G6 rollback:** **git-revertable, no data shape change.** No migrations, no settings rows, no external state. Rollback = `git revert` + `rm -rf node_modules .next && npm install` (to reset the Vitest devDeps).
- **G7 artefact verification:** see above.
- **G8 typecheck + tests:** `npx tsc --noEmit` clean, `npm test` green (6 tests), `npm run build` clean.
- **G9 E2E:** not applicable — no critical flow touched.
- **G10 manual browser walk:** dev server restarted (A1 instance was lingering on `:3001`), `curl http://localhost:3001/` → HTTP 200 with tokenised root placeholder, `curl http://localhost:3001/lite/design` → HTTP 200 with every section rendered, cookie-driven preset toggle verified as above. Font preloads confirmed in response headers — all nine font bundles prefetched.

## Open threads for A3

- **`components/ui/button.tsx` restyle vs regenerate.** A1's shadcn-default button will pick up the new tokens automatically (because the compatibility shims map `--primary` → `--accent-cta` etc.) but it hasn't been visually inspected against the brand yet. A3 either keeps-and-trusts or regenerates. Either way, A3 owns the call.
- **14 shadcn primitives to copy in.** Per A3 `Builds` line: Button, Input, Label, Textarea, Select, Checkbox, Switch, RadioGroup, Form, Card, Dialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, ContextMenu, HoverCard, AlertDialog, Tabs, Accordion, Collapsible, Separator, ScrollArea, Toast, Avatar, Badge, Skeleton, Progress, Table, Command, Calendar, DatePicker. Start with the spec's Form/Surface/Feedback clusters; Data + Calendar can follow.
- **Custom wrappers (A3 inherits full list):** `AdminShell`, `BrandHero`, `SkeletonTile`, `EmptyState`, `Tier2Reveal`, `ThemeProvider`, `MotionProvider`, `SoundProvider`. Per-primitive tokens-in-JSDoc discipline (spec §Build-time disciplines rule 11) starts here.
- **Accessibility variants** — spec requires 10 variants verified (reduced-motion, sounds-off, large-text, compact, contrast, keyboard, focus-visible, screen-reader labels, aria-live for toasts, `prefers-reduced-motion: reduce` parity). A3 owns the accessibility pass; `/lite/design` can be extended into the verification surface as each primitive lands.
- **Density preset mechanism.** A2 deferred density — it's a page-level class pattern (`density-comfort` / `density-air` / `density-compact`), not a token override. A3 introduces the wrapper primitive that reads `user.density_preference` once A5 lands the column; until then, density is hard-coded per page.
- **Font bundle weight.** Every page currently preloads 11–12 font files (see `curl -I /` Link header). Fine for dev, worth an optimisation pass before launch — tracked in PATCHES_OWED.

## Rollback declaration (G6)

**git-revertable, no data shape change.**

## PATCHES_OWED rows added (5 new + 1 closed)

**Closed** (applied by A2):
- ~~Vitest harness + first smoke test (A1 follow-up)~~ — Vitest installed, `tests/tokens.test.ts` wired.

**Added**:
1. `docs/specs/design-system-baseline.md` + A5 Drizzle schema · **6 user-preference columns + `first_signed_in_at`** moved from A2 to A5 (infra preconditions).
2. `app/lite/settings/display/*` · **Settings → Display UI** deferred to a post-A8 session (needs auth + A3 primitives).
3. `BUILD_PLAN.md` §R + A2 block · **`/lite/_design` → `/lite/design`** (Next.js private-folder convention).
4. `lib/fonts.ts` · **Lazy-load alternate typeface bundles per cookie** (v1 loads all three; optimise post-launch).
5. `lib/fonts.ts` · **Swap Outfit for Fontshare-hosted General Sans** on the Dispatch preset (Google Fonts substitute used for v1).
6. `app/lite/design/*` · **Wire real admin gate in front of `/lite/design`** when A8 ships.

Plus the A1 `public/*.svg` row updated — A2 explicitly declined to swap the favicon/logo set (out of scope for a token baseline; belongs to the marketing-site spec or the `LAUNCH_READY` sweep). Row rolled forward.

## Heads-up for A3

- **Dev server was already running on `:3001`** during A2's manual walk (lingered from an aborted A1 smoke test). A3 should `lsof -ti:3001 | xargs kill -9` or trust the existing instance — the hot-reload will pick up new files as they land.
- **Opus tier was used for A2** despite BUILD_PLAN's Sonnet prescription. No tangible cost impact but worth noting so A3 doesn't re-tier above spec.
- **All nine fonts load on every request.** If A3's primitives want to test fonts switching under reduced-motion / large-text / alt-preset permutations, the bundle is already paid for — no additional imports needed.
