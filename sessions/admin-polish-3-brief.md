# `admin-polish-3` — Invoices + Errors visual rebuild — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G11.b within-wave continuity rule** — authored at the close of `admin-polish-2` from `mockup-admin-interior.html`, the inherit-patterns from `admin-polish-1..2`, and the current `/lite/admin/invoices` + `/lite/admin/errors` surfaces.

---

## 1. Identity

- **Session id:** `admin-polish-3`
- **Wave:** 9 — Admin-interior visual parity (3 of 6)
- **Type:** `UI`
- **Model tier:** `/deep` (Opus) — mockup-parity rebuild with G10.5 reviewer gate.
- **Sonnet-safe:** `no`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/invoicing-branded.md` — behavioural spec for invoices admin surface; **no functional change this session**, visual chrome only. (Confirm actual spec filename during G1 preflight — brief-author may have guessed wrong. Past two sessions both caught brief-ref errors here.)
- `docs/specs/error-reporting-and-support-triage.md` or equivalent for the errors surface; **confirm during G1**. No functional change.
- `AUTONOMY_PROTOCOL.md` §G0 — admin-interior UI sessions must cite `mockup-admin-interior.html` in §2a.

## 2a. Visual references (binding)

- **`mockup-admin-interior.html`** — the binding reference. Applicable sections:
  - §3 page headers (**index variant** for both surfaces) — Righteous eyebrow + Black Han Sans H1 + Playfair italic deck + neutral meta row.
  - §4 toolbars — filters (paid / outstanding / overdue for invoices; severity / resolved for errors), primary CTAs where earned.
  - §5 status chips — invoices: draft / sent / paid / overdue / void; errors: fatal / warn / info, resolved-vs-open. Righteous 10px / 1.5px tracking, rgba-tinted bg + brand-coloured text.
  - §6 data cards — may apply to per-invoice or per-error hero cards; primary chrome is table rows (§7).
  - §7 table rows — **canonical for both surfaces this session.** Standard / stale / won variants. `<tfoot>` for totals (invoices: outstanding / paid / overdue sums; errors: total-open / total-resolved-this-window).
  - §8 voiced empty states — "No invoices yet." / "No errors. Impressive." — both must speak.
  - §9 BHS-adjacent paid moments — "paid" total row on the invoices `<tfoot>` may earn the §9 gradient + BHS treatment on the sum value (BHS on `.total` only, not every row).
  - §10 stale affordance — dormant overdue invoices (>N days past due) = dashed + slow-pulse `@keyframes stale-halo` (already in `app/globals.css` from `admin-polish-1`). Errors rarely go stale — resolved is resolved.
  - §11 alert banners — **heavily applicable this session.** Errors page: error-spike or fatal-count banner at the top = §11 **warm** alert (brand-red rgba + orange bleed). Invoices: overdue-count banner = §11 **warm** if >N, else §11 **cool** info. Inherit `admin-polish-2`'s cool-alert recipe for info + escalate to warm per mockup §11.
  - §13 binding rules 01–10.
- **`admin-polish-1` + `admin-polish-2` output** — canonical implementations:
  - **§3 header stack:** `app/lite/admin/products/page.tsx` lines 62–132 (index variant) and `app/lite/admin/products/[id]/page.tsx` lines 85–187 (entity-detail variant).
  - **§6 entity-card recipe:** `components/lite/sales-pipeline/deal-card.tsx` lines 75–218.
  - **§5 status chips:** `app/lite/admin/products/page.tsx` lines 260–289 (`StatusChip`) + `[id]/clients/status-pill-client.tsx`.
  - **§11 cool alert:** `app/lite/admin/products/[id]/page.tsx` lines 189–213 (archived banner).
  - **Rule 09 hover ease:** `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` on every interactive surface — polish-1 + polish-2 both regressed on this and G10.5 flagged. **Call it out in the brief upfront so this session doesn't third-regress.**
- `docs/superbad_brand_guidelines.html` — palette / typography source of truth.

**Inherit-patterns (verbatim from `admin_polish_inherit_patterns_across_wave` in PATCHES_OWED):**

1. **Header stack** = Righteous eyebrow (10px / 2px tracking) + Black Han Sans H1 (40px / -0.4px) + body-pink narrative mutter + meta row.
2. **`var(--surface-highlight)`** on every elevated surface — never inline the literal `inset 0 1px 0 rgba(253,245,230,0.04)`.
3. **Entity-card recipe** where cards apply = `var(--color-surface-2)` / `12px` radius / `18/20` padding / `hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)]` / stale = dashed `rgba(128,127,115,0.35)` + `rgba(34,34,31,0.5)` bg.
4. **Stale-halo keyframe** (`@keyframes stale-halo` in `app/globals.css`) — reuse on overdue-dormant invoice rows via absolutely-positioned child `<span>` pattern, not the row box-shadow directly.
5. **Righteous for all chips/badges/eyebrows at 10–11px, 1.5–1.8px tracking.** BHS reserved for display H1 + §9 paid-moment values + hero gradient moments only.
6. **Rule 09 hover everywhere** — `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `houseSpring`; never plain Tailwind `transition`. (New inherit-rule surfaced by polish-1 + polish-2 G10.5 defects.)
7. **Ladder discipline on alert bodies** — polish-2 precedent: neutral-300 body, neutral-500 italic footer, cream is reserved for BHS + primary-action + §9 headline-tile values.

## 3. Acceptance criteria

```
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

Session-specific additions:

- **Invoices table** — §7 standard rows; overdue >N days = stale variant (rule 04 dashed + slow pulse); paid rows = neutral standard; `<tfoot>` carries three totals (outstanding / paid / overdue) — the **paid total** row earns §9 BHS treatment on the sum value (rule 05).
- **Errors table** — §7 standard rows; severity chip (§5) in-row (fatal / warn / info); resolved rows = dimmed neutral-500 (ladder); open rows = neutral-300 body + brand-coloured severity chip. No BHS on any row (rule 05 — errors don't earn paid-moment treatment).
- **Top-of-page alert banners** — if `overdueCount > 0` on invoices → §11 warm banner (brand-red rgba bleed) above the table; if `openFatalCount > 0` on errors → §11 warm banner; otherwise suppress the banner (don't show "no alerts" — that's a rule-07 mutter-density violation).
- **Page mutter (rule 07)** — invoices: voiced on outstanding balance (`"the float's running dry."` / `"books are breathing."`). Errors: voiced on fatal count (`"something's on fire."` / `"quiet night."`). Suppress when the empty state is showing.
- **Empty states (rule 06)** — invoices: `"No invoices yet."` BHS + `"clean slate — or you haven't sent one."` Playfair; errors: `"No errors. Impressive."` BHS + `"or the logger's asleep. either way."` Playfair. Both get proportional earned-CTA at the transition moment (invoices: "Draft an invoice" if the route exists; errors: no CTA — triage is reactive, not authored).

## 4. Skill whitelist

- `tailwind-v4` — token + arbitrary-value syntax.
- `framer-motion` — stale halo, row hover, banner AnimatePresence if state changes client-side.
- `react-19` — existing Server Component boundaries retained.
- `baseline-ui` — anti-slop baseline.

## 5. File whitelist (G2 scope discipline)

- `app/lite/admin/invoices/page.tsx` — `edit` — header block + filters + §7 table + §11 overdue banner + §8 voiced empty.
- `app/lite/admin/errors/page.tsx` — `edit` — header block + filters + §7 table + §11 fatal-count banner + §8 voiced empty.
- **May add** a shared `components/lite/admin/data-table.tsx` **only if** both surfaces share ≥3 row-level concerns and inline code would duplicate. Default is inline. Polish sessions lift shared utilities only when the duplication is load-bearing.
- **May add** a shared `components/lite/admin/alert-banner.tsx` if §11 cool + warm variants appear on ≥2 surfaces this session (one on each is the threshold to justify the lift).

**Explicitly not touched:**

- `app/lite/admin/invoices/actions.ts` — Server Actions, no chrome.
- `AdminShellWithNav` (chrome — owned by `admin-chrome-1`).
- `components/lite/sales-pipeline/**`, `components/lite/saas-admin/**`, `app/lite/admin/products/**` — previous sessions' outputs; reference, do not mutate.
- `lib/invoices/*`, `lib/errors/*`, any data layer — no chrome.
- All tests unless a behavioural regression surfaces.

## 6. Settings keys touched

- **Reads:** none newly added. (Existing `killSwitches.*` reads retained if present.)
- **Seeds:** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `mockup-admin-interior.html` exists — `ls mockup-admin-interior.html`
- [ ] Invoices + Errors pages exist — `ls app/lite/admin/invoices/page.tsx app/lite/admin/errors/page.tsx` (both confirmed present as of 2026-04-16)
- [ ] `@keyframes stale-halo` present in `app/globals.css` (from `admin-polish-1`) — `grep "@keyframes stale-halo" app/globals.css`
- [ ] Polish-1 + polish-2 references intact — `ls components/lite/sales-pipeline/deal-card.tsx app/lite/admin/products/page.tsx app/lite/admin/products/[id]/page.tsx`
- [ ] Baseline test suite green — `npm test` (expected 832 / 1 skipped per `admin-polish-2` handoff).
- [ ] **Confirm spec filenames** (`docs/specs/invoicing-branded.md` or equivalent; same for errors) — `ls docs/specs/invoic*.md docs/specs/error*.md` — **correct the brief reference silently** per `feedback_technical_decisions_claude_calls` if wrong (past two sessions both had mis-pathed specs).
- [ ] **Confirm actual route structure** — both are single-page surfaces (no `[id]` detail route expected, but confirm). If a detail route exists and isn't in scope, note it and move on.

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — UI-only diff; no migration, no schema, no settings, no kill-switch, no new env, no contract change. Rollback = `git revert <commit>`.

## 9. Definition of done

- [ ] `/lite/admin/invoices` renders §3 index header + §11 warm overdue banner (conditional) + §7 table with stale variant on overdue-dormant rows + `<tfoot>` totals with §9 BHS on the paid-total value + §8 voiced empty.
- [ ] `/lite/admin/errors` renders §3 index header + §11 warm fatal banner (conditional) + §7 table with severity chips + dimmed resolved rows + §8 voiced empty.
- [ ] Every status / severity surfaces as a §5 chip (Righteous, ≥1.5px tracking, tinted).
- [ ] All interactive surfaces use rule-09 `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `houseSpring` — **zero plain `transition` classes on hover affordances.**
- [ ] All tabular numerics use Righteous with letter-spacing (rule 10).
- [ ] Alert-body copy uses neutral-300 (polish-2 ladder-discipline precedent), not cream.
- [ ] `min-h-screen bg-background` removed from any invoices/errors root div (admin-chrome-1 deferred nit).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (add tests only on regression).
- [ ] `npm run build` → clean.
- [ ] G10 parity check — screenshots vs mockup §3 / §7 / §11 pasted into the handoff (or deferred to PATCHES_OWED with the standard auth-seed friction note).
- [ ] G10.5 external reviewer — verdict `PASS` or `PASS_WITH_NOTES` verbatim in handoff; any notes → in-session fix + PATCHES_OWED for non-blockers.
- [ ] Memory-alignment declaration in handoff covering: `feedback_visual_references_binding`, `feedback_motion_is_universal`, `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_felt_experience_wins`, `feedback_no_content_authoring`, `feedback_technical_decisions_claude_calls`, `project_context_safety_conventions`.
- [ ] G0 → G12 run cleanly; handoff written to `sessions/admin-polish-3-handoff.md`.
- [ ] `SESSION_TRACKER.md` **🧭 Next Action** advanced to `admin-polish-4` (Companies detail).
- [ ] `sessions/admin-polish-4-brief.md` pre-compiled (G11.b within-wave continuity).

## 10. Notes for the next-session brief writer (`admin-polish-4` — Companies detail)

- Companies detail = entity-profile archetype; templates future client-detail surfaces. Read `admin-polish-2`'s `products/[id]/page.tsx` for the entity-detail header stack pattern — same crumbs-shape ("Admin · Companies · {name}"), same BHS + status pill + deck recipe.
- Any §7 row patterns established here (e.g. per-contact rows on a company) will carry forward. If `admin-polish-3` lifts a shared `data-table.tsx`, it applies; otherwise inline again.
- Likely §6 hero card for company summary + linked-deals panel + linked-invoices panel; grade each panel against inherit-pattern 3.
- Watch for existing "Companies list" surface vs. "Companies detail" — scope is detail only per tracker; if list is entangled, surface as a one-line question, don't absorb silently (polish-2 precedent).
