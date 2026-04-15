# `admin-polish-1` — Pipeline visual rebuild — Session Brief

> **Mop-up authored per AUTONOMY_PROTOCOL.md §G11.b** — `admin-polish-0`'s closing handoff explicitly deferred this brief. Authored from `mockup-admin-interior.html` + current repo state at session start. Anti-cycle: this session does not spawn further mop-up brainstorms.

---

## 1. Identity

- **Session id:** `admin-polish-1`
- **Wave:** 9 — Admin-interior visual parity
- **Type:** `UI`
- **Model tier:** `/deep` (Opus) — mockup-parity rebuild with G10.5 reviewer gate; per tracker Next Action.
- **Sonnet-safe:** `no`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/sales-pipeline.md` §§ 5.1–5.6, 8 — existing behavioural spec; **no functional change this session**, visual chrome only.
- `AUTONOMY_PROTOCOL.md` §G0 — admin-interior UI sessions must cite `mockup-admin-interior.html` in §2a.

## 2a. Visual references (binding)

- **`mockup-admin-interior.html`** — the binding reference. Applicable sections:
  - §3 page headers (**index variant**) — Black Han Sans h3, Righteous crumbs, DM Sans deck (with Playfair italic emphasis), neutral meta row.
  - §5 stage chips (`.chip.stage-lead` / `.stage-contacted` / `.stage-conversation` / `.stage-trial` / `.stage-quoted` / `.stage-negotiating` / `.stage-won` / `.stage-lost`) — Righteous 10px, 1.5px tracking, uppercase, rgba-tinted bg + brand-coloured text.
  - §6 data cards — **`.data-card` recipe is canonical for deal cards**: `background: var(--surface-2)`, `border-radius: 12px`, `padding: 18px 20px`, `border: 1px solid transparent`, `box-shadow: var(--inner-highlight)`, 200ms `var(--spring)` transitions. Stale variant: dashed `rgba(128,127,115,0.35)` border, `rgba(34,34,31,0.5)` bg, no inner highlight.
  - §9 Won / BHS moment — deal-won red treatment for the "won" column drop state (gradient `rgba(178,40,72,0.22) → rgba(242,140,82,0.08) → 0`, `1px solid rgba(178,40,72,0.3)`, `border-radius: 16px`, radial glow `rgba(244,160,176,0.18)`).
  - §10 stale affordances — `stale-halo` 3.2s keyframe (`0%,100%: 0 0 0 0 rgba(128,127,115,0.15)` → `50%: 0 0 0 6px rgba(128,127,115,0)`), house-spring easing.
  - §13 binding rules 01–10 — gradeable against the built surface.
- **`mockup-cockpit.html`** — for **three-column rhythm only**: shared `gap: 20px`, `--surface-1` column shells, `var(--radius-generous)` + `var(--inner-highlight)`. The pipeline has 8 columns not 3, but column-shell vocabulary is the same.
- `docs/superbad_brand_guidelines.html` — palette / typography source of truth.

**Intentional divergences from the mockup:**

- Kanban uses **8 columns**, not 3. Three-column rhythm cited only for column-shell token reuse (background, padding, radius, inner highlight), not grid count.
- Column header currently renders per-stage tint via `stage-config.ts#tintVar` (oklch `color-mix`). **Retained** — the mockup's §5 chip colour palette belongs on the *stage chip* primitive; the column-header tint is a separate, scene-setting concern and already brand-tuned. Do not collapse the two.

## 3. Acceptance criteria (verbatim from the mockup's binding rules + admin-polish-0 handoff "For next session")

```
From admin-polish-0 handoff, "For the next session (admin-polish-1 — Pipeline rebuild)":

- Cite §2a: mockup-admin-interior.html + mockup-cockpit.html (three-column rhythm).
- Scope: /lite/admin/pipeline page header, kanban column headers, deal cards, stale halo, Won moment on column drop. Chrome (AdminShellWithNav) already owned by admin-chrome-1 — do not retouch.
- Primary remediation: swap the current flat-black deal card for the surface-2 + inner-highlight pattern from §6 of the reference; page header needs a Black Han Sans title + voiced deck per §3; stage chips per §5; Won drop-target gets the BHS treatment per §9.
- G10 parity check: open mockup-admin-interior.html + /lite/admin/pipeline side-by-side; every binding rule 01–10 gradeable against the built surface.

Binding rules 01–10 (verbatim from mockup §13):

01. Page headers use Black Han Sans, always — with a voiced deck.
02. Eyebrows, chips, and metric headers are Righteous, all-caps, tracked ≥1.5px.
03. Cards sit on surface-2 with --inner-highlight. No hairline outlines over flat black.
04. Stale is dashed + muted + slow-pulsing. Never coloured.
05. Won / paid moments earn the BHS treatment. Nothing else does.
06. Empty states are voiced. "No items" is a bug.
07. Mutter lines live in Playfair italic, brand-pink. One per surface, max.
08. Primary CTA is brand-red, Righteous-capped, with --inner-highlight + glow. Secondary is ghost.
09. Hover states animate with --spring over 160–200ms. No CSS default easing.
10. Numeric columns and counts use Righteous with letter-spacing — never plain DM Sans tabular.
```

## 4. Skill whitelist

- `tailwind-v4` — token + arbitrary-value syntax used throughout the rebuild.
- `framer-motion` — stale halo + hover springs + Won-column drop moment.
- `react-19` — Server Component header + Client Component board boundary is already set; retained.
- `baseline-ui` — anti-slop baseline; the whole session is baseline remediation.

## 5. File whitelist (G2 scope discipline)

- `app/lite/admin/pipeline/page.tsx` — `edit` — header block rewrite (Righteous crumbs → Black Han Sans h1 → DM Sans deck with Playfair italic emphasis → meta row: count + passive line). **Do not touch** query logic below line 152.
- `components/lite/sales-pipeline/pipeline-board.tsx` — `edit` — `renderColumnHeader` template: Righteous tracked label + Righteous numeric count, retain `column.tintVar` background. Won column header gets the §9 BHS red tinted gradient (not the full BHS moment — the moment is the drop animation).
- `components/lite/sales-pipeline/deal-card.tsx` — `edit` — card chrome rewrite against §6 `.data-card` recipe. Preserve all props + behaviours (hover overlay, quick actions, snooze popover, won badge, drag state, stale flag). Typography inside: company_name → DM Sans 16 / 500 / cream; title → Playfair italic pink 12; value → Black Han Sans 28 with Righteous currency prefix; next_action → Playfair italic pink mutter.
- `components/lite/sales-pipeline/won-badge.tsx` — `edit` (conditional) — only if the current badge violates rule 02 (Righteous ≥1.5px). Per explorer report it already uses `var(--font-black-han-sans)`, which is a rule 02 miss (eyebrows/chips are Righteous, not Black Han Sans). **Fix:** swap to Righteous + 1.5px tracking.
- `app/globals.css` — `edit` (conditional) — add `@keyframes stale-halo` if not already present; add `--spring` custom property if not already present. Per explorer report tokens already exist; keyframes need a grep check in G1.

**Explicitly not touched:**

- `AdminShellWithNav` (chrome — owned by admin-chrome-1).
- `components/lite/kanban-board.tsx` (primitive — no signature change needed).
- `components/lite/sales-pipeline/stage-config.ts` (column tints — retained).
- `components/lite/sales-pipeline/snooze-popover.tsx` / `loss-reason-modal.tsx` / `won-confirm-modal.tsx` (modals — out of scope this session, polish session owed separately if they drift).
- All Server Actions in `app/lite/admin/pipeline/actions.ts` + `snooze-action.ts` + `three-wons-egg.ts`.
- Tests — **add** only if a behavioural regression is introduced; **don't rewrite** existing passes.

## 6. Settings keys touched

- **Reads:** none newly added — session consumes the thresholds already read by `page.tsx`.
- **Seeds (new keys):** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `mockup-admin-interior.html` exists — `ls mockup-admin-interior.html`
- [ ] `mockup-cockpit.html` exists — `ls mockup-cockpit.html`
- [ ] `app/lite/admin/pipeline/page.tsx` exists — `ls app/lite/admin/pipeline/page.tsx`
- [ ] `components/lite/sales-pipeline/{pipeline-board,deal-card,won-badge,stage-config}.tsx` exist — `ls components/lite/sales-pipeline/`
- [ ] `AdminShellWithNav` shell wraps admin routes — `grep "AdminShellWithNav" app/lite/admin/layout.tsx`
- [ ] Surface / brand tokens declared — `grep -E "(--surface-2|--inner-highlight|--brand-red|--brand-pink|--brand-cream)" app/globals.css`
- [ ] Font-family vars wired — `grep -E "(font-black-han-sans|font-righteous|font-playfair|font-dm-sans)" app/globals.css`
- [ ] Baseline test suite green before touching code — `npm test` (expected 832 / 1 skipped per `admin-chrome-1` handoff).

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — UI-only diff; no migration, no schema, no settings, no kill-switch, no new env, no contract change on kanban primitive. Rollback = `git revert <commit>`.

## 9. Definition of done

- [ ] `/lite/admin/pipeline` renders the §3 index-variant page header (Black Han Sans h1, Righteous crumbs, DM Sans + Playfair italic deck, neutral meta row with deal count + one Playfair mutter line per rule 07).
- [ ] Every deal card renders as the §6 `.data-card` recipe — `surface-2` bg, `--inner-highlight` shadow, 12px radius, spring transitions. No flat-black backgrounds, no hairline outlines.
- [ ] Stale cards render dashed + muted + 3.2s halo pulse per §10 and rule 04. Never coloured.
- [ ] Won column's header carries the §9 BHS gradient / border tint; the drop-target state reinforces it (hover halo while dragging towards "won"). No other column earns it (rule 05).
- [ ] Column-header labels + card-count numerics use Righteous with ≥1.5px tracking (rules 02, 10). Value prefix ($ / est.) uses Righteous eyebrow; amount uses Black Han Sans (rule 10).
- [ ] Won badge swaps from `var(--font-black-han-sans)` to Righteous + 1.5px tracking (rule 02 compliance).
- [ ] Hover overlay on each card animates with `houseSpring` over 160–200ms (rule 09). Already in place — verify intact.
- [ ] Empty-column copy preserved (rule 06 already satisfied by `getStageEmptyState`).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (expected 832 / 1; add tests only if regression introduced).
- [ ] `npm run build` → clean.
- [ ] Dev server boots on `:3001`, `/lite/admin/pipeline` returns 200 on admin auth.
- [ ] G10 mockup-parity check — screenshots of the built pipeline vs §3 header / §6 card / §9 Won column / §10 stale card pasted into the handoff.
- [ ] **G10.5 external reviewer** — sub-agent graded against binding rules 01–10; verdict `PASS` or `PASS_WITH_NOTES` verbatim in handoff; notes logged to `PATCHES_OWED.md`.
- [ ] Memory-alignment declaration in handoff covering: `feedback_visual_references_binding`, `feedback_motion_is_universal`, `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_felt_experience_wins`, `feedback_no_content_authoring`, `feedback_technical_decisions_claude_calls`, `project_context_safety_conventions`.
- [ ] G0 → G12 run cleanly; handoff written to `sessions/admin-polish-1-handoff.md`.
- [ ] `SESSION_TRACKER.md` **🧭 Next Action** advanced to `admin-polish-2` (Products rebuild).
- [ ] `sessions/admin-polish-2-brief.md` pre-compiled (G11.b rolling cadence — within-wave continuity).

## 10. Notes for the next-session brief writer (`admin-polish-2` — Products)

- Products rebuild (`/lite/admin/products` + `/lite/admin/products/[id]`) inherits the same §6 data-card recipe this session establishes on the deal card. Treat that card as the canonical surface pattern — Products is expected to reuse its structure, not reinvent it.
- If this session lifts any deal-card typography into a shared class / component (e.g. a `.data-card` utility), note it for Products.
- Products pages currently carry `min-h-screen bg-background` on their root `<div>` per `admin-chrome-1` deferred nit — still owed a removal pass. Schedule it inside `admin-polish-2` unless this session already swept it.
- Headline signals strip on `/lite/admin/products` (SB-10) must be audited against mockup §6 urgent/summary variants + rule 02 Righteous + rule 10 Righteous numerics. Flag any hard-coded Inter / DM Sans numeric tabulars now.
