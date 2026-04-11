# Phase 3 Handoff — Design System Baseline (Session 1)

**Date:** 2026-04-11
**Session type:** Phase 3 spec brainstorm (first of N)
**Output:** `docs/specs/design-system-baseline.md`
**Next session:** Phase 3 — Sales Pipeline spec

---

## What was decided

Cross-cutting design system reference doc that every later Phase 3 feature spec and every Phase 5 build session points at when describing UI, motion, sound, or brand-load-bearing aesthetic choices. Sits on top of the canonical `superbad-visual-identity` skill and `FOUNDATIONS.md §9–§10`.

**13 brainstorm questions resolved (Q1–Q13).** Highlights:

1. **Surface strategy (Q1)** — stacked warm tints with soft inner highlights, no shadows. Surfaces differentiate by slightly lighter charcoal tints + a near-invisible warm cream inner highlight catching light from above.
2. **Motion (Q2 + Q3)** — two-tier system. Tier 1 = single house spring (`mass:1, stiffness:220, damping:25`, ~280ms with whisker overshoot) used everywhere by default. Tier 2 = closed list of 7 choreographed arrival moments + 2 conditional overlays (revenue milestone, first-ever sign-in). Tier 2 list locked, additions require explicit Andy approval.
3. **Density (Q4)** — two presets, page-level not component-level: `density-comfort` for admin work surfaces, `density-air` for brand/customer surfaces. Settings → Display panel adds a `density-compact` admin-only override.
4. **Corner radius (Q5)** — graduated soft scale: 4px tight (interactive bits) / 8px default (everything elevated) / 16px generous. The 16px value is reserved for a closed list of 4 brand-moment surfaces.
5. **Black Han Sans deployment (Q6)** — closed list of 8 locations only. Anywhere else uses DM Sans semibold for headings. Same scarcity discipline as red CTAs and Tier 2 motion.
6. **Settings → Display panel (Q7)** — locked at 6 user-facing controls: 4 accessibility toggles (sounds, motion, density admin-only, text size) + 2 curated preset axes (theme, typeface). Per-role visibility table locked.
7. **Theme presets (Q7)** — 3 hand-tuned brand-canonical variants: **Standard** (default, brand at its loudest), **Late Shift** (warmer/redder, pink-as-CTA, eye-fatigue-friendly), **Quiet Hours** (desaturated, cream-forward, focus mode). Same dark mode, same brand spine.
8. **Typeface presets (Q8)** — 3 hand-tuned variants swapping body + narrative faces only (display, label, logo never altered): **House** (DM Sans + Playfair italic, default), **Long Read** (Plus Jakarta Sans + Cormorant Garamond italic), **Dispatch** (General Sans + DM Serif Display italic). Theme × typeface independent — 9 valid combinations all on-brand by construction.
9. **Admin shell (Q9, locked-by-me)** — persistent left sidebar (~240px) + main content. No auto-collapse. Pacifico wordmark top, primary nav middle, profile bottom. No top bar. Mouse-first, desktop-first. Per-page secondary panes are per-spec decisions.
10. **Pink's semantic job (Q10, locked-by-me)** — customer-warmth accent. Lives on customer-facing surfaces (client portal welcome, SaaS dashboard hero, first-ever-login overlay, customer email templates) AND as the universal 2px focus ring across the entire app. Almost never appears in admin daily-use chrome.
11. **Iconography (Q11, locked-by-me)** — Lucide outline only, three sizes (16/20/24), used sparingly for nav + actions + status. Never decorative, never replacing labels.
12. **Form patterns (Q12, locked-by-me)** — labels above inputs, helper text below, error state in red, required field marker is a 6px red dot, single-column default, multi-step always goes through wizard pattern.
13. **Focus + interaction states (Q13, locked-by-me)** — 2px pink focus ring with 2px offset gap (pink works because it's absent everywhere else in admin chrome). Hover = +6% surface lighten. Active = -4% darken + 1px inward shift. Disabled = 40% opacity, no colour change.

**Token values locked in the spec:**
- Brand tokens (5 hex from FOUNDATIONS, never altered)
- Extended warm-neutral scale (8 steps, all warm-biased, never bluish)
- Semantic tokens (success=warm sage, warning=retro orange, error=brand red, info=neutral)
- Type size scale (8 sizes including narrative italic)
- Spacing scale (8 named tokens, Tailwind 4px base)
- Surface tint mappings to neutral scale steps
- Inner highlight box-shadow value
- House spring values

**Sound registry character details locked** for all 7 FOUNDATIONS sounds — character description, duration, pairing.

**Component primitive inventory** locked for v1 — full list of shadcn components to copy + custom Lite primitives to build (AdminShell, PortalShell, DashboardShell, WizardShell, KanbanBoard, BrandHero, MorningBrief, ToastWithSound, SoundProvider, MotionProvider, ThemeProvider, TypefaceProvider, EmptyState, Tier2Reveal).

**Data model contributions** to the Drizzle schema captured: 6 user preference fields, `users.first_signed_in_at`, `client_relationships.first_seen_at`, `saas_subscriptions.first_seen_at`, new `revenue_milestones` table.

**Build-time disciplines** consolidated as 11 numbered rules at the end of the spec.

---

## Key decisions worth flagging for the next sessions

1. **The "scarcity" pattern is now the dominant design discipline.** Every aesthetic load-bearing decision in this spec is a closed list (Tier 2 motion, BHS locations, sound registry, generous radius, theme presets, typeface presets, settings panel controls, revenue milestone thresholds). Any future feature spec that wants to add to one of these lists must do so explicitly, with Andy approval. This is the single biggest spec discipline carried forward.
2. **Andy reversed my "hard no" on aesthetic customisation twice in one session** — first asking for theme presets, then immediately extending the request to typefaces. New memory saved at `feedback_curated_customisation.md`: any aesthetic personalisation should propose 3 hand-tuned brand-canonical presets first, never sliders or pickers. Future spec sessions must default to the curated-presets pattern, not the no-customisation pattern.
3. **Density is page-level, never component-level.** Every feature spec must declare which preset its screens use. The first spec to use this rule is the next session (Sales Pipeline = density-comfort, Quote Page = density-air).
4. **Theme × typeface independence (9 combinations)** means every preset must be QA'd against every other preset in the first Phase 5 UI session — but they're guaranteed on-brand by construction, so the QA is "does it render correctly", not "does it look good".
5. **The admin shell is locked but per-page secondary panes are deferred to feature specs.** Sales Pipeline will use single-pane Kanban full-bleed. Inbox will use list+reader two-pane. Client detail will use list+detail two-pane. Each feature spec declares its own pane structure inside the locked shell.
6. **The first Phase 5 UI session has a clear scope** — set up the token sync pattern (`globals.css` ↔ `tailwind.config.ts` ↔ `lib/design-tokens.ts`), copy the shadcn component primitive set, build the locked custom Lite primitives (`AdminShell`, `BrandHero`, `EmptyState`, `Tier2Reveal`, `SoundProvider`, `MotionProvider`, `ThemeProvider`, `TypefaceProvider`, `ToastWithSound`), and lock the final tuned hex values for `theme-late-shift` and `theme-quiet-hours` in-browser.
7. **Reduced motion + sounds-off + large-text + compact-density must produce a usable variant of every screen** — this is the accessibility floor, tested in the first Phase 5 UI session and re-verified per feature.

---

## Open questions deferred to Phase 5

Captured at the bottom of the spec doc. None block Phase 3 work.

1. Exact `theme-late-shift` and `theme-quiet-hours` token values (starting points in spec, in-browser tuning needed).
2. Exact `--success` sage green hex (`#7BAE7E` is a starting point).
3. The 4–7 actual sound files (sourcing happens in dedicated Phase 5 sound review session).
4. Empty state copy library (`lib/empty-state-copy.ts`) — drafted per-feature, lives in one place.
5. Exact cubic-bezier curves for Tier 2 #2, #3, #4 (defined by name in spec, tuned in browser).
6. Mobile breakpoints for the admin shell (desktop-first, polish task).

---

## Memory updates this session

- **NEW:** `feedback_curated_customisation.md` — for any aesthetic personalisation, propose 3 hand-tuned on-brand presets; never sliders or pickers. Two-data-point preference confirmed in this session.
- MEMORY.md index updated to include the new entry.

---

## What the next Phase 3 session should do

**Next session: Phase 3 — Sales Pipeline spec.**

The Kanban is the spine that every other feature plugs into (lead gen drops cards in, quote builder lands deals, client management graduates Won cards, cockpit reads pipeline state). Sales Pipeline is the highest-leverage feature spec to write second because every later spec will reference its data model and stage-transition logic.

**Read in order:**
1. `CLAUDE.md`
2. `START_HERE.md`
3. This handoff
4. `sessions/phase-2-handoff.md`
5. `SCOPE.md` (especially "Sales pipeline" section)
6. `FOUNDATIONS.md`
7. **`docs/specs/design-system-baseline.md`** (the design system is now locked — every UI description in the pipeline spec must reference its tokens and primitives)
8. `MEMORY.md`

**Brainstorm rules unchanged.** One MC question at a time, recommendation + rationale in plain English, closed lists for any scarcity decisions, default to splitting if new scope emerges.

**Likely first MC question for Sales Pipeline session:** stage transition automation rigour — fully auto-driven by webhooks/events vs admin-confirmed-each-step vs hybrid. SCOPE.md already has a strong opinion (mostly auto, one-way locked transitions, manual drag override always available); the spec session confirms and locks it formally.

**Success criteria for that session:** `docs/specs/sales-pipeline.md` is locked with a complete user story, Kanban UI description (referencing `KanbanBoard`, `density-comfort`, the relevant tokens), drizzle schema for deals/stages/transitions/activity log, all integration touchpoints (Stripe webhook → Won, "they replied" button → Conversation, etc.), success criteria, and explicit non-goals.

---

## Risk flags carried forward

1. **Theme preset hex tuning is real design work**, not a 30-minute task — the first Phase 5 UI session needs to budget for it. Mitigation: starting values are in the spec; in-browser tuning is expected and the spec is a living doc that gets updated when the values lock.
2. **Sound sourcing is the second time-sink** — the dedicated Phase 5 sound review session must budget for the 6–8 sound iteration loop with Andy.
3. **Token sync pattern across three places (CSS / Tailwind / TS)** is a discipline that breaks the moment a build session forgets it. Mitigation: a unit test in the first Phase 5 UI session that asserts all three are aligned.
4. **The "9 theme × typeface combinations all on-brand" claim** is true by construction but only when the individual presets are tuned correctly. The first UI session must verify each combination renders without layout breakage — quick QA, but it must happen.
5. **Tier 2 motion scope creep is the single biggest design-discipline risk over the rest of Phase 3 + Phase 5.** Every feature spec writer (= future me) will be tempted to add "just one more" cinematic moment. The closed list is locked here. Refer to it before adding anything.
