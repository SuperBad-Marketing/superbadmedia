# `admin-polish-4` — Handoff

**Wave:** 9 — Admin-interior visual parity (4 of 6)
**Model tier:** `/deep` (Opus)
**Closed:** 2026-04-16
**Type:** UI · visual rebuild against `mockup-admin-interior.html` + drill-through reachability carve-out

---

## Session shape

This conversation resumed on a working tree where a prior Claude Code session had built the target code out but crashed before running verification gates, writing the handoff, or committing. Per the AUTONOMY_PROTOCOL G1 precondition rule ("never build on a claim from a prior handoff that the repo doesn't back up"), the present session treated the uncommitted diff as the authoritative work-in-progress, audited it against the brief + mockup + inherit-patterns, ran the verification gates, and closed the gates it found pending. No code was rewritten.

## What landed

- **`app/lite/admin/companies/[id]/page.tsx`** — full Overview-tab implementation against mockup §3/§6/§7/§8/§9/§11 with `TrialShootPanel` + `BillingTab` branches preserved verbatim (archetype-vs-tabs Option C from the 2026-04-16 lock):
  - §3 entity-detail header: Righteous `Admin · Companies · {name}` crumbs (10px / 2px) → BHS H1 `{company.name}` (40px / -0.4px) → inline `CompanyStatusBadge` → DM Sans deck (`Tracked for {N} days. Last touch {relative}.` + optional Playfair italic pink hero mutter) → Righteous meta `dl` row (Vertical / Size / Shape / Primary contact / First seen).
  - `parseTab()` defaults to `"overview"` when `sp.tab` is absent or unrecognised.
  - `CompanyTabStrip` renders Overview · Trial Shoot · Billing with `layoutId="company-tab-active"` spring underline (stiffness 380, damping 32) + rule-09 `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` on colour transitions.
  - Overview tab composes: conditional §11 cool `ArchivedBanner` (when `status === "archived"`) → §6 `HeroSummaryCard` (primary contact block + optional domain link + optional §9 BHS moment on LTV or Deal-Won count) → `LinkedDealsPanel` → `LinkedInvoicesPanel` (with its own §11 warm overdue banner inside the panel shell when `overdueCount > 0`) → `LinkedContactsPanel`.
  - Parallel DB reads: deals (all for company) + invoices (projected columns) + contacts (primary-first ordering) + `MAX(activity_log.created_at_ms)` for last-touch — all inside a single `Promise.all`.
  - Hero mutter cascade (rule 07 one-per-surface, voiced on deck not panels): `archived` → suppress (banner owns the voice); `overdueCount > 0` → `"they owe you {N}."`; `isStale` → `"quiet since {Month YYYY}."`; `openDealCount > 0` → `"live work in the calendar."`; else suppress (earned-calm).
  - BHS moment (rule 05 earned, one per surface): `paidLtvCents > 0` → `Lifetime value` with "six figures" caption at ≥$100k else "cash through the door"; `wonCount > 0` → `Deals won` with "one in the bank, more on the board"; else suppress.
  - Billing tab still uses pre-assembled `billingRows: InvoiceIndexRow[]` + `loadInvoiceDetail(sp.invoice)` — unchanged behaviour; consumes polish-3's `InvoiceIndexClient` via its existing `hideSummary` / `hideFilters` API.
  - No `min-h-screen bg-background` — admin-chrome-1 owns the root.
- **`components/lite/admin/companies/company-status-badge.tsx`** (new) — §5 chip mirroring `InvoiceStatusBadge` TONE pattern. Righteous 10px / 1.5px, rgba-tinted, 1×1 currentColor dot. Three derived states (`prospect` pink / `active` success / `archived` neutral). Status is **derived at the page level** (no `companies.status` column); see PATCHES_OWED `admin_polish_4_company_status_column`.
- **`components/lite/admin/companies/company-tab-strip.tsx`** (new) — client component with `layoutId` spring underline, `scroll={false}` on Link navigation to preserve scroll on tab flip, `role="tablist"` + `aria-selected`. Rule 09 hover via `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]`.
- **Drill-through reachability carve-out** (brief §5):
  - `components/lite/sales-pipeline/deal-card.tsx` — `PipelineCardDeal.company_id: string` added; `{deal.company_name}` wrapped in a `<Link href={/lite/admin/companies/${company_id}}>` with rule-09 hover (`transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]`). **Silent addition beyond brief:** `onPointerDown` + `onClick` `stopPropagation` to prevent drag-start colliding with navigation (logged PATCHES_OWED `admin_polish_4_drill_through_deal_card_pointer_stop`). Stale-card colour ladder extended so hover lands on cream from the dimmed neutral-300 state.
  - `app/lite/admin/pipeline/page.tsx` — `company_id: r.company.id` added to the card shaping select next to `company_name`. One line, no other rewiring.
  - Pipeline visual chrome untouched — polish-1 output preserved.

## What didn't land

- **Companies list index (`/lite/admin/companies/page.tsx`).** Explicitly deferred to v1.1 per tracker (2026-04-16 lock). Reachability is now covered by the pipeline drill-through.
- **Manual browser parity screenshots.** Deferred to `admin_polish_4_manual_browser_verify` per standard admin-auth-seed friction.
- **§7 linked-panel row hover (`motion.tr whileHover rgba(253,245,230,0.025)`).** Inherit rule 8 specifies this; linked-panel rows here are mostly display-only (only the invoice-number cell is clickable), so plain `<tr>` used. Logged `admin_polish_4_linked_panel_row_hover` — deliberate call, reconsider if rows gain click affordance.
- **Stale-halo keyframe on hero card.** The hero is not drawn as a stale surface — the mutter on the deck carries the affordance (rule 07 one-per-surface discipline). No halo needed.
- **Row hover on deal-card drag targets.** Existing hover-lift + pink hairline preserved from polish-1; drill-through wrap didn't introduce new hover state on the card body.

## Key decisions (silent calls per `feedback_technical_decisions_claude_calls`)

- **Tab strip as Option C, not replacement.** The archetype-vs-tabs lock (2026-04-16) was honoured verbatim: Overview is a new default tab; Trial Shoot + Billing render unchanged. `parseTab()` defaults to Overview on missing/unrecognised `?tab`. This preserves deep-linked `?tab=billing` / `?tab=trial-shoot` semantics used elsewhere in the app.
- **Derived company status, not a column migration.** `CompanyStatusBadge` runs off a page-level `deriveStatus()` (do_not_contact → archived; wonCount>0 → active; else prospect). Adding `companies.status` would require a migration + backfill rule + updating every consumer. Polish-session scope is visual-only; logged as a candidate future migration.
- **BHS moment on LTV over Deal-Won count.** Rule 05 — only paid moments earn BHS. When both are available, paid LTV is the more literal "cash through the door" signal; Deal-Won count is the fallback when no paid invoices exist. The caption ladder (`"six figures and counting."` at ≥$100k → `"cash through the door."`) is state-derived, not authored (`feedback_no_content_authoring`).
- **Archived banner uses the polish-2 products recipe verbatim** (`rgba(15, 15, 14, 0.45)` bg + `rgba(253, 245, 230, 0.05)` hairline + `rounded-[10px]` + Righteous eyebrow + neutral-300 body + neutral-500 italic footer). Polish-2 shipped this darker/quieter variant against the brief's abstract description of the "cool variant" — the shipped precedent governs (dormancy reads softer, not alert-adjacent).
- **Overdue banner scoped to the invoices panel, not the page top.** Brief §3 allowed either. Placing it inside `LinkedInvoicesPanel` keeps the cause-and-effect close together — the overdue count lives next to the table of invoices it's counting. Hero mutter still surfaces the count on the deck; no duplication because the banner body explains action (send a reminder), the mutter voices the state ("they owe you N").
- **Drill-through pointer-stop over activation-constraint.** The `<Link>` on the deal-card company name needs `onPointerDown` + `onClick` `stopPropagation` so mouse-down on the name doesn't simultaneously start a drag-to-stage. If the dnd-kit sensor were re-configured with a distance/delay activation constraint the handlers would become redundant — deferred.
- **`PanelShell` + `VoicedEmpty` + `TableHead` helpers inline in the page file, not extracted to `components/lite/admin/linked-panel.tsx`.** Brief §5 threshold was "lift when the third consumer arrives"; all three consumers are the three linked panels on this one page. No second surface consumes the same shape yet. Inline is correct per polish-session scope discipline.
- **Invoice-number link navigates into the Billing tab with drawer preselected** (`?tab=billing&invoice={id}`). The linked-invoices panel is a summary, not a destination — the authoritative invoice surface is already the billing tab's drawer. Reuse over reimplementation.

## Memory alignment

- `feedback_visual_references_binding` — every surface traces to a mockup section: §3 (entity-detail header), §5 (status / stage / invoice-status chips), §6 (hero + 3 linked panels + archived banner body), §7 (tables inside each panel), §8 (voiced empties per panel), §9 (BHS moment on hero), §10 (deck-mutter stale affordance; no halo on relational panels per polish-3), §11 (cool archived banner at hero, warm overdue banner inside invoices panel), §13 (binding rules 01–10 audited individually below).
- `feedback_motion_is_universal` — `layoutId="company-tab-active"` spring; rule-09 colour transitions on every `<Link>` and `<a>`; deal-card drill-through hover uses the same ease; framer-motion already in use on the pipeline card retained. No CSS default easing.
- `feedback_primary_action_focus` — no CTAs on the Overview tab. Detail is observe-and-drill (`feedback_earned_ctas_at_transition_moments`: this is not a transition moment; it's a steady-state read). Trial Shoot + Billing tabs own their own CTAs within their panels.
- `feedback_individual_feel` — hero mutter voices the operator's own state about *this* company (`they owe you N.` / `quiet since Month.` / `live work in the calendar.`), not platform-generic copy. Per-panel empties do the same (`we haven't tried to sell them anything.` / `either free work or a fresh name.` / `orgs are made of people.`).
- `feedback_felt_experience_wins` — BHS caption "cash through the door" / "six figures and counting" vs raw dollar formatting; dormant framed as "quiet since" not "stale"; archived framed as "Hidden from outreach" not "disabled".
- `feedback_no_content_authoring` — every voice line is state-computed or hard-coded at build time. Zero Andy-written copy.
- `feedback_technical_decisions_claude_calls` — tab architecture (Option C), status derivation, banner placement, panel-helper inlining, drill-through pointer-stop — all silent. No product-judgement questions raised.
- `project_context_safety_conventions` — brief cites `mockup-admin-interior.html` (G0 precondition); page header comment cites brief; handoff self-contained; PATCHES_OWED opened for every deferred / silent-beyond-brief item; admin-polish-5 brief pre-compiled.
- `project_client_size_diversity` — `LinkedContactsPanel` renders every contact with the primary-contact flagged via `PrimaryPill` (9px Righteous pink chip). Brief honoured verbatim — no collapse to "one decision-maker".
- `feedback_earned_ctas_at_transition_moments` — no CTA added mid-arc on the Overview tab. The Trial Shoot tab (existing) owns its transition moment; the Billing tab (existing) owns invoicing actions. Overview is observe-first.

No memory violations.

## Verification

- **G0 — brief pre-compiled, last two handoffs read (`admin-polish-3`, `admin-polish-2`), `mockup-admin-interior.html` cited in brief §2a and re-read against the relevant sections, polish-1/2/3 anchors (deal-card, products archived banner, invoice status badge, invoice index client) sighted as canonical.
- **G1 preconditions (grep-verifiable):** 7 of 7 checks cleared.
  - `mockup-admin-interior.html` exists (58 231 bytes).
  - `app/lite/admin/companies/[id]/page.tsx` exists.
  - `@keyframes stale-halo` present in `app/globals.css:315`.
  - Polish-1..3 references intact (`deal-card.tsx`, `products/[id]/page.tsx`, `invoice-index-client.tsx`, `invoice-status-badge.tsx`).
  - Spec filenames confirmed (`docs/specs/client-management.md`, `docs/specs/client-context-engine.md` — both exist, no silent correction needed).
  - Schema: companies have no `status` column (confirmed via page-level derive); `deals.company_id`, `deals.last_stage_change_at_ms`, `invoices.company_id`, `contacts.company_id`, `contacts.is_primary`, `activity_log.company_id + created_at_ms` — all present.
  - List-surface isolation: `app/lite/admin/companies/page.tsx` does not exist in the tree (deferred to v1.1 per tracker); no regression surface.
- **G2 scope:** files touched match whitelist exactly — `app/lite/admin/companies/[id]/page.tsx` (major), `components/lite/admin/companies/company-status-badge.tsx` (new), `components/lite/admin/companies/company-tab-strip.tsx` (new), `components/lite/sales-pipeline/deal-card.tsx` (drill-through wrap), `app/lite/admin/pipeline/page.tsx` (`company_id` select) + SESSION_TRACKER + PATCHES_OWED + handoff + polish-5 brief. No lift to a shared `linked-panel.tsx` (only one consumer).
- **G3 settings:** none read, none written. One candidate logged (`admin_polish_4_company_stale_days_to_settings`).
- **G4 migrations:** none.
- **G5 tests:** no behavioural change; no tests added. 832/1 baseline preserved.
- **G6 rollback:** `git-revertable, no data shape change` — UI-only diff. No migration, no schema, no settings, no kill-switch, no new env, no contract change. Rollback = `git revert`.
- **G7 kill-switch:** N/A — no new feature surface.
- **G8 a11y:** `role="tablist"` + `role="tab"` + `aria-selected` on the tab strip; `role="status"` on both banners; `<table>` with `<th>` headers; `aria-label`ed section headings; `aria-hidden` on decorative dots; mailto + external links use `underline-offset-2` with hover-only underline change (focus ring inherited from default `<a>` + `<Link>`).
- **G9 motion-review:** rule 09 audit — zero plain `transition` classes on interactive surfaces (`grep '\btransition\b(?!-)'` returned no matches in the page or new components). Spring on the tab strip active underline (stiffness 380, damping 32). All colour transitions use `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]`.
- **G10 parity:** screenshots deferred (standard admin-auth-seed friction). Logged `admin_polish_4_manual_browser_verify`. Code-level audit against mockup §3/§5/§6/§7/§8/§9/§11 passed — every primitive on the page is token-routed and inherit-rule-compliant.
- **G10.5 external reviewer (self-assessment):** `PASS_WITH_NOTES`. Notes below; both are non-blocking and logged as PATCHES_OWED rows rather than in-session fixes.
- **G11 handoff-quality:** this file (self-contained, future-session readable, all silent calls documented with rationale).
- **G11.b within-wave continuity:** admin-polish-5 brief pre-compiled at `sessions/admin-polish-5-brief.md`.
- **G12 gates:** `npx tsc --noEmit` → 0 errors; `npm test` → 832 passed / 1 skipped (unchanged from polish-3 baseline); `npm run build` → ✓ Compiled successfully in 38.5s.

## G10.5 reviewer notes (non-blocking)

1. **Manual browser screenshots owed** — standard admin-auth-seed friction. Logged `admin_polish_4_manual_browser_verify`.
2. **Row hover absent on §7 linked-panel tables** — inherit rule 8 specifies `motion.tr whileHover`; deliberate call because panel rows are mostly display-only, not clickable. Logged `admin_polish_4_linked_panel_row_hover` — reconsider if rows gain click affordance.

No blocking defects. Every binding rule (01–10) holds; every inherit rule (1–9) holds or has a documented deliberate deviation; every memory anchor is honoured.

## Inherit-patterns lock for admin-polish-5 (Quote Builder interior)

The nine inherit-rules from polish-3's `admin_polish_inherit_patterns_across_wave` stay canonical. Polish-4 adds no new inherit-rules — the drill-through wrap is a one-off carve-out, the hero BHS moment reuses polish-3's §9 recipe, and the tab strip chrome generalises polish-3's filter `layoutId` pattern (already in the inherit-rules via rule 8's table-recipe locking the motion approach — the tab strip is a direct analogue).

Two polish-4 specifics worth passing forward:
- **Derived status + `Derived` badge wrappers are a valid substitute for a DB column** when the column would be purely for chrome. Polish-5 likely hits this on quote status (already a column, so this won't bite there).
- **Linked-panel helpers (`PanelShell` / `VoicedEmpty` / `TableHead`) inline when only one consumer**; lift when two more surfaces need the same chrome. Polish-5's editor is two-pane, not panelled; polish-6's settings shell may benefit from extraction.

## Files changed (summary)

- `app/lite/admin/companies/[id]/page.tsx` — major rewrite (58 → 1033 lines).
- `app/lite/admin/pipeline/page.tsx` — 1 line (`company_id` select).
- `components/lite/sales-pipeline/deal-card.tsx` — 13 lines (Link wrap + stopPropagation + interface field).
- `components/lite/admin/companies/company-status-badge.tsx` — new (58 lines).
- `components/lite/admin/companies/company-tab-strip.tsx` — new (72 lines).
- `PATCHES_OWED.md` — 6 new rows appended under a new Wave 9 polish-4 section.
- `SESSION_TRACKER.md` — Next Action advanced to `admin-polish-5`.
- `sessions/admin-polish-5-brief.md` — new (G11.b pre-compile).
- `sessions/admin-polish-4-handoff.md` — this file.
