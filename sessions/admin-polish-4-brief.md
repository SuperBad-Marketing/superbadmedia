# `admin-polish-4` — Companies detail visual rebuild — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G11.b within-wave continuity rule** — authored at the close of `admin-polish-3` from `mockup-admin-interior.html`, the inherit-patterns from `admin-polish-1..3`, and the current `/lite/admin/companies/[id]` surface.

---

## 1. Identity

- **Session id:** `admin-polish-4`
- **Wave:** 9 — Admin-interior visual parity (4 of 6)
- **Type:** `UI`
- **Model tier:** `/deep` (Opus) — entity-detail archetype rebuild with G10.5 reviewer gate.
- **Sonnet-safe:** `no`
- **Estimated context:** `medium-high` (first multi-panel detail surface in the wave; linked-deals / linked-invoices / linked-contacts panels compound).

## 2. Spec references

- `docs/specs/client-management.md` — behavioural spec for client + company surfaces; **no functional change this session**, visual chrome only. (Confirm filename during G1 preflight — the last three polish sessions all caught brief-author spec-path errors.)
- `docs/specs/client-context-engine.md` — context the detail view may surface; read only if referenced by existing page code.
- `AUTONOMY_PROTOCOL.md` §G0 — admin-interior UI sessions must cite `mockup-admin-interior.html` in §2a.

## 2a. Visual references (binding)

- **`mockup-admin-interior.html`** — the binding reference. Applicable sections:
  - §3 page headers (**entity-detail variant**) — crumbs row (`Admin · Companies · {name}`) + Black Han Sans H1 (the company name) + inline StatusPill + Playfair italic deck + meta row (vertical / size / primary contact / engagement arc).
  - §5 status chips — company status (active / prospect / paused / archived), deal stage chips in the linked-deals panel (reuse sales-pipeline palette), invoice status chips in the linked-invoices panel (reuse `InvoiceStatusBadge` — polish-3 output).
  - §6 data cards — **primary chrome this session.** Hero summary card, linked-deals panel card, linked-invoices panel card, linked-contacts panel card. `var(--color-surface-2)` / 12px / 18-20 padding / `var(--surface-highlight)` / no hairline outlines over flat black.
  - §7 table rows — canonical inside each linked panel (deals rows, invoices rows, contacts rows). Standard variant only — stale belongs on timeline surfaces, not relational panels.
  - §8 voiced empty — per linked-panel: "No deals yet." / "No invoices yet." / "One lonely contact." — each speaks with a Playfair italic pink mutter.
  - §9 BHS-adjacent moments — the hero summary may earn **one** BHS treatment (e.g. lifetime value or Deal-Won count) if a paid-moment number is available. Rule 05: one earned moment per surface, not per panel.
  - §10 stale — if the company hasn't been touched in >N days, the crumbs row or hero deck can carry a Playfair italic "dormant · {date}" affordance (Rule 04 — dashed + muted, never coloured). Keep off the panels.
  - §11 alert banners — rare on detail views; only if the company is **archived** (§11 cool info banner at the top of the hero card) or has **overdue invoices** (§11 warm warning pulled from the linked-invoices panel — compute once and bubble). Otherwise suppress.
  - §13 binding rules 01–10.
- **`admin-polish-1` + `admin-polish-2` + `admin-polish-3` output** — canonical implementations:
  - **§3 entity-detail header stack:** `app/lite/admin/products/[id]/page.tsx` lines 85–187. Crumbs + BHS + StatusPill + deck + Righteous `dl` meta row.
  - **§6 entity-card recipe:** `components/lite/sales-pipeline/deal-card.tsx` lines 75–218.
  - **§7 table recipe:** `components/lite/invoices/invoice-index-client.tsx` (polish-3 output) — Righteous 10px / 2px-tracking headers on 5% cream bottom border; `rgba(253,245,230,0.03)` row hairlines; `whileHover={{ backgroundColor: 'rgba(253,245,230,0.025)' }}`; numeric columns Righteous with letter-spacing.
  - **§11 cool alert:** `app/lite/admin/products/[id]/page.tsx` lines 189–213 (archived banner). **§11 warm alert:** polish-3 invoices page + errors page recipe (`linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))` + `1px solid rgba(178,40,72,0.25)` + Righteous 10px / 1.5px brand-orange eyebrow + neutral-300 body + brand-pink italic footer).
  - **§5 status chip:** `components/lite/invoices/invoice-status-badge.tsx` (polish-3) — TONE map pattern, 10px / 1.5px Righteous, rgba-tinted bg + brand-coloured text + 1×1 currentColor dot at opacity 0.85. Mirror this pattern for a `CompanyStatusBadge` if one doesn't exist (grep before creating).
  - **Rule 09 hover ease:** `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` on every interactive surface — polish-1 + polish-2 both regressed, polish-3 held. **Call it out upfront so this session holds too.**
- `docs/superbad_brand_guidelines.html` — palette / typography source of truth.

**Inherit-patterns (verbatim from `admin_polish_inherit_patterns_across_wave` in PATCHES_OWED, updated through polish-3):**

1. **Header stack** = Righteous eyebrow/crumbs (10px / 2px tracking) + Black Han Sans H1 (40px / -0.4px) + DM Sans deck with Playfair italic brand-pink mutter + Righteous-labelled meta row.
2. **`var(--surface-highlight)`** on every elevated surface — never inline the literal `inset 0 1px 0 rgba(253,245,230,0.04)`.
3. **Entity-card recipe** = `var(--color-surface-2)` / `12px` radius / `18/20` padding / `hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.18)]` / stale = dashed `rgba(128,127,115,0.35)` + `rgba(34,34,31,0.5)` bg.
4. **Stale-halo keyframe** (`@keyframes stale-halo` in `app/globals.css`) — reuse on card-level stale only via absolutely-positioned child `<span>`. **Not on table rows** (polish-3 established: halo fights §7 tables-whisper).
5. **Righteous for all chips/badges/eyebrows at 10–11px, 1.5–1.8px tracking.** BHS reserved for display H1 + §9 paid-moment values only — one earned moment per surface.
6. **Rule 09 hover everywhere** — `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `houseSpring`; never plain Tailwind `transition`.
7. **Ladder discipline on alert bodies** — neutral-300 body, neutral-500 italic footer, cream reserved for BHS + primary-action + §9 headline-tile values.
8. **Tables inherit §7 verbatim** (polish-3 locked) — Righteous 10px / 2px-tracking headers on 5% cream bottom border; `rgba(253,245,230,0.03)` row hairlines; row hover `rgba(253,245,230,0.025)`; numeric columns Righteous with letter-spacing. Never `<Card>` or `<Table>` component with theme tokens.
9. **Warm alert banner recipe** (polish-3 locked) — `linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))` + `1px solid rgba(178,40,72,0.25)` + brand-orange eyebrow + neutral-300 body + pink italic footer. Cool variant (polish-2): `var(--color-surface-2)` + `1px solid rgba(244,160,176,0.18)`. Good variant (unused so far): success rgba.

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

- **Hero summary card** — §6 data card. Company name is the BHS H1 in the header (not inside the card). Card carries: status chip (§5), vertical + size badges (Righteous, neutral tone), primary-contact line (contact name + role), engagement arc (days since first contact → last touch), one earned §9 BHS moment on lifetime value *or* Deal-Won count (whichever is the authoritative "paid moment" for this company).
- **Linked-deals panel** — §6 card wrapping a §7 table. Columns: deal title / stage chip / value / next action / when-touched. Stage chips reuse the sales-pipeline palette from `admin-polish-1`. Empty state: "No deals yet." BHS 24px + Playfair italic `"we haven't tried to sell them anything."`.
- **Linked-invoices panel** — §6 card wrapping a §7 table. Columns: invoice # / issued / due / total / status chip (reuse polish-3 `InvoiceStatusBadge`). Empty state: "No invoices yet." BHS 24px + Playfair italic `"either free work or fresh name."`.
- **Linked-contacts panel** — §6 card wrapping a §7 table. Columns: name / role / email / last touch. Honours `project_client_size_diversity` — multi-contact per company, primary-contact flagged with a Righteous "primary" chip. Empty state: "One lonely contact." BHS 24px + Playfair italic `"orgs are made of people."` (shown only if zero contacts, which shouldn't happen — still voice it).
- **Page mutter (rule 07, one per surface)** — voiced on the hero deck, **not per panel**. Conditions: overdue invoices → `"they owe you {count}."`; stale (no touch in N days) → `"quiet since {month}."`; healthy + active deal in-flight → `"live work in the calendar."`; no narrative to carry → suppress (earned-calm, rule 07). Per-panel empty-states already carry their own voice — that's §8, not rule 07; two voices on the same page only when the empty block owns one and the hero deck owns the other.
- **CTAs (rule 08)** — detail pages lean on implicit actions (click a row → drill). Add a brand-red primary CTA **only** if a first-class action exists (e.g. "Log activity" if the activity-log route is wired; "New deal" if the pipeline route accepts a pre-filled company). Absent those: no primary CTA, per `feedback_primary_action_focus`.
- **Archived banner** — §11 cool info banner at the top of the hero card when `company.status === "archived"`. Mirrors `products/[id]` archived banner recipe. Neutral-300 body. No CTA (restore is out-of-scope polish).
- **Overdue banner** — §11 warm banner at the top of the linked-invoices panel when `overdueCount > 0` on the company's invoices. Reuse polish-3 recipe. Neutral-300 body + pink italic footer.

## 4. Skill whitelist

- `tailwind-v4` — token + arbitrary-value syntax.
- `framer-motion` — panel hover, banner AnimatePresence if state changes client-side, layoutId for primary-action morph if a CTA exists.
- `react-19` — existing Server Component boundaries retained.
- `baseline-ui` — anti-slop baseline.

## 5. File whitelist (G2 scope discipline)

- `app/lite/admin/companies/[id]/page.tsx` — `edit` — header block + hero summary card + linked-deals panel + linked-invoices panel + linked-contacts panel + conditional §11 banners.
- **May add** `components/lite/admin/companies/company-status-badge.tsx` if a company status chip doesn't already exist — grep first. If adding, mirror `InvoiceStatusBadge` pattern verbatim (TONE map + 1×1 dot + Righteous 10px / 1.5px).
- **May add** a shared `components/lite/admin/linked-panel.tsx` **only if** the three panels share ≥3 chrome concerns (surface-2 card + header row + §7 table + §8 empty state) and inlining would triple-duplicate. Default is inline three panels; lift only if duplication is load-bearing. (Polish-session threshold: lift when the third consumer arrives.)

**Explicitly not touched:**

- `app/lite/admin/companies/[id]/actions.ts` — Server Actions, no chrome.
- `app/lite/admin/companies/page.tsx` (list view) — **out of scope per tracker.** If the list is entangled with the detail view (shared client component, shared helper), surface as a one-line question — don't absorb silently (polish-2 precedent with the `clients/` route).
- `components/lite/invoices/**` — polish-3 output; reuse `InvoiceStatusBadge`, don't mutate. If `InvoiceIndexClient` is the natural fit for the linked-invoices panel, **consume it with `hideSummary hideFilters`** (API preserved in polish-3) — don't reimplement the table.
- `components/lite/sales-pipeline/**`, `app/lite/admin/products/**`, `app/lite/admin/invoices/**`, `app/lite/admin/errors/**`, `app/lite/admin/pipeline/**` — previous sessions' outputs; reference, do not mutate.
- `lib/**` — no behavioural change.
- All tests unless a behavioural regression surfaces.

## 6. Settings keys touched

- **Reads:** none newly added. (Existing `killSwitches.*` reads retained if present. If a `company.stale_days` value would be hard-coded, log to PATCHES_OWED for later migration to `settings.get()` per polish-3 precedent.)
- **Seeds:** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `mockup-admin-interior.html` exists — `ls mockup-admin-interior.html`
- [ ] Companies detail page exists — `ls app/lite/admin/companies/[id]/page.tsx` (confirmed present as of 2026-04-16)
- [ ] `@keyframes stale-halo` present in `app/globals.css` — `grep "@keyframes stale-halo" app/globals.css`
- [ ] Polish-1..3 references intact — `ls components/lite/sales-pipeline/deal-card.tsx app/lite/admin/products/[id]/page.tsx components/lite/invoices/invoice-index-client.tsx components/lite/invoices/invoice-status-badge.tsx`
- [ ] Baseline test suite green — `npm test` (expected 832 / 1 skipped per `admin-polish-3` handoff).
- [ ] **Confirm spec filenames** — `ls docs/specs/client-management.md docs/specs/client-context-engine.md` — correct silently per `feedback_technical_decisions_claude_calls` if wrong.
- [ ] **Confirm schema** — `lib/db/schema/companies.ts` (or wherever companies live) to lock column names + status enum values. Note whether company lifetime-value / deal-won count is a derivable aggregate or requires a join (drives whether the §9 BHS moment can be computed without scope creep).
- [ ] **Confirm linked-entity query surfaces** — deals/invoices/contacts by company_id. If none exist as ready-made helpers, inline the queries; do not lift query helpers in a polish session.
- [ ] **Confirm list-surface isolation** — `app/lite/admin/companies/page.tsx` if it exists: verify detail-only edit doesn't regress the list (same-file imports only). Read the list briefly; don't edit it.

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — UI-only diff; no migration, no schema, no settings, no kill-switch, no new env, no contract change. Rollback = `git revert <commit>`.

## 9. Definition of done

- [ ] `/lite/admin/companies/[id]` renders §3 entity-detail header (crumbs + BHS name + status chip + voiced deck + meta row) + conditional §11 archived/overdue banners + §6 hero summary card + §6 linked-deals panel (§7 rows + §8 voiced empty) + §6 linked-invoices panel (§7 rows + §8 voiced empty) + §6 linked-contacts panel (§7 rows + §8 voiced empty).
- [ ] Every status / stage surfaces as a §5 chip (Righteous, ≥1.5px tracking, tinted).
- [ ] One earned §9 BHS moment on the hero card (rule 05) — LTV or Deal-Won count.
- [ ] All interactive surfaces use rule-09 `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `houseSpring` — **zero plain `transition` classes on hover affordances.**
- [ ] All tabular numerics use Righteous with letter-spacing (rule 10).
- [ ] Alert-body copy uses neutral-300 (polish-2 + polish-3 ladder discipline), not cream.
- [ ] `min-h-screen bg-background` not reintroduced (admin-chrome-1 owns the root).
- [ ] One rule-07 page mutter on the hero deck (conditional); per-panel empty states carry their own §8 voice.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (add tests only on regression).
- [ ] `npm run build` → clean.
- [ ] G10 parity check — screenshots vs mockup §3 (entity-detail) / §6 / §7 / §11 pasted into the handoff (or deferred to PATCHES_OWED with the standard auth-seed friction note).
- [ ] G10.5 external reviewer — verdict `PASS` or `PASS_WITH_NOTES` verbatim in handoff; any notes → in-session fix + PATCHES_OWED for non-blockers.
- [ ] Memory-alignment declaration in handoff covering: `feedback_visual_references_binding`, `feedback_motion_is_universal`, `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_felt_experience_wins`, `feedback_no_content_authoring`, `feedback_technical_decisions_claude_calls`, `project_context_safety_conventions`, `project_client_size_diversity` (multi-contact requirement), `feedback_earned_ctas_at_transition_moments`.
- [ ] G0 → G12 run cleanly; handoff written to `sessions/admin-polish-4-handoff.md`.
- [ ] `SESSION_TRACKER.md` **🧭 Next Action** advanced to `admin-polish-5` (Quote Builder interior).
- [ ] `sessions/admin-polish-5-brief.md` pre-compiled (G11.b within-wave continuity).

## 10. Notes for the next-session brief writer (`admin-polish-5` — Quote Builder interior)

- Scope is `/lite/admin/deals/[id]/quotes/[quote_id]/edit` — the editor chrome, **not** the public quote surface at `/lite/quotes/[token]` (that's intro-funnel polish, out of Wave 9). Left pane = section headers + field labels + toolbar; right pane = live-preview chrome (preview payload untouched — QB-2b output is load-bearing).
- This is the first polish session where the "surface" is a two-pane editor rather than an index or detail. Header pattern: §3 entity-detail header with **quote identifier** as BHS (e.g. `Q-{number}`), crumbs `Admin · Deals · {deal} · Quote`, status chip (draft / sent / viewed / accepted / expired / withdrawn / superseded) using the polish-3 TONE-map pattern.
- Left-pane section headers inherit Righteous eyebrow (10–11px / 1.5–2px tracking) and neutral-300 body. Inputs = native + token styling (polish-3 precedent from invoices filter bar). Toolbar CTA = brand-red "Send" per §8 — **earned CTA** (rule 07 earned-transition), layoutId morph into the Send modal is already live from QB-3 — don't rewire.
- Right-pane preview is read-only; chrome around it (device toggle, zoom affordances) gets polish, payload doesn't. The existing `mode: live | modal-preview` split from QB-4a must not regress.
- Watch for plain `transition` classes — the editor has dozens of hover surfaces; this is where rule-09 regresses most reliably.
- Model tier: `/deep`.
