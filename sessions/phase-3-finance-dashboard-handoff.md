# Phase 3 — Finance Dashboard — Session Handoff

**Date:** 2026-04-13
**Phase:** 3 — Feature Specs
**Spec produced:** `docs/specs/finance-dashboard.md`
**Status:** LOCKED

---

## What was decided (9 locks)

1. **Headline:** P&L summary tile + 90-day projection chart, side-by-side desktop / stacked mobile.
2. **Projection:** Contracted MRR + pipeline-weighted open deals with stage-age decay (probability halves every 30 days past expected stage dwell). Trial shoots at 100%. Month-to-month subs flat over 90d.
3. **Expenses:** Manual quick-add + `recurring_expenses` auto-booking + daily Observatory rollup (API costs) + daily Stripe fee rollup (Balance Transactions). Recurring lands pending-review.
4. **Accountant bundle:** One export screen, one zip (BAS PDF + transactions CSV + expenses CSV + invoices CSV + P&L PDF + per-client CSV). Preset BAS quarters + EOFY + custom range. All CSVs show inc/gst/ex columns.
5. **Below fold:** Claude **Haiku** narrative + tiles (MRR & net run-rate / outstanding invoices / top 5 categories / recent transactions). Daily `finance_snapshots` row frozen at 06:00.
6. **Cockpit banners:** BAS-due, EOFY-due, invoice-overdue only. Tax-tight is dashboard-only (state, not action).
7. **Time-range:** One global picker, projection fixed 90d forward. Default This Month. URL-encoded for deep-linking.
8. **Drill-down:** Shallow. Detail screen per tile; row click-throughs route to owning feature. Narrative numbers are clickable links. Per-client pivot deferred to v1.1 with plumbing preserved.
9. **Tax provision:** Passive tile — GST owed / income tax provisioned / yours to spend (Stripe balance proxy). Dry narrative callout when tight. No auto-transfer, no open-banking in v1.

---

## Key primitives introduced

- **`expenses`** table — primary ledger for non-revenue flows. `source` enum distinguishes `manual` / `recurring` / `observatory_rollup` / `stripe_fees`. Upsert idempotency on `(source, source_ref)` for rollups.
- **`recurring_expenses`** table — declared recurring costs, cron-booked with `pending_review` status gate.
- **`finance_snapshots`** table — daily metrics + narrative frozen at 06:00. Historical comparisons pull from this.
- **`compliance_milestones`** table — BAS-filed / EOFY-filed markers for banner dismiss.
- **Six new `scheduled_tasks` task types** — `finance_snapshot_take`, `finance_narrative_regenerate`, `finance_observatory_rollup`, `finance_stripe_fee_rollup`, `recurring_expense_book`, `finance_export_generate`.
- **One new Haiku LLM job** — `finance-narrative`, registered with the model registry. Structured JSON output with number-reference validation at render time.
- **Two new Stripe integration jobs** — `stripe-balance-read`, `stripe-balance-transactions-read`, registered through Observatory's integration registry pattern.

---

## Cross-spec flags for Phase 3.5

1. **Daily Cockpit** — `getHealthBanners()` gains 3 new kinds: `finance_bas_due`, `finance_eofy_due`, `finance_invoice_overdue`. Consolidated with Observatory's 5 additions. Patch owed.
2. **Daily Cockpit** — confirm `maybeRegenerateBrief()` accepts a `subject` discriminator (brief / rail / finance_narrative). If not, Finance Dashboard owns a parallel `maybeRegenerateFinanceNarrative()` with identical semantics.
3. **Branded Invoicing** — `/lite/invoices` route must accept `?filter=overdue` query param. Patch if missing.
4. **Cost & Usage Observatory** — add `finance-narrative` job to model registry example table in §7. Confirm integration registry covers `stripe-balance-read` and `stripe-balance-transactions-read` as generic read jobs.
5. **Setup Wizards** — add `finance-tax-rates` step to the primary admin onboarding `WizardDefinition`. Two `numeric_preset` inputs writing `finance.gst_rate` and `finance.income_tax_rate`.
6. **`activity_log.kind`** gains 8 new values: `finance_expense_created`, `finance_expense_updated`, `finance_expense_confirmed`, `finance_recurring_booked`, `finance_recurring_created`, `finance_recurring_paused`, `finance_export_generated`, `finance_bas_filed`.
7. **Puppeteer PDF pipeline (Branded Invoicing §9)** — confirm supports multi-document export (export bundle renders 2 PDFs + 4 CSVs then zips). If currently single-document, patch to support batch render or Finance Dashboard wraps it.

---

## Settings keys introduced (11 total)

All registered in `docs/settings-registry.md` at Phase 3.5 step 7a:

- `finance.gst_rate` (0.10)
- `finance.income_tax_rate` (0.25)
- `finance.bas_reminder_days_ahead` (14)
- `finance.eofy_reminder_days_ahead` (30)
- `finance.overdue_invoice_threshold_days` (30)
- `finance.outstanding_invoices_threshold_aud` (5000)
- `finance.snapshot_time_local` ("06:00")
- `finance.projection_horizon_days` (90)
- `finance.stage_age_decay_halflife_days` (30)
- `finance.recurring_review_debounce_hours` (168)
- `finance.export_retention_days` (90)

---

## Sprinkle claims

Two claims from `docs/candidates/sprinkle-bank.md` (to mark `[CLAIMED by finance-dashboard]`):

- **Narrative opening lines** — rotation pool (~6 per month-state) on the dashboard narrative card.
- **Browser tab titles** for `/lite/finance/*` routes — state-aware treatment.

No hidden eggs on this surface in v1 — it's a working tool, not a delight target.

---

## Content mini-session owed

Small-to-medium. See `docs/specs/finance-dashboard.md` §12 for full scope. Must run before Phase 5 Session C.

Key calibrations:

- Narrative prompt against 8–10 synthetic scenarios (growth / loss / uneven / tax-tight / slow projection / overdue-heavy / first profitable month / BAS-week / EOFY-week / recurring-booked-reminder).
- Tax-tight callout phrasing pool (~5 variants).
- 3 BAS banner variants stratified by days-remaining (14d calm / 7d neutral / 3d firm).

Output commits to `docs/content/finance-dashboard.md`.

---

## Build sessions (Phase 5 sizing)

Four sessions, dependency-ordered:

- **A** — Data model + manual expense entry + settings seeding (~medium context)
- **B** — Projection logic + roll-up crons + recurring expense booking (~medium, Stripe Balance API integration)
- **C** — Dashboard UI + narrative prompt + drill-downs (~large, has the LLM wiring)
- **D** — Accountant bundle + cockpit banners + onboarding step (~medium, has the PDF generation)

Rollback strategy per session in spec §11.

---

## Decisions deferred

- Per-client P&L pivot → v1.1 (data plumbing already in place).
- Bank-balance integration (Basiq/Plaid) → v1.1. Stripe balance is v1 proxy.
- Active "move to savings" tax transfer → v1.1, depends on bank-balance.
- Expense category editor UI → v1.1. Closed list in v1.
- Receipt OCR → v1.1.
- Xero / MYOB direct sync → v1.1+, own brainstorm.
- Multi-currency, multi-staff, forex, international GST → post-v1 as needs arise.
- Narrative validation behaviour on number-reference mismatch → currently "fall back to bare figures + log to Observatory". Phase 5 Session C confirms user-facing copy for the fallback.

---

## Honest notes

- The narrative is load-bearing. If the Haiku prompt drifts, the dashboard's value collapses to tiles. Content mini-session must do real calibration, not vibe-check.
- Stripe fee rollup has edge cases (refunds, disputes, chargebacks). Balance Transactions API is authoritative but the mapping from event type → expense row needs careful handling. Flag for Phase 5 Session B.
- Stage-age decay needs the Pipeline spec's stage-probability defaults. If Sales Pipeline spec doesn't define them explicitly, Finance Dashboard defines a default map in settings (stored as JSON in one `finance.stage_probability_defaults` key — not in §5 table because it's a map, not a scalar; will be spelled out in Phase 5 Session B with Andy's review of the defaults).
- Tax provisioning is copy-sensitive. The dashboard must never imply it's giving tax advice. Content mini-session must pass a dry/sober lens for this tile specifically.
- Finance Dashboard is the **first spec with no client-facing surface at all** — even Observatory touches subscribers through sticky bars. This one is pure operator. Makes it lower-stakes from a brand-voice perspective but raises the bar on operator-voice (dry, factual, roommate-not-bartender).

---

## Next recommended session

**Hiring Pipeline** (Phase 3 backlog #16). Then Six-Week Plan Generator (#19). Then Phase 3.5 review.

With Finance Dashboard locked, all five core areas of SCOPE.md have specs in the works: lead gen (Lead Generation, Intro Funnel), sales (Sales Pipeline, Quote Builder, Branded Invoicing), client mgmt (Client Management, Client Context Engine, Brand DNA, Content Engine), daily planning (Daily Cockpit, Task Manager, Unified Inbox), SaaS billing (SaaS Subscription Billing, Setup Wizards, Cost Observatory, Finance Dashboard).
