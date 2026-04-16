# `admin-polish-5` — Quote Builder editor chrome visual rebuild — Session Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G11.b within-wave continuity rule** — authored at the close of `admin-polish-4` from `mockup-admin-interior.html`, the inherit-patterns from `admin-polish-1..4`, and the current `/lite/admin/deals/[id]/quotes/[quote_id]/edit` surface.

---

## 1. Identity

- **Session id:** `admin-polish-5`
- **Wave:** 9 — Admin-interior visual parity (5 of 6)
- **Type:** `UI`
- **Model tier:** `/deep` (Opus) — first two-pane editor surface in the wave; preview payload untouchable + left-pane has dozens of hover surfaces where rule-09 regresses most reliably.
- **Sonnet-safe:** `no`
- **Estimated context:** `medium-high` — `quote-editor.tsx` is 639 lines, `preview-pane.tsx` is 248. Chrome-only; preview payload does not move.

## 2. Spec references

- `docs/specs/quote-builder.md` §4.1 (editor UI — two-pane layout, motion discipline) — **no functional change this session**, chrome-only. Confirm filename during G1 preflight per polish-1..4 precedent.
- `AUTONOMY_PROTOCOL.md` §G0 — admin-interior UI sessions must cite `mockup-admin-interior.html` in §2a.

## 2a. Visual references (binding)

- **`mockup-admin-interior.html`** — the binding reference. Applicable sections:
  - §3 page headers (**entity-detail variant**) — crumbs row (`Admin · Deals · {deal_title} · Quote`) + Black Han Sans H1 rendering the quote identifier (e.g. `Q-SB-2026-0042` or just the `number` field — grep for what the schema exposes) + inline quote status chip (§5, TONE map per polish-3 pattern: `draft` / `sent` / `viewed` / `accepted` / `expired` / `withdrawn` / `superseded`) + Playfair italic pink mutter voiced on status (`"last chance before it expires."` if expiring soon / `"they're reading it."` on viewed / suppress when draft with no state to carry) + Righteous meta row (deal title / version / expires-at / last-updated).
  - §5 status chips — reuse polish-3 `InvoiceStatusBadge` TONE-map recipe. Mirror as `QuoteStatusBadge` **only if** one doesn't already exist (grep `quote-status-card.tsx` / `quote-status-badge.tsx` / similar before creating — polish-session scope discipline).
  - §6 data cards — **primary chrome this session** for left-pane section wrappers. Each left-pane section (identity + scope + line items + totals + email overrides + legal/ToS) lands as a §6 surface-2 card with 12px radius + 18–20 padding + `var(--surface-highlight)`. No hairline outlines over flat black.
  - §7 tables — the line-items editor inside the scope section is a §7 table (Righteous 10px / 2px-tracking headers on 5% cream bottom border; row hairlines `rgba(253,245,230,0.03)`; numeric columns Righteous tabular-nums). Inherit rule 8 row hover — judgement call here because rows are editable (each row has inputs); see §3 below.
  - §8 voiced empty — "No line items yet." with BHS 24px + Playfair italic pink mutter ("nothing to charge for yet.") when scope is empty.
  - §9 BHS-adjacent — **one earned moment**: the Totals card's final grand-total value gets the BHS 32px tabular-nums cream treatment on the rgba-success gradient when the quote status ∈ `accepted`. Pre-accept, the total is Righteous tabular-nums cream (operational state, not a paid moment). Rule 05 discipline.
  - §10 stale — if the quote is past its `expires_at_ms` and still `sent` / `viewed`, the header crumbs / deck can surface a Playfair italic "dormant · expired {date}" affordance. Never coloured.
  - §11 alert banners — rare on editors. Conditional cases:
    - Expired (warm) — warm banner on the editor top when `status === "expired"`; neutral-300 body; pink italic footer.
    - Superseded (cool info) — cool banner with a link to the replacing quote when `status === "superseded"`.
    - Accepted (good variant, first use) — success-tinted banner when `status === "accepted"`; uses `linear-gradient(135deg, rgba(123,174,126,0.18), rgba(244,160,176,0.05))` + `1px solid rgba(123,174,126,0.30)` (success-rgba mirror of the polish-3 warm recipe).
    - Otherwise suppress.
  - §13 binding rules 01–10.
- **`admin-polish-1..4` output** — canonical implementations:
  - **§3 entity-detail header stack:** `app/lite/admin/companies/[id]/page.tsx` (polish-4 output, lines ~331–397) — mirror for the quote editor header. Drop the meta-item `<dl>` in favour of a compact Righteous-labelled status-line if space is tight (two-pane editor has less horizontal real estate than a centered detail view).
  - **Tab/pill-strip pattern for device toggle:** `components/lite/admin/companies/company-tab-strip.tsx` (polish-4) — the preview-pane's mobile/desktop device toggle is a direct analogue. `layoutId="quote-preview-device"` spring.
  - **§5 status chip TONE map:** `components/lite/invoices/invoice-status-badge.tsx` (polish-3) + `components/lite/admin/companies/company-status-badge.tsx` (polish-4). Seven states instead of five; palette:
    - `draft` → neutral (rgba(128,127,115,0.15) / neutral-500)
    - `sent` → pink (rgba(244,160,176,0.10) / brand-pink)
    - `viewed` → orange (rgba(242,140,82,0.14) / brand-orange) — "they're looking"
    - `accepted` → success (rgba(123,174,126,0.14) / success)
    - `expired` → neutral-orange (rgba(242,140,82,0.10) / neutral-500, no strike — expired isn't a failure, it's dormancy)
    - `withdrawn` → neutral + strike
    - `superseded` → neutral + strike + Righteous caption "→ Q-{replacing_number}"
  - **§6 entity-card recipe:** polish-2 products detail + polish-4 companies hero — `var(--color-surface-2)` / 12px / 18–20 padding / `var(--surface-highlight)`.
  - **§7 table recipe:** polish-3 invoices index + polish-4 linked panels.
  - **§11 warm banner:** polish-3 invoices page + errors page recipe. **§11 cool banner:** polish-4 companies archived (darker, quieter variant).
  - **Send modal morph:** `components/lite/quote-builder/send-quote-modal.tsx` — **already has `layoutId` morph from the editor's Send button (QB-3 output).** Do not rewire. Chrome around the modal should align to the admin-interior palette if it doesn't already; verify during G1.
  - **Rule 09 hover ease:** `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` on every interactive surface. **The editor has dozens of hover surfaces — this is where rule-09 regresses most reliably. Call it out upfront.**
- `docs/superbad_brand_guidelines.html` — palette / typography source of truth.

**Inherit-patterns (verbatim from `admin_polish_inherit_patterns_across_wave` in PATCHES_OWED, unchanged through polish-4):**

1. Header stack = Righteous eyebrow/crumbs (10px / 2px tracking) + Black Han Sans H1 (40px / -0.4px) + DM Sans deck with Playfair italic brand-pink mutter + Righteous-labelled meta row.
2. `var(--surface-highlight)` on every elevated surface — never inline the literal.
3. Entity-card recipe — surface-2 / 12px / 18-20 padding / hover cues on clickable cards only.
4. Stale-halo keyframe reusable at card level; **not on table rows** (polish-3 locked).
5. Righteous for all chips/badges/eyebrows at 10–11px / 1.5–1.8px tracking. BHS reserved for display H1 + §9 paid-moment values only — one earned moment per surface.
6. Rule 09 hover everywhere — `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` or `houseSpring`; never plain Tailwind `transition`.
7. Ladder discipline on alert bodies — neutral-300 body, neutral-500 italic footer; cream reserved for BHS + primary-action + §9 headline-tile values.
8. Tables inherit §7 verbatim (polish-3 locked) — Righteous 10px / 2px-tracking headers on 5% cream bottom border; `rgba(253,245,230,0.03)` row hairlines; row hover `rgba(253,245,230,0.025)` **when rows are actionable**; numeric columns Righteous with letter-spacing.
9. Warm/cool/good alert banner recipes (polish-3 warm, polish-2/4 cool, polish-5 introduces good via the accepted banner).

## 3. Acceptance criteria

```
Binding rules 01–10 (verbatim from mockup §13) apply. Session-specific clarifications:

- Left-pane chrome: each section wraps as a §6 surface-2 card with Righteous section-label eyebrow + neutral-300 body. Input chrome = native + token styling (polish-3 invoices filter precedent). No library component imports for section panels.
- Right-pane chrome only. **Preview payload untouchable** — QB-2b's `preview-pane.tsx` owns the payload; polish-5 edits only the surrounding frame (device toggle, zoom controls, pane-container padding/border). The `mode: live | modal-preview` split from QB-4a must not regress.
- Line-items table: §7 recipe. Row hover applies (rows are editable — click/focus to edit). Remove-button per row uses ghost styling (`feedback_earned_ctas_at_transition_moments`: destructive is never primary).
- Totals card: one earned §9 BHS moment on the grand-total value when `status === "accepted"`. Otherwise Righteous tabular-nums cream.
- Send button: earned CTA per §8 — brand-red Righteous-capped with `--inner-highlight` + glow. Already morphs via `layoutId="quote-primary-action"` into the Send modal (QB-3 output); do not rewire.
- Catalogue picker popover: §6 surface-2 card, Righteous category filter, native search input with token styling. Preserve BaseUI Popover integration — chrome only.
```

## 4. Skill whitelist

- `tailwind-v4`
- `framer-motion` — device toggle `layoutId`, status-banner `AnimatePresence`.
- `react-19`
- `baseline-ui`

## 5. File whitelist (G2 scope discipline)

- `components/lite/quote-builder/quote-editor.tsx` — `edit` — visual chrome only (section cards, toolbar, header). **Do not touch** the `Server Action → state` wiring (QB-2a output), the debounced save (QB-2a), or the Send flow wiring (QB-3).
- `components/lite/quote-builder/preview-pane.tsx` — `edit` — frame chrome only (device toggle, container card, zoom controls if present). **Do not touch** the preview payload render (QB-2b output).
- `components/lite/quote-builder/catalogue-picker.tsx` — `edit` — popover chrome + list row visual polish. Popover trigger + selection logic untouched.
- `app/lite/admin/deals/[id]/quotes/[quote_id]/edit/page.tsx` — `edit` — §3 header (crumbs + BHS quote id + status chip + deck + meta row) + conditional §11 banners (expired / superseded / accepted). Server data loading untouched.
- **May add** `components/lite/quote-builder/quote-status-badge.tsx` if a `QuoteStatusBadge` doesn't already exist — grep first. If adding, mirror `InvoiceStatusBadge` TONE-map pattern verbatim.
- **May NOT touch** `send-quote-modal.tsx` beyond chrome alignment — the `layoutId` morph and drift-check UI are QB-3 output.

**Explicitly not touched:**

- `components/lite/quote-builder/send-quote-modal.tsx` — chrome-only alignment if needed; no morph / drift-check / logic changes.
- `components/lite/quote-builder/quote-accept-block.tsx`, `quote-payment-element.tsx`, `quote-web-experience.tsx`, `quote-status-card.tsx` — **public quote surface**, not admin. Out of scope; these belong to a future intro-funnel / public-quote polish wave.
- `app/lite/admin/deals/[id]/quotes/new/page.tsx` — entry redirect, no visual surface.
- `lib/quote-builder/**` — no behavioural change.
- Server Actions (`updateDraftQuoteAction`, `prepareSendQuoteAction`, `sendQuoteAction`, `applyQuoteTemplateAction`, `redraftIntroParagraphAction`) — chrome-invisible; no edits.
- All tests unless a behavioural regression surfaces.
- Polish-1..4 output (pipeline, products, invoices/errors, companies, deal-card drill-through) — reference, do not mutate.

## 6. Settings keys touched

- **Reads:** none newly added. If `quote.default_expiry_days` or similar surfaces as a displayed literal in the header, verify it routes through `settings.get()` per polish-3/4 discipline; otherwise log to PATCHES_OWED.
- **Seeds:** none.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `mockup-admin-interior.html` exists — `ls mockup-admin-interior.html`.
- [ ] Quote editor target exists — `ls app/lite/admin/deals/[id]/quotes/[quote_id]/edit/page.tsx`.
- [ ] Quote editor + preview components exist — `ls components/lite/quote-builder/quote-editor.tsx components/lite/quote-builder/preview-pane.tsx components/lite/quote-builder/catalogue-picker.tsx`.
- [ ] Polish-3/4 anchors intact — `ls components/lite/invoices/invoice-status-badge.tsx components/lite/admin/companies/company-status-badge.tsx components/lite/admin/companies/company-tab-strip.tsx`.
- [ ] Baseline test suite green — `npm test` (expected 832 / 1 skipped per `admin-polish-4` handoff).
- [ ] **Confirm spec filename** — `ls docs/specs/quote-builder.md` — correct silently per `feedback_technical_decisions_claude_calls` if wrong.
- [ ] **Confirm schema** — `lib/db/schema/quotes.ts` (or similar) to lock `quotes.status` enum values + identifier column (`number` vs `quote_number` vs `identifier` — brief guesses `number`; verify).
- [ ] **Confirm QB-3 Send modal morph is live** — `grep layoutId.*quote-primary-action components/lite/quote-builder/` returns hits.
- [ ] **Grep for existing `QuoteStatusBadge` / equivalent** before creating the §5 chip. `quote-status-card.tsx` exists per polish-4 preflight — read it to decide: extract-and-rename, or inline new badge.
- [ ] **Identify all plain `transition` classes on editor-adjacent files** — `grep 'className="[^"]*\\btransition\\b[^"]*"' components/lite/quote-builder/quote-editor.tsx components/lite/quote-builder/preview-pane.tsx components/lite/quote-builder/catalogue-picker.tsx`. Rule 09 regression hotspot — log the list upfront; convert each to `transition-[colors|opacity|transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` as part of the chrome pass.

## 8. Rollback strategy (G6)

- [x] `git-revertable, no data shape change` — UI-only diff. No migration, no schema, no settings, no kill-switch, no new env, no contract change. Rollback = `git revert <commit>`.

## 9. Definition of done

- [ ] `/lite/admin/deals/[id]/quotes/[quote_id]/edit` renders §3 entity-detail header (crumbs + BHS quote-number H1 + status chip + voiced deck + Righteous meta row) + conditional §11 banners (expired / superseded / accepted) + left-pane §6 section cards + §7 line-items table (actionable rows → hover active) + Totals card with conditional §9 BHS on accepted + polished right-pane preview frame (device toggle on `layoutId`, container chrome) + catalogue-picker popover polish.
- [ ] Send button still morphs into Send modal via `layoutId="quote-primary-action"` (QB-3 output unbroken).
- [ ] Preview payload render is byte-identical (QB-2b output unbroken). Device toggle still flips mobile/desktop frame widths.
- [ ] Every status surfaces as a §5 chip (Righteous, ≥1.5px tracking, TONE-tinted).
- [ ] One earned §9 BHS moment — grand-total value on accepted quotes only (rule 05).
- [ ] **All interactive surfaces use rule-09 easing — zero plain `transition` classes on hover affordances** (this is where polish-1/2 regressed; explicit gate here).
- [ ] All tabular numerics use Righteous with letter-spacing (rule 10).
- [ ] Alert-body copy uses neutral-300 (polish-2/3/4 ladder discipline), not cream.
- [ ] `min-h-screen bg-background` not reintroduced (admin-chrome-1 owns root).
- [ ] One rule-07 page mutter on the hero deck (conditional on status); no per-section mutter unless the empty line-items state voices itself (§8 rule).
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green.
- [ ] `npm run build` → clean.
- [ ] G10 parity screenshots vs mockup §3 / §6 / §7 / §11 — in handoff, or deferred to PATCHES_OWED with standard friction note.
- [ ] G10.5 external reviewer verdict verbatim; any notes → in-session fix + PATCHES_OWED non-blockers.
- [ ] Memory-alignment declaration in handoff covering: `feedback_visual_references_binding`, `feedback_motion_is_universal`, `feedback_primary_action_focus`, `feedback_individual_feel`, `feedback_felt_experience_wins`, `feedback_no_content_authoring`, `feedback_technical_decisions_claude_calls`, `project_context_safety_conventions`, `feedback_earned_ctas_at_transition_moments`.
- [ ] G0 → G12 run cleanly; handoff at `sessions/admin-polish-5-handoff.md`.
- [ ] `SESSION_TRACKER.md` **🧭 Next Action** advanced to `admin-polish-6` (Settings shells — catalogue, quote-templates, generic settings).
- [ ] `sessions/admin-polish-6-brief.md` pre-compiled (G11.b within-wave continuity).

## 10. Notes for the next-session brief writer (`admin-polish-6` — Settings shells)

- Scope is `/lite/admin/settings/*` — specifically `catalogue` (QB-2b output) + `quote-templates` (QB-2b output) + any generic settings shell. Each is an index/list surface + CRUD drawer or modal.
- Header pattern: §3 index-header variant (no BHS-display H1; Righteous eyebrow → slightly smaller Black Han Sans H1 like `Catalogue` / `Quote templates` → DM Sans deck with Playfair italic mutter conditional on list state).
- Tables: polish-3 §7 recipe. Row-hover active because each row opens a drawer / modal to edit.
- Empty states: voiced §8 — "No catalogue items yet." / "No templates yet." with pink mutter.
- CTA: brand-red "New item" / "New template" per §8 (earned CTA at the top of a creation-friendly surface).
- Generic settings shell is likely a §6 card of labelled sections with inline editors. No BHS display H1 unless the page needs it; Righteous H2-equivalent headers are fine at index level.
- Model tier: `/deep` if two of the three surfaces need chrome overhaul; `/quick` if it's mostly type/spacing ladder tightening. Assess at session kickoff.
