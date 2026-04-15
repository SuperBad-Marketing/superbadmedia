# `admin-polish-2` — Products visual rebuild — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G11.b within-wave continuity rule** — authored at the close of `admin-polish-1` from `mockup-admin-interior.html`, the five locked `admin-polish-1` inherit-patterns, and the current `/lite/admin/products` + `[id]` surfaces.

---

## 1. Identity

- **Session id:** `admin-polish-2`
- **Wave:** 9 — Admin-interior visual parity (2 of 6)
- **Type:** `UI`
- **Model tier:** `/deep` (Opus) — mockup-parity rebuild with G10.5 reviewer gate.
- **Sonnet-safe:** `no`
- **Estimated context:** `medium`

## 2. Spec references

- `docs/specs/saas-products.md` — behavioural spec for product list + detail; **no functional change this session**, visual chrome only.
- `AUTONOMY_PROTOCOL.md` §G0 — admin-interior UI sessions must cite `mockup-admin-interior.html` in §2a.

## 2a. Visual references (binding)

- **`mockup-admin-interior.html`** — the binding reference. Applicable sections:
  - §3 page headers (**index variant** for `/lite/admin/products`, **entity-detail variant** for `/lite/admin/products/[id]`) — Righteous eyebrow + Black Han Sans H1 + Playfair italic DM Sans deck + neutral meta row.
  - §4 toolbars — search + filters + primary ("New product") + ghost actions. Righteous primary label, `var(--surface-highlight)` inset, ghost secondaries.
  - §5 status chips — product lifecycle (draft / active / paused / archived) as stage-style chips, Righteous 10px / 1.5px tracking, rgba-tinted bg + brand-coloured text.
  - §6 data cards — **`.data-card` recipe canonical for product cards** + the already-locked `admin-polish-1` deal-card implementation (`components/lite/sales-pipeline/deal-card.tsx` lines 75-218) is the structural template. Summary / urgent / stale variants per mockup. Product tile on index = summary; detail page hero = summary; client-list rows = table-row variant or entity-card rhythm, session call.
  - §6 / §9 HeadlineStrip audit — SB-10's `components/lite/saas-admin/headline-strip.tsx` must be graded against mockup §6 summary/urgent variants + rule 02 (Righteous eyebrows) + rule 10 (Righteous numerics). Any hard-coded DM Sans on tabular numerics is a rule 10 miss and must swap to `var(--font-label)` with letter-spacing.
  - §7 table rows (for `/lite/admin/products/[id]/clients`) — standard / stale / won variants; `<tfoot>` for totals per mockup.
  - §8 voiced empty states — "No clients yet." is a bug; the empty must speak.
  - §13 binding rules 01–10.
- **`admin-polish-1` output** — `components/lite/sales-pipeline/deal-card.tsx` + `components/lite/sales-pipeline/pipeline-board.tsx` `renderColumnHeader` are the canonical implementations of §6 and §3 respectively. **Read both before rebuilding.** Product cards should rhyme structurally, not diverge.
- `docs/superbad_brand_guidelines.html` — palette / typography source of truth.

**Inherit-patterns (verbatim from `admin_polish_inherit_patterns_across_wave` in PATCHES_OWED):**

1. **Header stack** = Righteous eyebrow (10px / 2px tracking) + Black Han Sans H1 (40px / -0.4px) + body-pink narrative mutter + meta row.
2. **`var(--surface-highlight)`** on every elevated surface (header chips, cards, toolbar pills, headline tiles) — never inline the literal `inset 0 1px 0 rgba(253,245,230,0.04)`.
3. **Entity-card recipe** = `var(--color-surface-2)` / `12px` radius / `18px 20px` padding / `hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)]` / stale = dashed `rgba(128,127,115,0.35)` + `rgba(34,34,31,0.5)` bg.
4. **Stale-halo keyframe** (`@keyframes stale-halo` in `app/globals.css`) — reusable; if a product tile is ever "stale" (draft / archived?), use the absolutely-positioned child `<span>` pattern, not the card box-shadow directly.
5. **Righteous for all chips/badges/eyebrows at 10–11px, 1.5–1.8px tracking.** BHS reserved for display H1 + hero gradient moments only.

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

- Every product tile on the index reads as a `.data-card` (rule 03) with a status chip (rule 02), concrete numeric tabulars in Righteous (rule 10), and a voiced one-liner if the product has seen <3 subscribers (rule 07 — max one per surface; live it on the *page* mutter, not every tile).
- HeadlineStrip tiles grade PASS against rules 02 + 10; any DM Sans tabular numeric in the strip is a blocker.
- Product detail page carries the **entity-detail header variant** (crumbs: "Admin · Products · {name}"; H1 = product name; deck voices "Since {firstActiveAt}, {activeSubscriberCount} running.").
- Client-list table (`/lite/admin/products/[id]/clients`) uses the §7 pattern — standard rows, stale variant for dormant subs, `<tfoot>` with summed MRR (if we already have it).

## 4. Skill whitelist

- `tailwind-v4` — token + arbitrary-value syntax.
- `framer-motion` — stale halo + hover springs (reused from `admin-polish-1`).
- `react-19` — existing Server Component boundaries retained.
- `baseline-ui` — anti-slop baseline.

## 5. File whitelist (G2 scope discipline)

- `app/lite/admin/products/page.tsx` — `edit` — header block + product tile grid rebuild against §3 + §6. **Sweep:** strip `min-h-screen bg-background` from root `<div>` if present (admin-chrome-1 deferred nit).
- `app/lite/admin/products/[id]/page.tsx` — `edit` — entity-detail header + hero card + status chips + action toolbar. **Sweep:** same `min-h-screen` check.
- `app/lite/admin/products/[id]/clients/page.tsx` — `edit` — table rebuild against §7 + voiced empty state (§8).
- `components/lite/saas-admin/headline-strip.tsx` — `edit` — rule 02 / rule 10 audit pass. Every eyebrow → Righteous; every metric numeric → Righteous with letter-spacing; `var(--surface-highlight)` on every tile.
- `components/lite/saas-admin/` — **may add** a shared `ProductCard` component if more than one surface reuses the tile pattern (index + a future recommendation surface). Only add if clearly justified — default is inline.
- `app/lite/admin/products/[id]/tier-change-action.tsx` — `edit` (conditional) — if the action renders any visible chrome (button / confirm affordance), apply rule 08 (brand-red primary, Righteous-capped, `--surface-highlight`).

**Explicitly not touched:**

- `app/lite/admin/products/actions-archive.ts` — Server Action, no chrome.
- `AdminShellWithNav` (chrome — owned by `admin-chrome-1`).
- `components/lite/sales-pipeline/` — previous session's output; reference, do not mutate.
- `lib/saas-products/*` — data layer; no chrome.
- All tests unless a behavioural regression surfaces.

## 6. Settings keys touched

- **Reads:** none newly added.
- **Seeds:** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `mockup-admin-interior.html` exists — `ls mockup-admin-interior.html`
- [ ] Products pages exist — `ls app/lite/admin/products/page.tsx app/lite/admin/products/[id]/page.tsx app/lite/admin/products/[id]/clients/page.tsx`
- [ ] HeadlineStrip exists — `ls components/lite/saas-admin/headline-strip.tsx`
- [ ] `@keyframes stale-halo` present in `app/globals.css` (from `admin-polish-1`) — `grep "@keyframes stale-halo" app/globals.css`
- [ ] Deal-card reference intact — `grep "data-card" mockup-admin-interior.html` + `ls components/lite/sales-pipeline/deal-card.tsx`
- [ ] Baseline test suite green — `npm test` (expected 832 / 1 skipped per `admin-polish-1` handoff).

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — UI-only diff; no migration, no schema, no settings, no kill-switch, no new env, no contract change. Rollback = `git revert <commit>`.

## 9. Definition of done

- [ ] `/lite/admin/products` renders the §3 index-variant header + §6 product tile grid. One page mutter, rule 07 compliant.
- [ ] `/lite/admin/products/[id]` renders the §3 entity-detail header + §6 hero card + §4 action toolbar. HeadlineStrip graded PASS against rules 02 + 10.
- [ ] `/lite/admin/products/[id]/clients` renders §7 table rows + §8 voiced empty.
- [ ] Every product-lifecycle status surfaces as a §5 chip (Righteous, 1.5px tracking, tinted).
- [ ] `min-h-screen bg-background` removed from any products-page root div.
- [ ] HeadlineStrip numerics in Righteous with letter-spacing (rule 10); eyebrows in Righteous (rule 02).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (add tests only on regression).
- [ ] `npm run build` → clean.
- [ ] G10 parity check — screenshots vs mockup §3 / §6 / §7 pasted into the handoff.
- [ ] G10.5 external reviewer — verdict `PASS` or `PASS_WITH_NOTES` verbatim in handoff; any notes → PATCHES_OWED.
- [ ] Memory-alignment declaration in handoff covering: `feedback_visual_references_binding`, `feedback_motion_is_universal`, `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_felt_experience_wins`, `feedback_no_content_authoring`, `feedback_technical_decisions_claude_calls`, `project_context_safety_conventions`.
- [ ] G0 → G12 run cleanly; handoff written to `sessions/admin-polish-2-handoff.md`.
- [ ] `SESSION_TRACKER.md` **🧭 Next Action** advanced to `admin-polish-3` (Invoices + Errors).
- [ ] `sessions/admin-polish-3-brief.md` pre-compiled (G11.b within-wave continuity).

## 10. Notes for the next-session brief writer (`admin-polish-3` — Invoices + Errors)

- Invoices + Errors bundled because both are flat-black table surfaces that share the §7 table-row remediation.
- If this session lifts a shared `ProductCard` / entity-card utility, Invoices + Errors may not need it (they're table-centric), but check.
- Errors page may carry a "last error" hero treatment — grade against §11 alerts (warm/good/cool) in the mockup.
- HeadlineStrip pattern established here (if any shared header-metric component emerges) may inform the invoice outstanding-totals hero.
