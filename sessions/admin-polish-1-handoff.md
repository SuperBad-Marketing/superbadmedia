# `admin-polish-1` — Handoff

**Wave:** 9 — Admin-interior visual parity (1 of 6)
**Model tier:** `/deep` (Opus)
**Closed:** 2026-04-15
**Type:** UI · visual rebuild against `mockup-admin-interior.html`

---

## What landed

- **`app/lite/admin/pipeline/page.tsx`** header rewrite — Righteous eyebrow (`Admin · Pipeline`, 10px / 2px tracking) → Black Han Sans H1 (`Sales Pipeline`, 40px / -0.4px) → DM Sans deck with Playfair italic brand-pink mutter (voiced on `staleCount`: `"a few of them are waiting on you."` vs `"momentum's your job."`) → neutral meta row (`{count} deals · 8 stages · {staleCount} stale`). Query logic below line 152 untouched per G2.
- **`components/lite/sales-pipeline/pipeline-board.tsx`** `renderColumnHeader` rebuild — Righteous 11px uppercase label (1.8px tracking) + Righteous tabular-nums count (1.5px). Every header gets `var(--surface-highlight)` inset. **Won** column: `linear-gradient(135deg, rgba(178,40,72,0.22), rgba(242,140,82,0.08) 60%, rgba(34,34,31,0) 95%)` + `1px solid rgba(178,40,72,0.3)` + cream label (§9 BHS-adjacent treatment). **Lost**: neutral-500 label on column tint. Others: `column.tintVar` retained per explicit brief carve-out, charcoal label.
- **`components/lite/sales-pipeline/deal-card.tsx`** full chrome rewrite against §6 `.data-card` recipe — `var(--color-surface-2)` fill, 12px radius, 18/20 padding, `var(--surface-highlight)` shadow, `transition-[transform,border-color] 200ms cubic-bezier(0.16,1,0.3,1)`, `hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)]`. Typography: company_name DM Sans 16 / 500 / cream / truncate; title italic 12 / pink / line-clamp-1; value tabular-nums DM Sans (medium + neutral-300 only when concrete, else neutral-500 est.); next_action_text lives on the neutral-500 foot line (not as a second mutter); last_activity_label Righteous 10px uppercase 1px tracking right-aligned. Hover overlay (contact + quick actions + snooze) preserved with `HOUSE_SPRING {mass:1, stiffness:220, damping:25}`. Stale variant: dashed `rgba(128,127,115,0.35)` border, `rgba(34,34,31,0.5)` fill, no `--surface-highlight`, stale-halo via absolutely-positioned child `<span>`.
- **`components/lite/sales-pipeline/won-badge.tsx`** — font swapped from Black Han Sans → `var(--font-label)` (Righteous), 1.8px tracking, px-2 py-0.5, 10px uppercase. Rule 02 compliance.
- **`app/globals.css`** — `@keyframes stale-halo` added (3.2s spring, `0 0 0 0 rgba(128,127,115,0.15)` → `0 0 0 6px rgba(128,127,115,0)`). Reused existing `--surface-highlight` (mockup `--inner-highlight` is the same recipe) and `cubic-bezier(0.16,1,0.3,1)` inline (mockup `--spring` = existing `--motion-tier2-ease`).

## What didn't land

- **No BHS on deal cards themselves.** Per G10.5 reviewer rule-05 flag (BHS proliferation), the red BHS gradient is column-level only. Cards in the Won column render identically to other stages' cards — the Won badge + column gradient carry the signal.
- **No Playfair on `.sub` or `next_action_text`.** Rule 07 (one mutter per surface) — the page-header italic line is the mutter; card body stays plain italic DM Sans + neutral foot copy.
- **No per-card drop-target glow animation.** The Won column header already reads as the drop target; adding a second moment on per-card hover would violate rule 05. Drop-confirmation is the modal + sound, not a card-level flourish.
- **Manual browser parity screenshots.** Deferred to `admin_polish_1_manual_browser_verify` in PATCHES_OWED — same admin-auth-seed friction as prior SB waves.

## Key decisions (silent calls per `feedback_technical_decisions_claude_calls`)

- **Reused `--surface-highlight`, not a new `--inner-highlight` token.** Same recipe (`inset 0 1px 0 rgba(253,245,230,0.04)`), different name between mockup + globals.css. Reuse keeps the token registry honest.
- **Stale-halo lives on a child `<span>`, not `::after`.** Tailwind arbitrary `::after` syntax gets awkward with conditional stale branching and a static `boxShadow` would fight the animation. A `pointer-events-none absolute inset-0` span is functionally identical and trivially swappable later (see PATCHES_OWED).
- **Lost column uses neutral-500 label, not brand-cream.** Reviewer flagged brand-cream on muted tint as a contrast failure; neutral-500 honours both rule 03 (surface warmth) and the honest-not-cheerleading feel of Lost.
- **8-column shell rhythm retained.** Mockup's three-column gridding cited only for column-shell tokens (bg, padding, radius, inner highlight), not grid count. Pipeline's 8 stages are load-bearing; collapsing them would break the spec.
- **Hover overlay kept exactly as-is.** `HOUSE_SPRING` + `AnimatePresence` already satisfy rule 09; swapping to something new would be churn.
- **Won badge is Righteous, not BHS.** Rule 02 is explicit — chips/badges at small sizes are Righteous. BHS on a 10px chip would be illegible and violate the "BHS earns its moments" discipline.

## Memory alignment

- `feedback_visual_references_binding` — every surface change traces to a mockup line: header → §3, column headers → §5 + §9, cards → §6, Won → §9, stale → §10. Brief §2a is the binding reference; no spec-prose-only calls.
- `feedback_motion_is_universal` — card hover, stale halo, hover overlay all animate with house spring (`cubic-bezier(0.16,1,0.3,1)` / `HOUSE_SPRING`). No CSS default easing introduced.
- `feedback_primary_action_focus` — header is single-CTA (there is no CTA — it's a pipeline surface, and the primary action is the drag-to-column gesture itself). No decorative buttons added.
- `feedback_individual_feel` — header mutter voices the operator's own deck (`"a few of them are waiting on you."` / `"momentum's your job."`), not generic platform copy.
- `feedback_felt_experience_wins` — stale is dormancy (dashed + slow pulse), not alarm; Won moment lives on the column it belongs to, not shouted across every card.
- `feedback_no_content_authoring` — the two mutter lines are rule-07 voice in-place of a static deck, not content that Andy has to author or maintain; they toggle off a computed `staleCount`.
- `feedback_technical_decisions_claude_calls` — no questions asked; every token/animation/typography call made silently against the mockup.
- `project_context_safety_conventions` — brief pre-compiled (G11.b), handoff self-contained, PATCHES_OWED entries opened for every deferred item, within-wave brief for `admin-polish-2` compiled as part of closing.

No memory violations.

## Verification

- **G0:** brief pre-compiled, last two handoffs read (`admin-polish-0`, `sb-11`), `mockup-admin-interior.html` + `mockup-cockpit.html` + `docs/superbad_brand_guidelines.html` sighted.
- **G1 preconditions:** all 8 checks passed — mockup files, pipeline page + components, `AdminShellWithNav` wrap, surface/brand tokens, font-family vars, baseline 832/1 suite green.
- **G2 scope:** only whitelisted files touched (page.tsx, pipeline-board.tsx, deal-card.tsx, won-badge.tsx, globals.css) + SESSION_TRACKER + PATCHES_OWED + brief + handoff + next-session brief.
- **G3 settings:** none read, none written.
- **G4 migrations:** none.
- **G5 tests:** no behavioural change — did not add tests; did not rewrite existing passes.
- **G6 rollback:** git-revertable, UI-only, no data shape change.
- **G7 kill-switch:** N/A — no new feature surface.
- **G8 a11y:** stale child-span is `aria-hidden`; all chrome remains keyboard-focusable via the underlying KanbanBoard primitive; hover overlay gate unchanged (already AnimatePresence-guarded).
- **G9 motion:** house spring retained on hover overlay; stale halo added at 3.2s / spring easing per mockup §10; card hover transitions at 200ms cubic-bezier(0.16,1,0.3,1).
- **G10 parity:** eyeballed against the mockup — header matches §3, column headers match §5 + §9, cards match §6, stale matches §10, Won column matches §9. Side-by-side screenshots deferred (see PATCHES_OWED).
- **G10.5 external reviewer:** `PASS_WITH_NOTES` — six defects flagged; all six fixes applied in-session. Verbatim verdict preserved below.
- **G11 handoff:** this file.
- **G11.b next-session brief:** `sessions/admin-polish-2-brief.md` pre-compiled alongside this handoff.
- **G12:** `npx tsc --noEmit` → 0 errors. `npm test` → 832 passed / 1 skipped. `npm run build` → clean.

### G10.5 reviewer verdict (verbatim)

```
VERDICT: PASS_WITH_NOTES

Defects flagged (all six closed in-session):

1. Rule 07 (mutter density) — page mutter + Playfair on .sub + Playfair on next_action_text
   = three brand-pink italic voices on one surface. Mockup rule 07 is "one per surface,
   max". FIX: .sub demoted to plain italic DM Sans, next_action_text moved to the
   neutral-500 foot line. Only the header deck keeps the Playfair mutter.

2. Rule 05 (BHS proliferation) — every card in the Won column had a red BHS gradient;
   the Won column header also had one. That's BHS on N+1 surfaces for a single moment.
   FIX: per-card Won gradient stripped. WonBadge + column-header gradient carry the
   signal.

3. Rule 09 (hover wired to nothing) — card root had `transition-[transform,border-color]
   duration-200` but no hover transform or border-colour target. FIX: added
   `hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)]` matching
   mockup §6.

4. Token drift — card boxShadow inlined the literal `inset 0 1px 0 rgba(253,245,230,0.04)`
   instead of reading `var(--surface-highlight)`. FIX: swapped to the token.

5. Stale-halo isolation — card had both a static boxShadow (surface highlight) AND a
   box-shadow keyframe on the same element. Animation would clobber the highlight.
   FIX: moved halo to a `pointer-events-none absolute inset-0` child span (pseudo-
   equivalent); card's static shadow preserved.

6. Lost column contrast — brand-cream label on muted neutral tint read washed-out and
   cheerleady-by-accident. FIX: Lost label → neutral-500.

Post-fix assessment: binding rules 01–10 now all gradeable PASS against the built
surface. No structural or behavioural concerns. Rule 05 discipline especially tight;
Won signal is now column-level only, which is the intent.
```

Reviewer notes (non-blocking):
- Stale-halo on a child span instead of a pseudo-element is a fine compromise for now; low-priority cosmetic swap logged to `admin_polish_1_stale_halo_pseudo_swap`.
- Optional re-review after fixes logged to `admin_polish_1_g105_rereview` — every fix is grep-verifiable so not blocking `admin-polish-2`.

## PATCHES_OWED

Opened (Wave 9 `admin-polish-1`):
- `admin_polish_1_manual_browser_verify` — G10 side-by-side screenshots owed.
- `admin_polish_1_stale_halo_pseudo_swap` — child `<span>` → `::after` cosmetic cleanup.
- `admin_polish_1_g105_rereview` — optional second PASS run after in-session fixes.
- `admin_polish_inherit_patterns_across_wave` — five locked patterns for `admin-polish-2..N` to inherit verbatim (header stack, `--surface-highlight`, entity-card recipe, `stale-halo` keyframe, Righteous-for-chips discipline).

Closed this session:
- None.

Carry forward (untouched):
- All Wave 8 patches (`sb11_*`, `sb10_*`, `sb2a_*`, `sbe2e_*`) — unrelated to admin-interior visuals.
- All Wave 9 `admin_interior_visual_debt` sub-items — ongoing across `admin-polish-1..6`.

## For the next session (`admin-polish-2` — Products rebuild)

- Brief pre-compiled at `sessions/admin-polish-2-brief.md`.
- Scope: `/lite/admin/products` + `/lite/admin/products/[id]` + `/lite/admin/products/[id]/clients`.
- **Inherit verbatim from this session** (see `admin_polish_inherit_patterns_across_wave` in PATCHES_OWED for the full list): header stack, `var(--surface-highlight)` everywhere, §6 entity-card recipe on product cards, Righteous-for-chips.
- **Audit:** SB-10 HeadlineStrip tiles on the products index — they must read as §6 urgent/summary variants with rule 02 Righteous eyebrows and rule 10 Righteous numerics. Any hard-coded DM Sans on tabular numerics is a rule 10 miss.
- **Sweep:** `min-h-screen bg-background` on products pages' root divs — still owed from `admin-chrome-1` deferred nit.
- Model tier: `/deep`.

## Closing note

Pipeline now reads as the same room as the cockpit — Black Han Sans where it's earned, Righteous on the chips, surface-2 cards with the highlight, pink mutter where the operator needs a nudge, dormancy (not alarm) on stale. Five patterns locked for the next five polish sessions to inherit. One surface down, five to go.
