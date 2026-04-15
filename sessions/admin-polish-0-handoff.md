# `admin-polish-0` — Handoff

**Wave:** 9 — Admin-interior reference mockup (single-session insert, ahead of `admin-polish-1..6` + `ui-1`)
**Model tier:** `/deep` (Opus)
**Closed:** 2026-04-15
**Type:** UI · mockup-only · zero code changes

---

## What landed

- **`mockup-admin-interior.html`** at repo root — one scrollable reference sheet. ~700 lines of HTML + inline CSS, 13 numbered sections, 12 primitive specimens, 10 binding rules.
- Sections: palette recap, typography recap (four-voice strip), page headers (index + entity-detail variants), toolbars, stage + status + meta chips, data cards (summary + entity + urgent + stale variants), table rows (standard + stale + won), empty states (voiced + primary+ghost CTA), Won/BHS moment (deal-won red + paid-invoice green variants), stale affordances (dashed + muted + 3.2s halo pulse), alerts (warm / good / cool), generic-vs-branded contrast strip, numbered binding rules 01–10.
- **`AUTONOMY_PROTOCOL.md` G0** — updated to drop the "until `admin-polish-0` closes" caveat now that the mockup is shipped; clause re-states that admin-interior UI sessions must cite `mockup-admin-interior.html` in brief §2a; when a surface introduces a new admin primitive not covered, the session cuts a surface-specific mockup *first* + back-fills this shared sheet.
- **`SESSION_TRACKER.md`** Next Action advanced to `admin-polish-1` (Pipeline rebuild). `admin-polish-2..6` queued in order: Products → Invoices+Errors → Companies detail → Quote Builder interior → Settings. `ui-1` (Unified Inbox) deferred until the polish sequence closes.
- **`feedback_visual_references_binding`** memory — already carried the admin-interior clause from 2026-04-15 pre-session. Verified; no edit needed.

## What didn't land

- **No code.** `/lite/admin/**` pages stay untouched this session.
- **No per-route mockups.** Slicing for the six polish sessions was finalised off the shipped reference; each surface cuts its own mockup only if it introduces a primitive the shared sheet doesn't cover.

## Key decisions (silent calls per `feedback_technical_decisions_claude_calls`)

- **One sheet, not seven.** A per-route mockup-per-surface would fragment the reference; a single sheet lets future polish sessions grade against a single anchor and keeps primitives from drifting across files.
- **Visual rhyme with `mockup-cockpit.html`.** Palette tokens, warm-neutral surface stack, inner-highlight system, house-spring motion, Righteous eyebrows + BHS display + Playfair mutter — all lifted verbatim so admin interiors read as the same room as the cockpit, not a parallel design.
- **Generic-vs-branded contrast strip included.** The left-column "before" uses Inter 600 + #18181A + #2F2F33 hairline + shadcn-grey chip — a direct caricature of the failure mode on surfaces shipped before today. Without the contrast, binding rules read as abstract; with it, the failure is visible at a glance.
- **Binding rules are mechanical.** Every rule names a specific token or threshold (`surface-2`, `--inner-highlight`, Righteous ≥1.5px, 3.2s halo, spring 160–200ms, one mutter per surface, Righteous numeric columns) — self-gradeable without subjective calls.
- **Out-of-scope footer.** The mockup is explicit that it's not the design system page — `/lite/design` owns tokens, this sheet owns composition. Prevents future confusion about where a new token should land.

## Memory alignment

- `feedback_visual_references_binding` — mockup-first authorship; binding reference for all subsequent admin-polish sessions. Admin-interior clause already in the memory from pre-session.
- `feedback_no_content_authoring` — voice samples in the mockup are illustrative, drawn from existing `mockup-cockpit.html` copy patterns; not production content.
- `feedback_technical_decisions_claude_calls` — no questions asked; compositional calls silently locked.
- `feedback_motion_is_universal` — stale halo animation, hover transforms, and rule 09 all name house spring; the mockup *shows* motion (CSS keyframes + spring transitions), doesn't just describe it.
- `feedback_primary_action_focus` — rule 08 (one brand-red primary per surface, secondary ghosts) + toolbar specimen enforce single-CTA discipline.
- `feedback_individual_feel` — page-header deck variants voice the specific client ("Retainer since January. Quote renewal expiring tomorrow 18:00 — the bartender nudged Friday, nothing back.") rather than generic templating.
- `feedback_felt_experience_wins` — stale rendered as *absence of motion* (dashed + slow pulse) rather than a coloured "warning" — the feel is dormancy, not alarm.
- `project_context_safety_conventions` — brief pre-compiled (G11.b), mockup at predictable repo-root path, self-contained reference (no handoff-buried detail).

No memory violations.

## Verification

- **G0:** brief pre-compiled, `admin-chrome-1-handoff.md` + `sb-e2e-handoff.md` read, `mockup-cockpit.html` + `docs/superbad_brand_guidelines.html` sighted.
- **G1:** N/A — no preconditions to verify (no code).
- **G2:** only `mockup-admin-interior.html`, `AUTONOMY_PROTOCOL.md`, `SESSION_TRACKER.md`, `sessions/admin-polish-0-brief.md`, `sessions/admin-polish-0-handoff.md` touched.
- **G3–G9:** N/A — no code, no tests, no migration, no settings keys, no motion changes requiring Framer review, no accessibility impact beyond the mockup's own semantics.
- **G10:** N/A — no route to browse.
- **G10.5 external reviewer verdict:** **PASS** across all six axes (scope coverage, brand fidelity, failure-mode contrast, binding-rule utility, self-containment, scope creep). Reviewer was given only the mockup + brief + `mockup-cockpit.html` + brand-guidelines + `admin-chrome-1-handoff.md`; no building-agent reasoning. Verbatim verdict preserved below.
- **G11.b:** brief pre-compiled at session start.

### G10.5 reviewer verdict (verbatim)

```
VERDICT: PASS

1. Scope coverage: PASS — every §3 primitive is specimened (palette, four-voice type strip, index + detail headers with crumbs + meta row, toolbar with search+filters+primary+ghost, stage + entity-status + numeric chips, summary/entity/urgent/stale data cards, standard+stale+won table rows with tfoot, voiced empty with primary+ghost CTAs, Won BHS + paid-green variant, dashed+halo stale affordance, warm/good/cool alerts with who/what/why, contrast strip, ten numbered rules).
2. Brand fidelity: PASS — palette tokens (#B22848, #F4A0B0, #F28C52, #FDF5E6, #7BAE7E, surface-0..2, --inner-highlight) lift verbatim from mockup-cockpit.html; Pacifico wordmark, Black Han Sans display, Righteous eyebrows tracked 1.5–2.5px, Playfair italic deck + mutter, DM Sans body all used in specimen copy, not just described; house-spring `cubic-bezier(0.16, 1, 0.3, 1)` drives hover + stale halo; voice present ("stripe took 2.1%. you still up.", "the bartender nudged them").
3. Failure-mode contrast: PASS — §12 pairs identical data on Inter-600 / #18181A / #2F2F33 hairline / shadcn-grey chip (left) vs surface-2 + inner-highlight / BHS / Righteous-tracked stage-negotiating chip / Playfair-pink mutter (right); a build agent cannot miss what "generic" means.
4. Binding-rule utility: PASS — each of the ten rules names a specific token or threshold (surface-2 + --inner-highlight, Righteous tracked ≥1.5px, 3.2s halo, spring 160–200ms, one mutter per surface, Righteous numeric columns) — all are mechanically self-gradeable against a candidate surface.
5. Self-containment: PASS — no primitive is prose-only; even the numeric/meta pill, passive-line footer, and "needs re-auth" integration-stale variant appear as specimens. A future polish session can build from this file alone.
6. Scope creep: PASS — sheet reads top-to-bottom as specimens + rules, not a per-route design; footer explicitly bans this becoming the design system page and routes tokens/motion back to /lite/design.
```

Reviewer notes (non-blocking, not required to fix):
- Reviewer flagged one nit about CSS variable use inside a keyframe `animation` shorthand — runtime-valid (the custom prop resolves to a cubic-bezier string), cosmetic concern only. No action.

## PATCHES_OWED

None opened. None closed (this session didn't consume any pending patches).

Carry forward (untouched by this session):
- `sbe2e_ci_wire`
- `sbe2e_stripe_cleanup`
- `sb11_retainer_route_lift`, `sb11_manual_browser_verify`, `sb11_g105_external_reviewer`, `sb11_action_integration_tests`, `sb11_copy_mini_session`

## For the next session (`admin-polish-1` — Pipeline rebuild)

- Brief is not yet pre-compiled; G11.b says pre-compile at session start.
- Cite §2a: `mockup-admin-interior.html` (this session's output) **+** `mockup-cockpit.html` (for the three-column rhythm the pipeline kanban shares).
- Scope: `/lite/admin/pipeline` page header, kanban column headers, deal cards, stale halo, Won moment on column drop. Chrome (`AdminShellWithNav`) already owned by `admin-chrome-1` — do not retouch.
- Primary remediation: swap the current flat-black deal card for the `surface-2 + inner-highlight` pattern from §6 of the reference; page header needs a Black Han Sans title + voiced deck per §3; stage chips per §5; Won drop-target gets the BHS treatment per §9.
- G10 parity check: open `mockup-admin-interior.html` + `/lite/admin/pipeline` side-by-side; every binding rule 01–10 gradeable against the built surface.
- Model tier: `/deep`.

## Closing note

The room SuperBad runs the business from now has a reference the walls can be painted against. Six polish sessions to turn generic admin interiors into ones that feel like the same product as the rest of Lite — starting with Pipeline.
