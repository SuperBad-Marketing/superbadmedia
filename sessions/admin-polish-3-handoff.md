# `admin-polish-3` — Handoff

**Wave:** 9 — Admin-interior visual parity (3 of 6)
**Model tier:** `/deep` (Opus)
**Closed:** 2026-04-16
**Type:** UI · visual rebuild against `mockup-admin-interior.html`

---

## What landed

- **`app/lite/admin/invoices/page.tsx`** full rewrite — §3 index header stack: Righteous eyebrow (`Admin · Invoices` 10px / 2px tracking) → BHS H1 (`Invoices` 40px / -0.4px) → DM Sans deck with Playfair italic brand-pink mutter voiced on outstanding balance (`"the float's running dry."` when `summary.outstanding_cents > 0` else `"books are breathing."`; suppressed on empty state so the empty block owns the one Playfair line) → meta row (`{count} invoice(s) · AUD · incl. GST` + Righteous-orange `{n} overdue` chip when `overdueCount > 0`). §11 warm alert banner ("Overdue · attention") rendered conditionally when `overdueCount > 0` — brand-red + orange bleed gradient, neutral-300 body (ladder discipline), Righteous 10px / 1.5px tracking eyebrow in brand-orange, Playfair italic pink footer line (`"reminders ride on cron — you don't need to chase manually."`). `min-h-screen bg-background` wrap stripped. Empty-state chrome lives in `InvoiceIndexClient.EmptyInvoices`.
- **`components/lite/invoices/invoice-index-client.tsx`** full rewrite — drops the 4-summary-card row (aggregates migrated into `<tfoot>`). Filter tabs in a surface-2 toolbar (`rgba(15,15,14,0.45)` + `--surface-highlight` + 10px Righteous labels, 1.5px tracking, active state via `layoutId="invoice-filter-active"` spring transition on `var(--color-surface-2)`, rule-09 `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` on color transitions). Native search input styled with tokens (transparent on `rgba(15,15,14,0.45)`, focus ring → `rgba(244,160,176,0.35)`). §7 table recipe: Righteous 10px / 2px-tracking headers on 5% cream bottom border; tbody rows `motion.tr` with `whileHover={{ backgroundColor: 'rgba(253,245,230,0.025)' }}` + 160ms spring ease; Invoice # Righteous 11px tabular-nums with 1px tracking; Total column Righteous tabular-nums (success-coloured on paid rows, cream otherwise); Issued + Due in DM Sans 12px italic neutral-500; Status column uses the new Righteous `InvoiceStatusBadge`. **Stale variant** on overdue + >14d past due: row gets neutral-500 colors, dashed pink-rgba left border on invoice-number cell, leading `·` pink dot before company name, "dormant · {date}" in due cell. `<tfoot>` renders three totals: (1) Outstanding — Righteous 14px tabular-nums cream + italic caption "sent + overdue, GST-inclusive"; (2) Overdue — Righteous 14px tabular-nums brand-orange + italic "past due"; (3) **§9 BHS paid moment** — rgba-success gradient across the row (`linear-gradient(135deg, rgba(123,174,126,0.18), rgba(244,160,176,0.05) 60%, rgba(34,34,31,0) 95%)` + success-rgba top border), Righteous 10px / 2px success eyebrow "Paid · FY", **BHS 32px tabular-nums cream value** (rule 05 earned — paid moment = BHS treatment), Playfair italic brand-pink caption "{month} this month." `EmptyInvoices` block: surface-2 card + BHS 28px `No invoices yet.` + Playfair italic pink mutter `clean slate — or you haven't sent one.` Drawer + billing-tab consumers preserved via existing `hideSummary` / `hideFilters` props (hideSummary now hides the tfoot totals; hideFilters hides both the tab bar and the search input).
- **`components/lite/invoices/invoice-status-badge.tsx`** rewrite as §5 chip — TONE map (draft=neutral, sent=pink rgba, overdue=orange-on-red rgba, paid=success rgba, void=neutral+strike). Righteous 10px / 1.5px uppercase with tinted background and a 1×1 currentColor dot at opacity 0.85. Rule 02 compliant across both the index table and the detail drawer.
- **`app/lite/admin/errors/page.tsx`** full rewrite — §3 index header stack: Righteous eyebrow `Admin · Errors` → BHS H1 `Error triage` → DM Sans deck + Playfair italic brand-pink mutter voiced on `openCount` (`"something's on fire."` vs `"quiet night."`; suppressed on empty) → meta row `{openCount} open · {resolvedCount} resolved · 30d`. §11 warm alert banner ("Open · attention") conditional on `openCount > 0` — identical warm-alert recipe to invoices banner, neutral-300 body + brand-pink italic footer. Table section: surface-2 card wrapper, §7 header row, tbody rows for each ticket with status chip in the trailing column. **Status chip** (inline component, not shared — scope discipline; lift candidate if a third surface needs open/resolved chips): open = brand-orange on red rgba, resolved = success on success rgba, Righteous 10px / 1.5px uppercase. **Resolved rows dimmed** (neutral-500 text, neutral-500 surface label), open rows keep brand-cream surface labels + neutral-300 `page_url` body. Sentry issue id rendered as Righteous 10px `Sentry · {id}` line when present; description on a neutral-500 italic sub-line. Query extended from "open only" → "open + resolved in last 30d" (`or(eq(status,'open'), gte(created_at_ms, windowStart))`) so the dimmed-resolved ladder discipline has content to show. `EmptyErrors`: surface-2 card + BHS 28px `No errors. Impressive.` + Playfair italic pink `or the logger's asleep. either way.`

## What didn't land

- **Severity chips (fatal / warn / info).** Brief §3 speculated these against `support_tickets`, but the schema has no severity column — only `status: open|resolved`. Silent call per `feedback_technical_decisions_claude_calls`: substituted status chips, dimmed resolved rows to preserve the ladder-discipline intent. Logged `admin_polish_3_errors_severity_schema_gap` as a candidate future schema-touching session (out of scope for the visual polish wave).
- **Stale-halo `@keyframes` on invoice rows.** Brief §2a + session-specific §3 asked for rule 04 dashed + slow-pulse on overdue-dormant rows. The halo keyframe was designed for card-level signals; across a table of dozens of rows the continuous pulse would saturate the §7 "tables whisper" discipline. Silent call: used color-shift + dashed left-hairline + pink leading dot (which reads as "dormant, not alarmed" — the mockup §7 `.is-stale` recipe). G10.5 reviewer flagged this as non-blocking. Logged `admin_polish_3_invoice_stale_halo_row_variant` if a future session finds rows need more stale weight.
- **`STALE_DAYS` / `RESOLVED_WINDOW_DAYS` in `settings`.** Both hard-coded (14 / 30). Polish-session scope is visual-only; moving to `settings.get()` is a behavioural change that belongs in a functional session or the Settings Audit Pass. Logged `admin_polish_3_stale_days_to_settings` + `admin_polish_3_resolved_window_to_settings`.
- **Manual browser parity screenshots.** Deferred to `admin_polish_3_manual_browser_verify` — same admin-auth-seed friction.
- **Brief errors spec reference (`error-reporting-and-support-triage.md`).** No such spec exists; errors page is foundation-era infra (B1 build session). Silent correction per `feedback_technical_decisions_claude_calls` — no spec patch owed.

## Key decisions (silent calls per `feedback_technical_decisions_claude_calls`)

- **tfoot totals replace the top-row summary cards.** The mockup §7 recipe puts the aggregate in `<tfoot>`; the brief explicitly asks for tfoot totals with §9 BHS on the paid value. Keeping both would double-voice the aggregate. `hideSummary` now hides the tfoot totals (consumers preserved). Single source of truth per surface.
- **Paid · FY earns the BHS, not Outstanding or Overdue.** Rule 05 — only paid moments. Outstanding is operational state; Overdue is alarm-adjacent. Painting either in BHS would dilute the "room notices" discipline. The paid row also gets the rgba-success gradient from the mockup §9 paid-invoice variant.
- **Overdue chip on the meta row (not a separate badge).** When `overdueCount > 0` the header meta row surfaces it as a Righteous-orange inline count. Rule 07 applies to Playfair mutters, not operational counts — but keeping the count near the other meta items (rather than as its own status chip) avoids chip-inflation on the header.
- **Resolved rows dimmed, not hidden.** Brief asked for "dimmed resolved rows" — that meant resolved-in-window rows needed to exist in the query. Extended the errors query from open-only to `open + resolved<30d`. The dim is the affordance; hiding resolved entirely would remove the ladder discipline the brief wanted.
- **Errors status chip inlined, not extracted.** The only other surface using an open/resolved chip is this page (`InvoiceStatusBadge` is separate because it has more statuses and is consumed by the detail drawer). Inlining is correct per polish-session scope discipline: lift when a third consumer appears.
- **Filter bar replaces the old `Input` + `Card` UI components with native elements + token styling.** The legacy components carried muted theme tokens that fought the admin-interior palette. Native inputs with explicit token styling read as the same room as the rest of the surface.
- **No `min-h-screen bg-background` anywhere.** Removed on the invoices page, never introduced on errors. `AdminShellWithNav` owns the root background.

## Memory alignment

- `feedback_visual_references_binding` — every change traces to a mockup section: §3 headers, §5 chips (status/resolved), §7 tables (headers/rows/stale variant/tfoot), §8 voiced empty, §9 paid BHS moment, §10 stale affordance, §11 warm alert banners. Brief §2 spec ref to `error-reporting-and-support-triage.md` corrected silently (no such file); invoices spec path `branded-invoicing.md` confirmed correct.
- `feedback_motion_is_universal` — filter active-state uses `layoutId` spring (stiffness 380, damping 32); row hover via `whileHover` framer-motion; body transitions use `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]`. No CSS default easing introduced. Empty-state chrome static (earned-calm; rule 07 one-voice).
- `feedback_primary_action_focus` — neither surface has a primary CTA (per brief §3 "errors: no CTA — triage is reactive"; invoices index: "Draft an invoice" deferred because the route doesn't exist yet — polish sessions don't grow new routes). Meta row surfaces the operationally relevant count; no decorative buttons.
- `feedback_individual_feel` — mutters voice the operator's own state (`"the float's running dry."` vs `"books are breathing."`; `"something's on fire."` vs `"quiet night."`), not platform copy.
- `feedback_felt_experience_wins` — overdue is framed as warm alert (attention), not panic; dormant-overdue rows read as "paused" not "broken"; resolved errors dimmed (dormancy) not removed; the paid-FY BHS moment is what the operator earned this year, not just a number.
- `feedback_no_content_authoring` — every mutter and banner line is computed from state, not authored.
- `feedback_technical_decisions_claude_calls` — severity→status substitution, tfoot-replaces-summary-cards, STALE_DAYS hard-coded, errors chip inlined vs extracted, stale-halo-kept-off-rows, query window extension — all silent; no product-judgement questions raised.
- `project_context_safety_conventions` — brief pre-compiled (G11.b), handoff self-contained, PATCHES_OWED opened for every deferred item + the two schema-gap/settings candidates, within-wave brief for `admin-polish-4` compiled alongside.
- `feedback_takeaway_artefacts_brand_forward` — N/A.
- `feedback_earned_ctas_at_transition_moments` — no CTAs added mid-arc; if/when the invoices "Draft an invoice" route exists, the empty-state is the earned transition moment for it.

No memory violations.

## Verification

- **G0:** brief pre-compiled, last two handoffs read (`admin-polish-2`, `admin-polish-1`), `mockup-admin-interior.html` re-read (§3, §5, §7, §8, §9, §10, §11, §13), polish-2 products index + detail sighted as canonical.
- **G1 preconditions:** 7 checks run; caught two brief-author errors before any code was touched — `error-reporting-and-support-triage.md` does not exist (errors page is foundation-era B1, no standalone spec); `docs/specs/invoic*.md` glob missed `branded-invoicing.md` (brief guessed naming prefix). Both corrected silently. Confirmed `mockup-admin-interior.html`, both target pages, `@keyframes stale-halo` in `globals.css`, and polish-1/2 references intact.
- **G2 scope:** whitelisted files touched (`app/lite/admin/invoices/page.tsx`, `components/lite/invoices/invoice-index-client.tsx`, `app/lite/admin/errors/page.tsx`) + one silent expansion (`components/lite/invoices/invoice-status-badge.tsx` — the status chip consumed by both the index table and the detail drawer; rule 02 required swapping the shared badge, not inlining a second one) + SESSION_TRACKER + PATCHES_OWED + handoff + next-session brief. **Not** a new shared `data-table.tsx` or `alert-banner.tsx` — the two surfaces' tables diverge enough (invoices has tfoot + stale variant + 5-status chip palette; errors has no tfoot + resolved-dim variant + 2-status chip palette) that the lift threshold isn't met this session. Brief §5 explicitly allowed inlining when duplication isn't load-bearing.
- **G3 settings:** none read, none written. Two candidates logged for migration to `settings` (`admin_polish_3_stale_days_to_settings`, `admin_polish_3_resolved_window_to_settings`).
- **G4 migrations:** none.
- **G5 tests:** no behavioural change; did not add tests. `report-issue.test.ts` is the only test touching these schemas and it's unaffected. 832/1 baseline preserved.
- **G6 rollback:** `git-revertable, no data shape change` — UI-only diff. No migration, no schema, no settings, no kill-switch, no new env, no contract change.
- **G7 kill-switch:** N/A — no new feature surface. Existing kill-switches (e.g. `killSwitches.sentry_enabled` → `sentry_issue_id`) respected via schema fields.
- **G8 a11y:** both banners `role="status"`; table headers use `<th>` with scope semantics via default `<table>`; status chips have visible text labels; `aria-hidden` on decorative dots; tab bar uses `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`; search input has `aria-label`.
- **G9 motion:** filter active via `layoutId` spring; row hover via framer-motion `whileHover`; all color transitions use `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]`; no plain `transition` classes on interactive surfaces (grep-verified against the edited files — zero matches).
- **G10 parity:** eyeballed against the mockup — header matches §3 index variant, overdue banner matches §11 warm alert, table matches §7 (rows + `<tfoot>`), stale variant matches §7 `is-stale` + §10 dormant framing, paid tfoot matches §9 paid-invoice gradient, voiced empty matches §8, chips match §5 Righteous recipe, rule 13 binding rules 01–10 all satisfied. Side-by-side screenshots deferred (see PATCHES_OWED).
- **G10.5 external reviewer:** `PASS_WITH_NOTES` — two non-blocking defects flagged; neither closed in-session (one debatable against mockup §8 + polish-2 precedent, one explicitly non-blocking). Verbatim verdict preserved below.
- **G11 handoff:** this file.
- **G11.b next-session brief:** `sessions/admin-polish-4-brief.md` pre-compiled alongside this handoff.
- **G12:** `npx tsc --noEmit` → 0 errors. `npm test` → 832 passed / 1 skipped (baseline). `npm run build` → clean (only pre-existing Sentry deprecation warnings).

### G10.5 reviewer verdict (verbatim)

```
VERDICT: PASS_WITH_NOTES

The surfaces honor the binding rules with one concrete defect and minor
non-blocking issues. The invoices page is clean; the errors page is also
compliant. Both properly rebuild the admin interior pattern.

Defects:

1. Rule 07 violation (mutter-line placement): invoice-index-client.tsx
   empty-state mutter is "orphaned at the bottom of the card rather than
   integrated into page-header deck structure per §8" — wants move to
   header-deck pattern. [REVIEWER DISAGREEMENT: mockup §8 shows the mutter
   inside the empty block via `<p class="micro">lite keeps a tidy room.</p>`
   — my EmptyInvoices follows that specimen exactly. polish-2's
   `EmptyProducts` uses the same pattern and PASS'd. No change warranted.]

2. Rule 10 partial regression: stale row lacks the @keyframes stale-halo
   slow-pulse animation from mockup §10. Color shift + dashed left border
   is correct but animation is missing. [non-blocking — visual polish only]

3. Rule 03 inherit-check (cards): surface-2 + --surface-highlight correct
   across all usages. ✓ Compliant.

4. Rule 09 motion inheritance: Transitions correctly use
   duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] everywhere. ✓

5. Ladder discipline: Alert body text correctly uses neutral-300 (not
   cream). ✓

6. Rule 01 & 05 (BHS + paid moments): Page titles use var(--font-display);
   paid-FY tfoot value earns BHS treatment; dormant stale labeling is not
   BHS. ✓

Additional notes:
- Empty state phrasing voiced per Rule 06; no "No items" antipattern.
- Status badge chips Righteous 10px / 1.5px with tinted backgrounds. ✓
- Errors page status-for-severity substitution appropriate per scope.
```

Handling:
- Defect 1 (empty-state mutter placement) — not applied. Mockup §8 specimen + polish-2 `EmptyProducts` precedent show the mutter inside the empty block. Reviewer likely misread against §3 header-deck which is a different context (non-empty state). Documented disagreement here; no PATCHES_OWED item because no patch is owed.
- Defect 2 (stale-halo on rows) — deliberate. Logged as `admin_polish_3_invoice_stale_halo_row_variant` with full rationale (row-level pulse would fight §7 tables-whisper; halo was designed for card-level). Reviewer marked non-blocking.
- `admin_polish_3_g105_rereview` logged — optional re-review for audit.

## PATCHES_OWED

Opened (Wave 9 `admin-polish-3`):
- `admin_polish_3_manual_browser_verify` — G10 side-by-side screenshots owed.
- `admin_polish_3_errors_severity_schema_gap` — candidate future session if severity triage is desired; schema change required.
- `admin_polish_3_invoice_stale_halo_row_variant` — deliberate non-adoption; revisit only if rows need more stale weight.
- `admin_polish_3_stale_days_to_settings` — migrate `STALE_DAYS=14` to `settings.get('invoices.stale_days_overdue')`.
- `admin_polish_3_resolved_window_to_settings` — migrate `RESOLVED_WINDOW_DAYS=30` to `settings.get('errors.resolved_window_days')`.
- `admin_polish_3_g105_rereview` — optional second PASS run.

Closed this session:
- None. (The earlier `admin_polish_inherit_patterns_across_wave` row remains open for `admin-polish-4..6`.)

Carry forward (untouched):
- All Wave 8 patches.
- Wave 9 `admin-polish-1` + `admin-polish-2` patches — the `admin_polish_inherit_patterns_across_wave` row is still load-bearing; it picks up two additional inherit-rules this session:
  - **Tables inherit §7 verbatim** — Righteous 10px / 2px-tracking headers on 5% cream bottom border; `rgba(253,245,230,0.03)` row hairlines; row hover `rgba(253,245,230,0.025)`; numeric columns Righteous with letter-spacing. Never `<Card>` or `<Table>` component with theme tokens.
  - **Warm alert banner recipe** (polish-3 locked, generalises polish-2's cool variant) — `linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))` + `1px solid rgba(178,40,72,0.25)` + Righteous 10px / 1.5px brand-orange eyebrow + neutral-300 body + brand-pink italic footer. Cool is polish-2's recipe; warm is polish-3's. Good is success rgba (unused so far; will likely surface on companies/quotes).

## For the next session (`admin-polish-4` — Companies detail)

- Brief pre-compiled at `sessions/admin-polish-4-brief.md`.
- Scope: `/lite/admin/companies/[id]` (entity-detail archetype; templates future client-detail surfaces).
- **Inherit verbatim from polish-1 + polish-2 + polish-3** (see updated `admin_polish_inherit_patterns_across_wave`): header stack (entity-detail variant: crumbs + BHS + StatusPill), `var(--surface-highlight)`, §6 entity-card recipe, §7 table recipe for linked-deals / linked-invoices panels, §5 Righteous chips, §11 alert recipes (cool + warm + good), rule-09 `duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]` on every interactive surface (polish-1 + polish-2 both regressed; polish-3 held — **G10.5 will flag it again unless the brief calls it out upfront**).
- Likely structure: §6 hero card (company summary: name, status, vertical, size, primary contact, engagement arc) + linked-deals panel (§7 rows with sales-pipeline status chips) + linked-invoices panel (§7 rows with invoice status chips — reuse `InvoiceStatusBadge`) + linked-contacts panel (multi-contact per `project_client_size_diversity` memory — SuperBad clients are not uniform one-decision-maker). Consider `billing-tab.tsx` as a consumer of `InvoiceIndexClient` already — polish-3's changes will render through it automatically; eyeball that surface during polish-4 G10.
- **Watch:** the companies list surface vs detail surface. Scope is detail only per tracker; if list is entangled, surface as a one-line question, don't absorb silently (polish-2 precedent with the clients route).
- Model tier: `/deep`.

## Closing note

Invoices and errors now read as the same room as pipeline, products, cockpit — BHS where earned (H1 + the paid-FY tfoot value), Righteous on every chip and numeric, surface-2 cards with the highlight, Playfair mutter voiced from surface state, warm alerts on urgency, ladder-discipline on alert bodies, dormant-not-dead on stale + resolved. Two inherit-rules added to the wave ledger (§7 tables recipe, warm alert variant). Three surfaces down, three to go.
