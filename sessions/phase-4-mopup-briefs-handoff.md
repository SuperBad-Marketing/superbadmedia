# Phase 4 mop-up — Pre-compiled session briefs backfill — Handoff

**Date:** 2026-04-14
**Phase:** 4 (mop-up — process fix, not a feature build)
**Authorisation:** Phase 4 mop-up authorised per `project_phase_3_5_and_4_mop_up_sessions_authorised`. Anti-cycle obeyed: this mop-up does **not** spawn another.
**Outcome:** Closed the gap that AUTONOMY_PROTOCOL.md §G0 + §"Pre-compiled session briefs" assumed but Phase 4 didn't deliver. Permanent cadence rule landed so the gap can't recur.

---

## What was built

1. **`sessions/_brief-template.md`** — one-page brief template. Required fields: identity (id, type, model tier, sonnet-safe flag, est context), spec refs, verbatim acceptance criteria, skill whitelist (2–5), file whitelist (G2 scope), settings keys touched (reads + seeds), preconditions (each grep-verifiable), rollback (one of three G6 forms), definition of done (checkbox list), notes for next-session brief writer (G11.b feedstock).
2. **`sessions/a5-brief.md`, `sessions/a6-brief.md`, `sessions/a7-brief.md`, `sessions/a8-brief.md`** — Wave 1 remaining-session briefs against current repo state. Each carries grep-verifiable preconditions referencing the actual paths in the tree (`lib/db/`, `lib/kill-switches.ts`, `docs/settings-registry.md`, etc.) plus a §10 notes block for the closing session to feed into the next brief. Wave 2 (B1–B3) briefs intentionally not written here — the new G11.b rule lands them at A8 closure.
3. **`AUTONOMY_PROTOCOL.md` §G11.b — rolling-cadence rule.** Each Phase 5 session's handoff writes the next session's brief. Each wave's closing session additionally writes briefs for every session in the next wave. Escape hatch: if a closing session's context is tight, split — the closing handoff writes the immediate-next brief only and logs which next-wave briefs are still owed; the first session of the next wave starts fresh and writes them as its first action. Mop-up rule: a session that finds its own brief missing pauses, logs to PATCHES_OWED, writes its own brief from BUILD_PLAN + spec(s), then proceeds with G1.
4. **PATCHES_OWED.md** — added a "Phase 4 mop-up — pre-compiled session briefs backfill (2026-04-14)" section. The briefs-missing concern is filed and immediately struck through (APPLIED) since this session closes it. A second row flags the BUILD_PLAN A4 motion-skill triple (`framer-motion`, `motion-design-principles`, `design-motion-principles`) for a future housekeeping pass.
5. **SESSION_TRACKER.md** — Next Action block updated to point A5 at `sessions/a5-brief.md` (not BUILD_PLAN A5 verbatim) and to name the new G11.b cadence rule. Header line records the mop-up.

## Retro parity check on A1–A4 (clean)

For each closed Wave 1 session, enumerated what a brief would have required and verified each item ships in the repo. No gaps — no PATCHES_OWED rows opened against A1/A2/A3/A4 from this audit:

| Session | Required artefacts | Repo evidence |
|---|---|---|
| A1 | Next.js 16 scaffold, dev `:3001`, env validator, Tailwind v4, shadcn baseline | `package.json` (Next 16.2.3), `next.config.ts` turbopack root, `instrumentation.ts` → `lib/env.ts` (zod), `app/globals.css` Tailwind v4 imports, `components.json` shadcn config — all present. |
| A2 | SuperBad token set in CSS + TS mirror, 3 theme presets, 3 typeface presets, `/lite/design` route, Vitest harness | `app/globals.css`, `lib/design-tokens.ts`, `lib/fonts.ts`, `lib/presets.ts`, `app/lite/design/page.tsx`, `vitest.config.ts`, `tests/tokens.test.ts` — all present. Deferred items (user-table columns, Settings → Display UI) are tracked in PATCHES_OWED rows 231–232 with explicit A5 / post-A8 gates and reflected in the new A5 brief §5/§9. Not a parity gap. |
| A3 | 32 shadcn primitives + 2 hand-rolled (Form, DatePicker), 8 custom Lite wrappers, primitives gallery, accessibility panel | `components/ui/` (35 files), `components/lite/` (8 wrappers), `app/lite/design/primitives-gallery.tsx`, `app/lite/design/a11y-panel.tsx`, `tests/primitives.test.ts` — all present. |
| A4 | `houseSpring` MotionConfig, 7-key Tier 2 choreographies, `pdfRenderOverlay` Tier 1 token, 7-key sound registry, reduced-motion path, `/lite/design` extensions | `lib/motion/choreographies.ts`, `lib/sounds.ts`, `components/lite/{motion,sound}-provider.tsx`, `components/lite/tier-2-reveal.tsx`, `tests/motion-sound.test.ts` — all present. |

**Conclusion:** every artefact a hypothetical brief would have demanded is in the repo. The brief gap is procedural-only; no scope drift to back-fill. Per the mop-up scope, no full retro briefs were written — they'd serve no future reader.

## Expected findings the prompt asked me to surface

1. **Consolidated 166-value `activity_log.kind` enum source file may not exist.** Confirmed not present in the current tree (no `lib/db/schema/` exists yet — A5/A6 own the schema). The 166-value count is locked inline in `docs/specs/sales-pipeline.md` §4.1 per Phase 3.5 Batch A step 2a. The A6 brief §7 preconditions handle this explicitly: A6 either consolidates the enum from the spec at session start (estimated half a session — the brief flags tier escalation if it tips A6 over budget) or pauses and surfaces a product question. Not a blocker for A5.
2. **`docs/settings-registry.md` may be stale vs A7/A8 additions.** Confirmed: registry currently lists 60 keys; A7 needs 4 additional `email.*` keys + B1 needs 3 `alerts.*` keys. The A5 brief §6 lists the seven additions verbatim and §9 ticks "Totals row → 67". A5 owns the registry update + seed migration in one pass.
3. **`portal_magic_links` column reconciliation.** Surface verified: Intro Funnel §10.1 owns the canonical column shape; Client Management §10.1 reuses it. The A8 brief §5 lands the table with nullable `submission_id` + `client_id` per the BUILD_PLAN A8 generalisation; preconditions name both spec sources. No open question — A8's brief is the reconciliation.
4. **A4's three motion skills duplicate.** Confirmed: BUILD_PLAN A4 lists `framer-motion`, `motion-design-principles`, `design-motion-principles`. `motion-design-principles` lives at `.claude/skills/motion-design-principles/` (project skill); `design-motion-principles` lives at `~/.claude/skills/design-motion-principles/` (global skill). Overlap is real. A4 didn't load either (the 7 Tier 2 choreographies were spec-locked, not designed). Logged a PATCHES_OWED row under "Phase 4 mop-up" calling for a BUILD_PLAN housekeeping decision (dedupe vs keep belt-and-braces). Non-blocking.

## Artefacts produced (G7)

- **Files created:** `sessions/_brief-template.md`, `sessions/a5-brief.md`, `sessions/a6-brief.md`, `sessions/a7-brief.md`, `sessions/a8-brief.md`, `sessions/phase-4-mopup-briefs-handoff.md` (this file).
- **Files edited:** `AUTONOMY_PROTOCOL.md` (added §G11.b after §G11), `PATCHES_OWED.md` (new mop-up section), `SESSION_TRACKER.md` (Next Action + header lines).
- **Tables / migrations / settings rows:** none. Process work only.
- **Routes:** none.

## Rollback declaration (G6)

**git-revertable, no data shape change.** Pure documentation work. Rollback = `git revert` the mop-up commit. No code, no schema, no kill-switches.

## Open threads for A5

- Read `sessions/a5-brief.md` first. The brief is canonical; BUILD_PLAN A5 is no longer the primary read.
- A5's handoff must write `sessions/a6-brief.md` per the new §G11.b cadence. The A5 brief §10 lists the feedstock items.
- A5 owns the registry totals bump (60 → 67) and the seven new key seeds (4 email, 3 alerts).

## PATCHES_OWED rows added

1. ~~Pre-compiled session briefs gap~~ — **APPLIED** in the same mop-up.
2. BUILD_PLAN A4 motion-skill triple — non-blocking, gate: next BUILD_PLAN housekeeping pass.
