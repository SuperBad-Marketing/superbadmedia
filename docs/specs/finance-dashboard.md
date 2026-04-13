# Finance Dashboard — Feature Spec

**Phase 3 output. Locked 2026-04-13.**

> **Prompt files:** `lib/ai/prompts/finance-dashboard.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

The Finance Dashboard is SuperBad Lite's operator-only financial visibility surface. One place inside Lite where Andy sees P&L, forward projections, expenses, outstanding invoices, tax provisioning, and accountant-ready exports — so he never has to open a spreadsheet or log into Stripe's dashboard to understand the state of the business.

Finance Dashboard is a **reading surface**. It aggregates data that already exists elsewhere (Stripe, `deals`, `invoices`, `external_call_log`, manual expense entries) and presents it with a dry-voice Claude narrative on top. It is not a CRM, not an accounting system, and not a substitute for an accountant — it's a daily glance that answers "am I making money this month, and how much of what's in Stripe is actually mine?"

**Operator-only for v1.** No client-facing financial views. Client-facing spend/ROI reporting is a natural v1.1 once the data plumbing is running.

---

## 1. Purpose and shape

The dashboard has two primary jobs, co-equal:

1. **Answer "how's the business?" in under five seconds.** Headline P&L + 90-day projection above the fold + a one-paragraph Claude-drafted narrative that reads the data and tells you the state in plain dry voice. Zero interpretation required by the reader.
2. **Be the accountant handoff surface.** Quarterly BAS and annual EOFY produce a single export bundle that the accountant can work from — no hand-compiling, no re-pulling from Stripe.

Three posture rules shape every sub-decision:

- **Felt-experience values stored, convention-compliant values derived at boundaries.** Every amount is stored GST-inclusive (the felt number per memory `feedback_felt_experience_wins.md`). BAS and EOFY exports derive ex-GST figures at the export boundary. No ambiguity on the dashboard; no ambiguity in the export.
- **Reading surface, not investigation tool.** Drill-downs are one-level-shallow — click a tile, get a list; click a row, jump to the owning feature (Branded Invoicing, Client Management, etc.). Finance Dashboard does not re-implement investigation that already lives elsewhere.
- **Estimates are labelled as estimates.** Income tax figures, projection numbers, and stage-weighted pipeline revenue are all estimates. Spec and UI copy never blur the line. Accountant is authoritative at EOFY.

---

## 2. The 9 locks (quick reference)

| # | Decision | Detail |
|---|---|---|
| Q1 | **Headline view** | P&L summary tile + 90-day forward projection chart, side-by-side on desktop, stacked on mobile. Above the fold. Answers "am I making money this month?" + "what does the next quarter look like?" in one glance. |
| Q2 | **Projection logic** | Contracted MRR (active retainers + active subscriptions, time-sliced over commitment tail) + pipeline-weighted open deals (stage probability × expected close date) with stage-age decay (probability halves every 30 days past expected stage dwell time). Booked trial shoots count at 100%. Month-to-month subs project flat over 90 days. |
| Q3 | **Expense entry** | Manual quick-add form for one-offs + `recurring_expenses` table with cron-booked monthly/quarterly/annual entries + auto-rolled daily entries from Observatory `external_call_log` and Stripe Balance Transactions API. Recurring rows land pending-review. |
| Q4 | **Accountant bundle** | One export screen at `/lite/finance/export`. Zip contains BAS summary PDF, transactions CSV, expenses CSV, invoices CSV, P&L PDF, per-client revenue CSV. Preset periods (quarterly BAS, EOFY) + custom range. All CSV rows show `amount_inc_gst`, `gst_amount`, `amount_ex_gst`. |
| Q5 | **Below-fold composition** | Claude-Haiku narrative card at top of scroll, then tiles: MRR + net run-rate / outstanding invoices / top 5 expense categories this period / recent transactions (mixed, last 20 rows). Daily `finance_snapshots` row stores frozen metrics + narrative. |
| Q6 | **Cockpit banners** | Only three escalate to `getHealthBanners()`: BAS due (2 weeks ahead), EOFY due (2 weeks ahead), and invoice-overdue (when any invoice >30 days overdue OR total outstanding > $5k threshold). Everything else is pull-only. |
| Q7 | **Time-range** | One global picker at page top controls P&L, tiles, expense breakdown, transactions, narrative. Projection chart is **immune** (always forward 90d). Default: This Month. Presets: This/Last Month, This/Last Quarter, This/Last FY, Custom. URL-encoded for deep-linking. |
| Q8 | **Drill-down depth** | Shallow. Each tile has a detail screen at `/lite/finance/<tile>` showing the list that composes it. Row click-throughs route to owning feature (invoice row → Branded Invoicing; subscription row → Client Management; expense row → edit-expense modal owned here). Narrative numbers are clickable links. Per-client pivot deferred to v1.1 with data plumbing preserved. |
| Q9 | **Tax provisioning** | Passive tile: GST owed this quarter (from invoices − expenses) + income tax provisioned (rate × net YTD profit) + "yours to spend" (Stripe balance − GST owed − income tax provisioned). Narrative surfaces a dry callout when "yours to spend" < 1-month average expenses. No auto-transfer, no bank-balance integration in v1. |

---

## 3. End-to-end journey

### 3.1 Daily snapshot runs

At 06:00 local (Australia/Melbourne) every day, the `finance_snapshot_take` scheduled task runs:

1. Query active subscriptions from Stripe (via existing `integration_connections.stripe`), joined against `deals.subscription_state` and `deals.stripe_subscription_id`.
2. Query retainer deals from `deals` table where `won_outcome = 'retainer'` and commitment not yet ended.
3. Query invoices from `invoices` (Branded Invoicing), aggregate paid/unpaid/overdue by status.
4. Query expenses from `expenses` table, aggregate by category + total.
5. Query Stripe balance via Balance API — the "available cash" proxy.
6. Compute headline metrics: revenue MTD, expenses MTD, net, MRR, outstanding invoices total, GST owed this quarter, income tax provisioned YTD, yours-to-spend.
7. Compute 90-day projection from contracted + pipeline-weighted with stage-age decay.
8. Insert one row into `finance_snapshots` with `{ snapshot_date, metrics_json, projection_json, narrative_text: null, narrative_generated_at: null }`.
9. Enqueue `finance_narrative_regenerate` task for immediate execution.

Snapshot is **idempotent per date** — re-running for the same date overwrites the row. Stripe API failures log to `external_call_log` and Observatory handles the anomaly; snapshot continues with last-known Stripe data flagged stale.

### 3.2 Narrative regeneration

The `finance_narrative_regenerate` task runs:

1. Load today's `finance_snapshots` row + the snapshot from 30 days prior for month-over-month comparison.
2. Load the current time-range context for whoever will read the narrative — default is "This Month", but brief regen respects the view-state if the cockpit deep-links with a range.
3. Call Claude Haiku via `ai.finance.draftNarrative({ snapshot_today, snapshot_compare, range })` — routed through the model registry (`job: 'finance-narrative'`, `actor_type: 'internal'`, `actor_id: null`).
4. Prompt produces structured JSON: `{ paragraph_text: string, number_references: Array<{ token: string, value_aud: number, link_path: string }>, callouts: Array<'tax_tight' | 'projection_cliff' | 'overdue_heavy' | null> }`.
5. Narrative passes through brand-voice drift check (Foundations §11.5).
6. Writes back to the snapshot row: `narrative_text`, `narrative_generated_at`.

**Material-event regeneration** follows the Daily Cockpit `maybeRegenerateBrief()` pattern. The narrative regenerates (not the full snapshot) when:

- A new invoice moves to `paid` or `overdue` status
- A recurring expense is auto-booked
- Month rolls over (first query on a new date)
- A pipeline deal closes (won or lost) or changes stage materially
- Andy completes a manual expense entry ≥ AUD 500

Regen is debounced at 5 minutes — rapid-fire events don't cause rapid-fire LLM calls. Observatory registers `finance-narrative` as a job with a learned band (expect ~30 calls/day).

### 3.3 Andy opens `/lite/finance`

Morning on a Tuesday. Default view: This Month.

1. **Top of page:** global time-range picker + "Export" button (top-right, routes to `/lite/finance/export`).
2. **Above the fold (desktop):** two tiles side-by-side.
   - Left: **P&L tile** — Revenue (with breakdown chip: retainers / SaaS / trial shoots / projects) / Expenses / Net margin / month-over-month delta.
   - Right: **Projection chart** — 90 days forward, stacked area (contracted base + pipeline-weighted overlay + decay-adjusted band). A thin past-30-days strip at the left for visual continuity.
3. **Below the fold, first card:** Claude narrative. Three to five sentences in SuperBad dry voice, numbers rendered as clickable spans linking to the relevant detail screens.
4. **Tiles row:** MRR + net run-rate / Outstanding invoices / Top 5 expense categories (this range) / Tax provision.
5. **Recent transactions feed:** last 20 mixed rows (income + expenses), ordered by date, click to drill.

On mobile, everything stacks. Headline tiles become vertical; tiles row becomes a 2×2 grid on medium, 1×4 on small.

### 3.4 Expense entry (quick-add)

Persistent FAB (floating action button) at bottom-right on `/lite/finance/*` screens. Tap opens the expense modal:

- Amount (AUD inc GST)
- Date (defaults to today)
- Category (dropdown of closed-list categories)
- Vendor (free text, autocomplete from prior entries)
- GST amount (defaults based on category; editable)
- Description (one-line, optional)
- Receipt (optional file attachment)
- Save → closes modal, toast confirms, narrative regen debounced

If category is "Payment processing", entry is **blocked** with a nudge: *"Stripe fees roll up automatically each day. Type a fee only if you're correcting a drift."* A secondary "I know, let me override" button opens the form with the block removed — for genuine manual corrections.

### 3.5 Recurring expense management

`/lite/finance/recurring` lists the declared recurring expenses. Columns: vendor / category / amount / frequency (monthly/quarterly/annual) / next-fire-date / status (active/paused). Add new is a form; edit is inline.

Cron (`recurring_expense_book`) runs daily at 06:15 local. For each due recurring row:

1. Insert into `expenses` with `status = 'pending_review'` and `source = 'recurring'`.
2. Advance `next_fire_date` on the recurring row.
3. Log to `activity_log` with kind `finance_recurring_booked`.

Andy sees pending-review count on the recurring page header and a weekly cockpit chip ("3 recurring expenses booked this week — review"). He bulk-confirms or edits individually. Confirming flips status from pending_review → confirmed; that's the only effect. A row at pending_review still counts in the P&L — the review gate is about accuracy, not recognition.

### 3.6 Observatory auto-roll-up

The `finance_observatory_rollup` cron runs daily at 06:10 local (before recurring expenses, after snapshots). For each distinct `vendor` in `external_call_log` for the previous UTC day:

1. Aggregate `sum(estimated_cost_aud)` → `daily_total_aud`.
2. Upsert into `expenses` with key `{source: 'observatory_rollup', vendor, date}` — same key → overwrite, not append.
3. Category auto-set to `'API costs'`.
4. GST auto-set per the vendor's registered GST treatment (most foreign API vendors are 0% GST; Stripe AU fees are 10%).

Because upsert is keyed, re-running the cron is safe. If a vendor entry is later manually overridden by Andy, the manual edit sets `manual_override = true` and future rollups skip that row.

### 3.7 Stripe fee roll-up

Similar pattern, separate cron `finance_stripe_fee_rollup` runs daily at 06:12:

1. Pull the previous day's Balance Transactions from Stripe (`balance_transaction.fee` and related fields).
2. Aggregate total fees by type (payment processing / refund / dispute / chargeback).
3. Upsert one `expenses` row per type per day with `source: 'stripe_fees'`, `category: 'Payment processing'`.

This is the authoritative source for Stripe fees. No approximation from payment amounts.

### 3.8 Accountant bundle export

Andy clicks "Export" top-right → `/lite/finance/export`.

Screen shows:

- Quick presets for the last two completed BAS quarters + the current FY + the previous FY
- Custom range picker (two native date inputs)
- "Generate bundle" button

Clicking generate:

1. Enqueues `finance_export_generate` scheduled task with `{ period_start, period_end, requested_at }`.
2. Task renders six artefacts in order: BAS summary PDF → transactions CSV → expenses CSV → invoices CSV → P&L PDF → per-client revenue CSV.
3. PDFs use the existing Puppeteer pipeline (see `docs/specs/branded-invoicing.md` §9 — Finance Dashboard consumes this primitive, does not re-implement).
4. Zips into a single file, stores to local filesystem at `var/exports/finance/{period_label}-{generated_at}.zip`.
5. Emits `sendEmail({ classification: 'transactional' })` to Andy with a download link + zip attachment if ≤ 10MB.
6. Logs to `activity_log` with kind `finance_export_generated`.

Past exports listed below the generate button, downloadable again until the filesystem retention policy (90 days) purges them.

**CSV schema (transactions.csv, canonical example):**

```
date, type, description, counterparty, category, amount_inc_gst, gst_amount, amount_ex_gst, source_id
```

All CSVs follow this row shape where applicable. Column names match Xero's import format closely enough for manual import if the accountant chooses that path.

### 3.9 Tax provision tile + narrative callout

Tile renders three lines:

1. **GST owed** — sum of GST collected on paid invoices this BAS quarter minus GST paid on confirmed expenses. Click → `/lite/finance/export` with the current BAS quarter pre-selected.
2. **Income tax provisioned** — net profit YTD × `finance.income_tax_rate` (default 0.25, Andy confirms at onboarding). Click → opens a short info card explaining this is a provision estimate, accountant is authoritative.
3. **Yours to spend** — Stripe balance (via Balance API) − the above two. Can go negative if provisions exceed balance.

When `yours_to_spend < 1-month avg expenses` or `yours_to_spend < 0`, the narrative prompt receives a `callouts: ['tax_tight']` signal and surfaces a dry one-liner: *"Stripe balance reads $6,200. After GST owed and income tax provisioned, $1,400 of that is actually yours. Watch the spend."*

No cockpit banner for tax tightness — it's a state, not an action. Dashboard-only.

### 3.10 Cockpit banner surface

Three banner kinds extend `getHealthBanners()`:

- `finance_bas_due { quarter_label, due_date, days_remaining }` — fires when BAS quarter end is ≤ `finance.bas_reminder_days_ahead` (default 14) days away. Dismiss via one-click "BAS filed" button on the banner itself; records to `compliance_milestones` table.
- `finance_eofy_due { fy_label, due_date, days_remaining }` — same pattern, FY end is ≤ `finance.eofy_reminder_days_ahead` (default 30) days away.
- `finance_invoice_overdue { overdue_count, overdue_total_aud, threshold_crossed }` — fires when any invoice is > `finance.overdue_invoice_threshold_days` (default 30) past due, OR when total outstanding > `finance.outstanding_invoices_threshold_aud` (default 5000). Click-through lands in **Branded Invoicing** filtered to overdue, not Finance Dashboard.

Banner idempotency follows Observatory's pattern: one fire per threshold-breach per 48h, resets when the condition clears.

---

## 4. Data model

### 4.1 New tables

**`expenses`** — the primary ledger for all non-Stripe-revenue flows.

| column | type | notes |
|---|---|---|
| `id` | text PK | ULID |
| `amount_inc_gst` | integer | stored in cents AUD |
| `gst_amount` | integer | cents AUD, nullable (non-GST expenses) |
| `category` | text enum | closed list (see §4.4) |
| `vendor` | text | free text, autocomplete-indexed |
| `description` | text | nullable |
| `expense_date` | date | date the expense applied to (not the entry date) |
| `source` | text enum | `'manual' \| 'recurring' \| 'observatory_rollup' \| 'stripe_fees'` |
| `source_ref` | text | nullable; for recurring → `recurring_expenses.id`; for rollups → `{vendor, date}` key |
| `status` | text enum | `'pending_review' \| 'confirmed'` |
| `manual_override` | boolean | default false; true when Andy has edited a rolled-up row |
| `receipt_path` | text | nullable; relative filesystem path |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Indexes: `(expense_date)`, `(category, expense_date)`, `(source, source_ref)` unique (for rollup idempotency).

**`recurring_expenses`** — declared recurring costs booked automatically.

| column | type | notes |
|---|---|---|
| `id` | text PK | |
| `vendor` | text | |
| `category` | text enum | |
| `amount_inc_gst` | integer | cents AUD |
| `gst_amount` | integer | cents, nullable |
| `frequency` | text enum | `'monthly' \| 'quarterly' \| 'annual'` |
| `next_fire_date` | date | advanced on each booking |
| `status` | text enum | `'active' \| 'paused'` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**`finance_snapshots`** — one row per day, frozen metrics + narrative.

| column | type | notes |
|---|---|---|
| `snapshot_date` | date PK | |
| `metrics_json` | json | revenue MTD, expenses MTD, net, MRR, outstanding_invoices_aud, gst_owed_aud, income_tax_provisioned_aud, yours_to_spend_aud, stripe_balance_aud |
| `projection_json` | json | 90d forward: contracted curve, pipeline-weighted curve, stage-decay-adjusted curve |
| `narrative_text` | text | nullable until narrative job runs |
| `narrative_generated_at` | timestamp | nullable |
| `narrative_callouts` | json | array of callout tokens |
| `stale_flags` | json | nullable; logs any upstream data source (Stripe, Observatory, etc.) that was unavailable at snapshot time |
| `created_at` | timestamp | |

**`compliance_milestones`** — minimal table for BAS-filed / EOFY-filed markers.

| column | type | notes |
|---|---|---|
| `id` | text PK | |
| `kind` | text enum | `'bas_filed' \| 'eofy_filed'` |
| `period_label` | text | e.g. `'Q3-2026'`, `'FY2025-26'` |
| `filed_at` | timestamp | |
| `note` | text | nullable |

### 4.2 Cross-spec table additions (patches owed)

- `deals` — no new columns. Finance Dashboard reads `won_outcome`, `committed_until_date`, `subscription_state`, `stripe_subscription_id`, existing stage/probability fields. All pre-existing.
- `invoices` — no new columns. Reads `status`, `due_date`, `amount_inc_gst`, `gst_amount`, `client_id`. All pre-existing.
- `activity_log.kind` — gains 8 new values: `finance_expense_created`, `finance_expense_updated`, `finance_expense_confirmed`, `finance_recurring_booked`, `finance_recurring_created`, `finance_recurring_paused`, `finance_export_generated`, `finance_bas_filed`. (Consolidated 2026-04-13 Phase 3.5 in `sales-pipeline.md` activity_log union.)
- `expense_line` — adds nullable `candidate_id` FK → `candidates.id` (added 2026-04-13 Phase 3.5 per Hiring Pipeline patch). Populated when an expense represents a contractor trial-task payment or bench-work payment. A new "Contractor payments" rollup view filters by `expense_line.candidate_id IS NOT NULL`, grouped by candidate, surfaces on `/lite/finance/category/contractor-payments`. Required for tax provisioning accuracy and margin reads per role.

### 4.3 Shared primitives consumed (not owned)

- **`scheduled_tasks`** (owner: Quote Builder) — new task types: `finance_snapshot_take`, `finance_narrative_regenerate`, `finance_observatory_rollup`, `finance_stripe_fee_rollup`, `recurring_expense_book`, `finance_export_generate`.
- **`external_call_log`** (owner: Cost & Usage Observatory) — read-only for rollup; also written to by every LLM/Stripe call Finance Dashboard makes.
- **`integration_connections`** (owner: Setup Wizards) — reads `stripe` row to check admin connection status; surfaces a setup-required empty state if not connected.
- **`settings`** (owner: Foundations) — reads all thresholds and rates via `settings.get(key)`; never literals.
- **`sendEmail()`** (owner: Foundations §11.2) — for BAS/EOFY banner-driven reminders and export-ready notifications, always `classification: 'transactional'`.
- **`logActivity()`** (owner: Foundations §11.1) — every mutation.
- **`formatTimestamp()`** (owner: Foundations §11.3) — every displayed timestamp.
- **`getHealthBanners()`** (owner: Daily Cockpit) — extended by 3 new kinds above.
- **Puppeteer PDF pipeline** (owner: Branded Invoicing §9) — BAS summary PDF + P&L PDF rendered via existing HTML-to-PDF primitive.
- **Model registry + brand-voice drift check** (owner: Cost & Usage Observatory §7) — one new LLM job `finance-narrative` (Haiku). Registered with pricing formula, band, and drift-check gate.

### 4.4 Closed-list expense categories (v1)

- Software subscriptions
- API costs (auto-populated by Observatory rollup)
- Payment processing (auto-populated by Stripe fee rollup; manual entry blocked with nudge)
- Ads
- Contractors
- Equipment
- Travel
- Accountant / legal
- Other

Andy-editable labels v1.1. Categories are a closed enum in v1.0.

---

## 5. Settings keys (seeded by Phase 5 Session A)

| key | default | type | description |
|---|---|---|---|
| `finance.gst_rate` | `0.10` | decimal | Australian GST rate; onboarding-confirmed. |
| `finance.income_tax_rate` | `0.25` | decimal | Andy's income tax rate; onboarding-confirmed with accountant. |
| `finance.bas_reminder_days_ahead` | `14` | integer | Days before BAS quarter end when cockpit banner fires. |
| `finance.eofy_reminder_days_ahead` | `30` | integer | Days before FY end when cockpit banner fires. |
| `finance.overdue_invoice_threshold_days` | `30` | integer | Days past due that triggers overdue banner. |
| `finance.outstanding_invoices_threshold_aud` | `5000` | integer | Total outstanding AUD threshold for banner. |
| `finance.snapshot_time_local` | `"06:00"` | string | Daily snapshot cron time, Australia/Melbourne. |
| `finance.projection_horizon_days` | `90` | integer | Forward projection window. |
| `finance.stage_age_decay_halflife_days` | `30` | integer | Days past expected stage dwell when probability halves. |
| `finance.recurring_review_debounce_hours` | `168` | integer | Weekly cadence for the "3 recurring expenses booked — review" chip. |
| `finance.export_retention_days` | `90` | integer | Filesystem retention for generated export zips. |

All registered in `docs/settings-registry.md` at Phase 3.5 step 7a.

---

## 6. LLM prompts

### 6.1 `draft-finance-narrative.ts` (Haiku)

**Actor:** `internal` / `null`.

**Input (structured JSON):**

```
{
  snapshot_today: { metrics, projection },
  snapshot_compare: { metrics, projection } | null,
  range_label: "This Month" | "This Quarter" | ...,
  callouts: ['tax_tight' | 'projection_cliff' | 'overdue_heavy' | 'first_profitable_month' | ...]
}
```

**Output (structured JSON):**

```
{
  paragraph_text: string,  // 3-5 sentences, SuperBad dry voice
  number_references: Array<{ token: string, value_aud: number, link_path: string }>,
  callout_used: string | null
}
```

**Guardrails:**

- Prompt enforces: every numeric reference must appear in `number_references` with an exact matching value. Render layer validates; if mismatch, falls back to bare figures with a `[narrative unavailable]` marker + logs to Observatory (suggests prompt regression).
- No forward-looking advice ("you should..."). Observations only.
- Callouts trigger specific phrasing; the prompt receives example lines for each callout category but composes freely.
- Brand-voice drift check per Foundations §11.5.

Prompt file lives at `lib/ai/prompts/draft-finance-narrative.ts`. Content calibration (tone, example outputs, callout phrasing) happens in the content mini-session.

**No other LLM prompts.** Finance Dashboard is data-heavy, not generation-heavy.

---

## 7. Cross-spec contracts (inline per Phase 3.5 step 2a)

### 7.1 Daily Cockpit — `getHealthBanners()` extension

Finance Dashboard produces three new banner kinds consumed by Daily Cockpit. Banner types added to the union:

```typescript
type ObservatoryBanner =        // owned by Observatory spec
  | { kind: 'cost_anomaly', ... }
  | { kind: 'monthly_threshold', ... }
  | { kind: 'projection_threshold', ... }
  | { kind: 'tier_health', ... }
  | { kind: 'unknown_job', ... };

type FinanceBanner =            // owned by THIS spec
  | { kind: 'finance_bas_due',
      quarter_label: string,
      due_date: string,
      days_remaining: number,
      click_through: '/lite/finance/export' }
  | { kind: 'finance_eofy_due',
      fy_label: string,
      due_date: string,
      days_remaining: number,
      click_through: '/lite/finance/export' }
  | { kind: 'finance_invoice_overdue',
      overdue_count: number,
      overdue_total_aud: number,
      threshold_kind: 'days_overdue' | 'outstanding_total',
      click_through: '/lite/invoices?filter=overdue' };

type HealthBanner = ObservatoryBanner | FinanceBanner | ... ;
```

**Patch owed on Daily Cockpit spec:** add `FinanceBanner` kinds to the `HealthBanner` union in §3 (banner strip) and §6 (getHealthBanners contract). Consolidated with Observatory's 5 additions at Phase 3.5.

### 7.2 Daily Cockpit — `maybeRegenerateBrief()` pattern reuse

Finance Dashboard's narrative regeneration uses the same debounced-event pattern as Cockpit's brief regeneration. No new primitive; reuse `maybeRegenerateBrief({ subject: 'finance_narrative', cause: 'invoice_paid' | ... })` as the call convention.

**Patch owed on Daily Cockpit spec:** confirm `maybeRegenerateBrief()` accepts a `subject` discriminator so brief, cockpit rail, and finance narrative can all coexist on the same primitive. (If not, Finance Dashboard defines its own `maybeRegenerateFinanceNarrative()` with identical semantics.)

### 7.3 Branded Invoicing — invoice row click-through

Cockpit's `finance_invoice_overdue` banner click-through lands on Branded Invoicing's invoice list filtered by status=overdue. No changes to Branded Invoicing's schema; existing `/lite/invoices` route accepts a `?filter=overdue` query param. If it doesn't already, Branded Invoicing spec is patched.

**Patch owed on Branded Invoicing spec:** confirm `/lite/invoices` supports `?filter=overdue` query param; add if missing. Consolidated at Phase 3.5.

### 7.4 Cost & Usage Observatory — `finance-narrative` job

Finance Dashboard registers one new LLM job with the model registry:

```
registerJob({
  key: 'finance-narrative',
  vendor: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  pricing_formula: standardAnthropicPricing,
  per_call_ceiling_aud: 0.05,
  daily_ceiling_aud: 2.00,
  learned_band_multiplier: 3,
  actor_convention: 'internal',
});
```

**Patch owed on Observatory spec:** add `finance-narrative` job to the model registry example table in §7. Consolidated at Phase 3.5.

### 7.5 Setup Wizards — GST & income tax onboarding step

The Finance Dashboard requires `finance.gst_rate` and `finance.income_tax_rate` to be set before the tax provision tile can render meaningfully. This lives as one step in the primary admin onboarding wizard:

```
stepKey: 'finance-tax-rates',
title: 'Confirm your tax rates',
inputs: [
  { key: 'finance.gst_rate', type: 'numeric_preset',
    presets: [{ label: 'Standard 10% (most AU businesses)', value: 0.10 },
              { label: "I'm not GST-registered", value: 0 }] },
  { key: 'finance.income_tax_rate', type: 'numeric_preset',
    presets: [{ label: 'Sole trader — check with your accountant', value: 0.25 },
              { label: 'Company — 25% small business rate', value: 0.25 },
              { label: 'Company — 30% standard rate', value: 0.30 }] }
],
completion: writes both settings rows.
```

**Patch owed on Setup Wizards spec:** add `finance-tax-rates` step to the primary admin onboarding `WizardDefinition`. Consolidated at Phase 3.5.

### 7.6 Stripe integration — Balance API + Balance Transactions

Finance Dashboard consumes two Stripe endpoints not previously specced:

- `GET /v1/balance` for the tax-provision tile's "Stripe balance" line.
- `GET /v1/balance_transactions?created[gte]=...` daily for the Stripe fee rollup.

Both calls go through the integration registry (`lib/integrations/registry.ts`, owned by Observatory §7). Registered as `stripe-balance-read` and `stripe-balance-transactions-read` jobs.

**No cross-spec patch owed** — Observatory's integration registry pattern is already general. Finance Dashboard just registers new jobs at build time.

---

## 8. UI description

### 8.1 `/lite/finance` (main dashboard)

**Desktop layout:**

```
┌──────────────────────────────────────────────────────────────┐
│ [Range: This Month ▾]                            [Export] ↗ │
├──────────────────────────────────────────────┬───────────────┤
│ This Month P&L                               │ Projection    │
│ ┌─────────────────────────────────────────┐  │ 90 days       │
│ │ Revenue  $12,400  (retainers $8.2k •    │  │ [area chart:  │
│ │          SaaS $2.9k • shoots $1.3k)     │  │  contracted + │
│ │ Expenses −$4,100                         │  │  pipeline +   │
│ │ ─────────                                │  │  decay band]  │
│ │ Net       $8,300  ▲ 15% vs last month   │  │               │
│ └─────────────────────────────────────────┘  │               │
├──────────────────────────────────────────────┴───────────────┤
│ 📝 Narrative                                                 │
│ "Revenue's tracking 15% above March. Three retainers active, │
│ two SaaS subs. Outstanding [$3,200 over two invoices], one   │
│ overdue by a week. Projection holds at [$18k contracted] +   │
│ [$4k likely for May]. Stripe balance reads $6,200 — [$1,400  │
│ is actually yours after GST and tax provisions]."            │
├────────────┬────────────┬────────────┬───────────────────────┤
│ MRR        │ Outstanding│ Top 5      │ Tax Provision         │
│ $11,100    │ Invoices   │ Expense    │ GST owed: $1,240      │
│ Runs to    │ $3,200     │ Categories │ Tax provisioned: $3k  │
│ Nov 2026   │ 2 invoices │ [list]     │ Yours to spend: $1.4k │
│ at current │ 1 overdue  │            │                       │
│ spend.     │ →          │            │                       │
├────────────┴────────────┴────────────┴───────────────────────┤
│ Recent transactions                                           │
│ [20-row list, alternating income/expense]                    │
└──────────────────────────────────────────────────────────────┘
```

**Voice & delight treatment:**

Surfaces apply: narrative card voice (ambient dry-voice pool — sprinkle claim: first-of-month narrative openers, ~6 variants rotating); browser tab titles (`Finance — March ▲` / `Finance — March ▼` / `Finance — quiet`). Two sprinkle claims:

- **Narrative opening lines** — rotation pool (~6 per month-state: growth / flat / decline / quiet / BAS-week / EOFY-week). Content mini-session finalises.
- **Browser tab titles for `/lite/finance/*` routes** — state-aware (see above).

No hidden eggs on this surface in v1 — Finance Dashboard is a working tool, not a delight-target. Admin-side eggs may rotate here later when Surprise & Delight admin-egg expansion brainstorm runs.

### 8.2 `/lite/finance/mrr`, `/lite/finance/outstanding`, `/lite/finance/category/:slug`, `/lite/finance/recent`

Shallow-drill detail screens. Each is a simple list view matching the tile it backs. Row click routes to the owning feature.

### 8.3 `/lite/finance/expenses`

Full expense ledger view with filters: date range / category / source / status / vendor search. Table columns: date / category / vendor / description / amount / GST / source badge / status badge. Row click opens edit-expense modal. Bulk-confirm available when filtered to `pending_review`.

### 8.4 `/lite/finance/recurring`

Recurring expenses list, columns per §3.5. Add-new form inline. Edit-inline for amount/frequency/next-date. Pause / resume actions per row.

### 8.5 `/lite/finance/export`

Export screen:

- Section 1: preset period buttons (last two completed BAS quarters, current FY, previous FY).
- Section 2: custom range with two native date inputs + "Generate" button.
- Section 3: history of past exports, clickable download links until retention purge.

When "Generate" is clicked, screen flips to a loading state with a spinner + dry copy ("Rendering the bundle. This takes about a minute for a full quarter. You'll get an email when it's ready.") Polling is lightweight (5s interval on the current task status) — or a WebSocket push via the same primitive Cockpit uses; TBD in Phase 5 Session D.

### 8.6 Mobile

All screens stack vertically. FAB for quick-add expense persists bottom-right. Drill-downs open as full-screen views; back-button closes. Narrative card gets its own tap target to expand to a full view (longer paragraph, more detail, v1.1). Projection chart rotates to landscape-friendly on tap (v1 v. v1.1 — render a compressed version v1, unlock landscape v1.1).

### 8.7 Empty states

- First-time load before any data (Stripe not connected): "Connect Stripe to start seeing revenue" → deep-links to Setup Wizards' Stripe admin connection.
- After Stripe connected, before any invoices/expenses: "No revenue yet. Come back when an invoice is paid."
- Projection empty (no contracted revenue, no pipeline): "Nothing contracted and nothing in the pipeline. Either the business is paused or the pipeline needs work."

Content mini-session finalises all empty-state copy.

---

## 9. Success criteria

Finance Dashboard is working when, measured across the first 90 days of production use:

1. **P&L accuracy within 1%** of accountant-verified quarterly BAS numbers. Any delta attributable to rollup categorisation, not missing data.
2. **Narrative fidelity**: zero number-reference mismatches in production. (Guardrail catches them pre-render; count should be structural zero. Any leak → prompt regression investigation.)
3. **Accountant bundle self-sufficiency**: across the first two BAS quarters, the accountant requests zero additional data outside the bundle.
4. **BAS banner actionability**: every BAS banner is filed-dismissed within 2 weeks of its fire (no banner survives past its due date unacknowledged).
5. **Tax-tight callout signal value**: when "yours to spend" goes tight, Andy either (a) confirms he knew, or (b) changes spending behaviour — never "didn't notice".

Metrics tracked silently from day one; surfaced as v1.1 operator-facing health dashboard.

---

## 10. Out of scope (v1)

Explicit non-goals. Prevents scope creep from pulling these into v1.0:

- **Bank balance integration / open-banking (Basiq, Plaid, Up).** Stripe balance is the v1 proxy. Full bank-balance runway is v1.1.
- **Active tax transfer ("move to savings" flow).** Requires bank-balance integration. v1.1+.
- **Per-client P&L pivot / per-client profitability leaderboard.** Data plumbing preserved (revenue and Observatory costs already client-attributable), UI is v1.1.
- **Expense category editor UI.** Closed list in v1.0. Andy-editable v1.1.
- **Per-subscriber P&L for SaaS.** Tier-health aggregate already lives in Observatory; per-subscriber triage is Observatory's Large-tier recommendation cards, not Finance Dashboard.
- **Budget planning / target-setting.** No "you planned $4k expenses, tracking $5.2k" surface. Part of the deferred strategic planning feature (memory `project_strategic_planning_postlaunch.md`).
- **Multi-currency.** AUD only. Lite is Australian.
- **Xero / MYOB / QuickBooks integration.** Accountant works from the exported bundle. Direct sync is v1.1+ with a full integration brainstorm.
- **Real-time profitability per active client session.** Not v1.
- **Cashflow forecasting at monthly granularity beyond 90 days.** Projection capped at 90d; quarterly-and-beyond is v1.1 with trend extrapolation.
- **Receipt OCR.** Receipts attach as files; no auto-parse. v1.1.
- **Staff payroll, superannuation, or employee expense reimbursement.** Solo business in v1; first staff hire unlocks these as a separate spec.
- **Forex / GST rules for international sales.** SuperBad's current AU-only customer base makes this deferrable; patch when the first international sale lands.

---

## 11. Build sessions (Phase 5 sizing)

Four sessions, ordered by dependency.

**Session A — Data model + manual expense entry + settings seeding**

- Drizzle schema: `expenses`, `recurring_expenses`, `finance_snapshots`, `compliance_milestones`.
- Migrations + seeds for closed-list categories.
- Settings keys seeded from `docs/settings-registry.md`.
- Manual expense entry form + quick-add modal + edit modal.
- `activity_log.kind` enum additions.
- `/lite/finance` landing page renders with "no data yet" empty state.

**Session B — Projection logic + roll-up crons + recurring expense booking**

- Projection calculation module (contracted MRR, pipeline-weighted, stage-age decay).
- `finance_snapshot_take` cron (06:00 local).
- `finance_observatory_rollup` cron (06:10 local).
- `finance_stripe_fee_rollup` cron (06:12 local, with Balance Transactions API integration registered).
- `recurring_expense_book` cron (06:15 local).
- Stripe Balance API read integration.
- `/lite/finance/recurring` management screen.

**Session C — Dashboard UI + narrative prompt + drill-downs**

- `/lite/finance` full layout (headline + tiles + narrative card + recent transactions).
- `draft-finance-narrative.ts` prompt + model registry job registration.
- `finance_narrative_regenerate` cron + material-event wiring.
- Drill-down routes: `/lite/finance/mrr`, `/lite/finance/outstanding`, `/lite/finance/category/:slug`, `/lite/finance/recent`, `/lite/finance/expenses`.
- Tax provision tile + "yours to spend" computation + narrative callout wiring.
- Mobile responsive pass.
- Narrative number-reference validation layer + fallback render.

**Session D — Accountant bundle + cockpit banners + onboarding step**

- `/lite/finance/export` screen + preset periods + custom range.
- BAS summary PDF template (Puppeteer via Branded Invoicing primitive).
- P&L PDF template.
- CSV generators (transactions, expenses, invoices, per-client revenue).
- `finance_export_generate` cron + zip assembly + filesystem persistence + email notification.
- `getHealthBanners()` extension with three finance banner kinds.
- Setup Wizards `finance-tax-rates` step.
- Retention purge cron for exports (weekly).

**Preconditions (settings keys each session consumes):** Sessions B, C, D all read the settings keys from §5. All pulled via `settings.get()` — no literals.

**Rollback strategy per session:** All migrations include down-migrations. Each cron job is kill-switchable via the model/integration registry (Observatory pattern). UI changes are git-revertable with no data-shape changes.

**Skills to load per session:** A (`drizzle-orm`, `typescript-validation`) / B (`drizzle-orm`, `stripe`) / C (`react-19`, `tailwind-v4`, `framer-motion`, `claude-api`) / D (`pdf-generation-nextjs`, `email-nodejs`, `nextauth`).

---

## 12. Content mini-session owed

Small-to-medium creative session with `superbad-brand-voice` + `superbad-visual-identity` + `superbad-business-context` skills loaded. Produces:

- Narrative opening-line rotation pool (~6 variants per month-state: growth / flat / decline / quiet / BAS-week / EOFY-week).
- Full narrative prompt calibration — test against 8–10 synthetic snapshot scenarios (growth month, loss month, uneven month, tax-tight month, slow projection, overdue-heavy, first profitable month, BAS-week, EOFY-week, recurring-booked-reminder).
- Tax-tight narrative callout phrasing pool (~5 variants).
- Projection-cliff narrative callout phrasing pool (~5 variants).
- Overdue-heavy narrative callout phrasing pool (~5 variants).
- Tile labels finalised ("Yours to spend" confirmed or replaced).
- Empty-state copy for: no Stripe connected, no data yet, no pipeline, no recurring expenses.
- BAS banner copy (3 variants stratified by days-remaining: 14d calm, 7d neutral, 3d firm).
- EOFY banner copy (same pattern).
- Invoice-overdue banner copy (2 variants: days-overdue vs outstanding-total).
- Export-ready email copy.
- "BAS filed" confirmation copy.
- Browser tab title treatments (`Finance — March ▲` / `Finance — March ▼` / `Finance — quiet` / `Finance — BAS this week`).
- Recurring-review chip copy for cockpit ("3 recurring expenses booked this week — review").
- Sprinkle claims from `docs/candidates/sprinkle-bank.md` (narrative openers + browser tab titles).

Output commits to `docs/content/finance-dashboard.md` per Phase 3.5 step 3a. Must run before Phase 5 Session C.

---

## 13. Permissions matrix contribution

| route / action | admin | client | prospect | anonymous | system |
|---|---|---|---|---|---|
| `GET /lite/finance/*` | ✓ | — | — | — | — |
| `POST /lite/finance/expenses` | ✓ | — | — | — | — |
| `PUT /lite/finance/expenses/:id` | ✓ | — | — | — | — |
| `POST /lite/finance/recurring` | ✓ | — | — | — | — |
| `POST /lite/finance/export` | ✓ | — | — | — | — |
| `GET /lite/finance/exports/:file` | ✓ | — | — | — | — |
| `finance_snapshot_take` cron | — | — | — | — | ✓ |
| `finance_narrative_regenerate` cron | — | — | — | — | ✓ |
| `finance_observatory_rollup` cron | — | — | — | — | ✓ |
| `finance_stripe_fee_rollup` cron | — | — | — | — | ✓ |
| `recurring_expense_book` cron | — | — | — | — | ✓ |
| `finance_export_generate` cron | — | — | — | — | ✓ |

Feeds into Phase 3.5 step 9 permissions matrix.

---

## 14. Open items for Phase 3.5

- Confirm `maybeRegenerateBrief()` accepts a `subject` discriminator (Daily Cockpit primitive). If not, Finance Dashboard defines its own `maybeRegenerateFinanceNarrative()` with identical semantics.
- Confirm `/lite/invoices?filter=overdue` query param support (Branded Invoicing).
- Consolidated banner-union patch on Daily Cockpit spec (Observatory's 5 + Finance Dashboard's 3).
- `activity_log.kind` enum additions (consolidated at Phase 3.5 across all specs).
- Confirm Puppeteer PDF pipeline supports multi-document export (Branded Invoicing primitive currently renders single invoice PDFs; export needs 2 PDFs + 4 CSVs bundled).
- Verify Observatory's integration registry covers Stripe Balance + Balance Transactions as generic read jobs.
- Onboarding sequencing: Setup Wizards `finance-tax-rates` step must land before first expense or invoice creates a non-zero tax provision calculation. Defaults are safe if step is skipped.

---

**Handoff:** `sessions/phase-3-finance-dashboard-handoff.md`
