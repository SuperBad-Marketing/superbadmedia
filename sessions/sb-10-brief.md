# `sb-10` — Admin cockpit SaaS headline signals

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §8.1 (product admin index summary cards) + §8.3 (product detail Overview tab) + §13.8 (Daily Cockpit integration contract).
**Predecessor:** `sessions/sb-9-handoff.md` — payment-failure counter + recovery + escalation live; new signal columns/kinds available (`deals.payment_failure_count`, `deals.first_payment_failure_at_ms`, activity-log `saas_payment_failed_lockout` / `saas_payment_recovered` / `saas_data_loss_warning_sent`). `sessions/sb-8-handoff.md` — tier change + product switch activity-log kinds (`saas_subscription_upgraded` / `_downgraded` / `_product_switched` / `saas_tier_downgrade_scheduled`) available as signal sources.
**Visual reference (binding per `feedback_visual_references_binding`):** `mockup-cockpit.html` for rail chip / signal-card voice + density. §8.1 on-page surface reuses existing SummaryCard pattern from `app/lite/admin/products/page.tsx` (no new component library).
**Model:** `/deep` (Opus). Query aggregation + time windowing + dual-consumer primitive (on-page + cockpit contract).

## Goal

Turn the stubbed-zero summary on `/lite/admin/products` into a real **SaaS health headlines** surface, and expose the same underlying signals as a single primitive `getSaasHeadlineSignals({ userId })` that the future Daily Cockpit (spec §13.8) will consume as rail chips. Five signals: **new signups (this period)**, **churn (this period)**, **payment failures (active past_due count + 7d lockouts)**, **MRR delta (this period vs previous)**, **subscribers near cap (≥ 80% on any dimension)**. Product detail Overview tab (§8.3) gains the per-product slice of the same headlines.

## Acceptance criteria (G12)

1. **Signal primitive** — `lib/saas-products/headline-signals.ts` exports `getSaasHeadlineSignals({ userId, windowDays? }): Promise<SaasHeadlineSignals>` where `windowDays` defaults to `settings.get("saas.headline_window_days")` (seed **30**). Returns `{ activeSubscribers, mrrCents, newThisWindow, churnThisWindow, mrrDeltaCents, mrrDeltaPct, pastDueCount, lockoutCount7d, nearCapCount, dataLossWarningsSent7d, generatedAtMs }`. Single query-per-signal, no per-deal N+1. Windows derived from `Date.now() - windowDays * 86_400_000`.
2. **Per-product slice** — `getSaasHeadlineSignalsForProduct(productId, { windowDays? })` returns the same shape scoped to one product. Used by §8.3 Overview tab.
3. **Product admin index wired** — `/lite/admin/products` page replaces the stubbed `getSaasProductSummaryCounts()` call with `getSaasHeadlineSignals()`. New signal row below existing summary cards renders: `Past due` + `Near cap` + `MRR delta` (signed, coloured — emerald up, amber flat ±2%, rose down). Existing four cards (active subscribers / MRR / new this month / churn this month) now show **real** numbers.
4. **MRR computation** — MRR = sum over `deals` where `subscription_state IN ("active","past_due")` of the deal's current price, billing-cadence-normalised to monthly (annual divided by 12). Read from `saas_tiers.stripe_monthly_price_amount_cents` / `stripe_annual_price_amount_cents` via `deal.saas_tier_id` + `deal.billing_cadence`. `past_due` counts toward MRR (Stripe still attempting collection); `cancelled` / `cancelling_at_period_end` past period end do not.
5. **New signups / churn window** — `newThisWindow` = count of `deals` where `created_at_ms >= windowStart AND saas_product_id IS NOT NULL AND subscription_state IS NOT NULL`. `churnThisWindow` = count of `activity_log` rows with `kind = 'saas_subscription_cancelled'` AND `created_at_ms >= windowStart`. (If `saas_subscription_cancelled` kind doesn't yet exist, fall back to counting `deals` where `subscription_state = 'cancelled'` AND `cancelled_at_ms >= windowStart`; grep-verify first and reconcile silently.)
6. **MRR delta** — current MRR vs MRR as-of `windowStart` (computed by excluding deals created after windowStart and including deals cancelled after windowStart). Returns cents delta + percentage (0% if prior MRR was 0 and current > 0 → report as `null` pct with `deltaCents`).
7. **Near cap** — reuse SB-7 usage primitive (`lib/saas-products/usage.ts`). Count distinct `(deal_id)` where any dimension's `used / limit >= settings.get("saas.near_cap_threshold")` (seed **0.8**) AND `deal.subscription_state = 'active'`. Threshold, not literal.
8. **Product Overview tab** — `app/lite/admin/products/[id]/page.tsx` Overview tab gains a headlines strip using `getSaasHeadlineSignalsForProduct(productId)`. Renders the same five numeric signals + a "Usage distribution" micro-bar showing near-cap fraction per dimension (spec §8.3 "Usage distribution chart"). Micro-bar: reuse the existing tier-breakdown `flex h-2` pattern from products/page.tsx — no new chart library.
9. **Daily Cockpit integration stub** — export `getSaasHealthBanners(userId)` from the same module returning `HealthBanner[]` matching the `getHealthBanners()` contract spelled out in `docs/specs/daily-cockpit.md` §399 (severity amber/red, payload). Emits amber when `pastDueCount > 0`; red when `dataLossWarningsSent7d > 0` (subscriber 7 days into failure — real risk of loss). Primitive is fully tested but NOT wired into a live cockpit surface (Daily Cockpit wave hasn't started yet) — this is the contract-ready shim. Naming per `sessions/phase-3.5-review-handoff.md` spec self-containment rule.
10. **Kill switch** — new `saas_headlines_enabled: true` (defaults ON). Off = products/page falls back to zero-state summary with "Headlines paused" eyebrow; per-product Overview omits the strip; `getSaasHealthBanners()` returns `[]`.
11. **Settings keys** — two new in `docs/settings-registry.md` + seed migration:
   - `saas.headline_window_days` → integer `30`
   - `saas.near_cap_threshold` → number `0.8`
12. **Tests** — `tests/saas-products/sb10-headline-signals.test.ts`:
   - MRR sums active + past_due at correct cadence-normalised amount, excludes cancelled.
   - `newThisWindow` only counts SaaS deals inside window.
   - `churnThisWindow` counts cancellation events inside window; not double-counted with subsequent re-subscription.
   - `mrrDeltaCents` matches (currentMRR − priorMRR) for a fixture with known timeline.
   - `mrrDeltaPct` returns `null` when prior MRR was 0.
   - `pastDueCount` matches `deals.subscription_state='past_due'` count.
   - `lockoutCount7d` matches activity-log count window.
   - `nearCapCount` respects 0.8 threshold, uses setting, excludes non-active.
   - `dataLossWarningsSent7d` matches handler-log count.
   - `getSaasHeadlineSignalsForProduct` scopes correctly.
   - `getSaasHealthBanners` emits amber on past_due, red on data-loss warning; empty when kill switch off.
   - Kill switch off → `getSaasHeadlineSignals` still returns numbers (it's a read; kill switch gates the *surface + banner*, not the query — confirm intent in reconciles).

## Out of scope

- Live Daily Cockpit rail rendering (future wave owns `/lite/cockpit`).
- Admin filters / date-range picker on the headlines strip (defer to post-launch — `project_strategic_planning_postlaunch`).
- Finance Dashboard MRR deep-dive (§13.9 — separate spec owner).
- Churn-reason breakdown / cancel-survey aggregation (SB-11 cancel flow owns the source data).
- Real-time push / SSE — headlines are request-time reads.
- Cross-product comparison charts.

## Gates

- **G0** — read this brief + `sessions/sb-9-handoff.md` + `sessions/sb-8-handoff.md` + spec §8.1, §8.3, §13.8 + `docs/specs/daily-cockpit.md` §399 (health-banner contract) + memories `feedback_visual_references_binding`, `feedback_individual_feel`, `feedback_no_lite_on_client_facing`, `feedback_earned_ctas_at_transition_moments`, `project_settings_table_v1_architecture`, `project_tier_limits_protect_margin`, `feedback_technical_decisions_claude_calls`, `feedback_motion_is_universal`.
- **G1 preconditions** — grep-verify:
  - `app/lite/admin/products/page.tsx` renders `SummaryCard` from `getSaasProductSummaryCounts()` (to be replaced).
  - `app/lite/admin/products/[id]/page.tsx` has an Overview tab slot (if not, scope its minimal addition here — flag in handoff if absent).
  - `deals.subscription_state` + `deals.payment_failure_count` + `deals.saas_tier_id` + `deals.billing_cadence` exist.
  - `saas_tiers.stripe_monthly_price_amount_cents` + `stripe_annual_price_amount_cents` exist.
  - `lib/saas-products/usage.ts` exposes a per-deal usage query reusable for near-cap count.
  - Activity-log kinds `saas_payment_failed_lockout`, `saas_data_loss_warning_sent` present (SB-9), `saas_subscription_cancelled` — grep; reconcile silently if absent.
  - `lib/settings.ts` registry + `settingsRegistry.get()` helper present.
  - Daily-cockpit `HealthBanner` TS type — grep for exported shape; if only prose in spec, define the type locally in `headline-signals.ts` with a `// TODO(daily-cockpit): unify type when wave opens` note (allowed per `feedback_technical_decisions_claude_calls` — primitive ships with its own type until consumer wave lands).
- **G3 whitelist (NEW unless marked):**
  - `lib/db/migrations/0028_sb10_headline_settings.sql` (NEW — two settings seeds)
  - `lib/settings.ts` (EDIT — register two keys)
  - `lib/kill-switches.ts` (EDIT — `saas_headlines_enabled`)
  - `lib/saas-products/headline-signals.ts` (NEW)
  - `lib/saas-products/queries.ts` (EDIT — deprecate/remove `getSaasProductSummaryCounts`; grep callsites first)
  - `app/lite/admin/products/page.tsx` (EDIT — wire real signals + second row)
  - `app/lite/admin/products/[id]/page.tsx` (EDIT — Overview headlines strip)
  - `components/lite/saas-admin/headline-strip.tsx` (NEW — shared between index + product detail)
  - `docs/settings-registry.md` (EDIT — two rows)
  - `tests/saas-products/sb10-headline-signals.test.ts` (NEW)
- **G4 literal grep** — no inline `30`, `0.8`, `7 * 86_400_000`, `2` (MRR delta flat band). Flat-band threshold `saas.mrr_delta_flat_band` → **0.02** if the flat-band colouring ships; otherwise drop the flat band and report up/down only (silent reconcile — document either way).
- **G6 rollback** — `feature-flag-gated` via `saas_headlines_enabled`. Migrations reversible (down-migration included). No destructive schema change.
- **G10.5 external reviewer** — required. Aggregation queries + financial signal (MRR). Reviewer checks: (a) MRR cadence normalisation is correct; (b) churn window doesn't double-count; (c) past_due counts toward active MRR matches spec §4.6 lockout semantics; (d) near-cap query uses threshold setting not literal; (e) numeric formatting reads honest (no rounding that inflates).
- **G11.b pre-compile `sessions/sb-11-brief.md`** at close. Likely topic: **SaaS cancel flow** per spec §6.6 + `/lite/portal/subscription` shared cancel infrastructure from Quote Builder §9.4, OR **SB-10.5 polish / cockpit wiring** if Daily Cockpit wave gets pulled forward. Default: cancel flow.
- **G12** — `npx tsc --noEmit` 0 errors, `npm test` green (≥ 806 baseline + SB-10 additions), manual browser walk OWED as PATCHES_OWED `sb10_manual_browser_verify`.

## Reconcile notes

- **Kill switch semantics** — gates surface + banner emission, not the primitive. Admin might still want to inspect numbers via debug routes even while the public strip is hidden. Reconcile silently; document in module header.
- **`saas_subscription_cancelled` activity kind** — grep first. If SB-subs / SB-8 introduced it, use it. If not, fall back to `deals.subscription_state='cancelled' AND cancelled_at_ms` window. Log decision in handoff.
- **`cancelled_at_ms` column** — may not exist. If absent, use `deals.updated_at_ms` when `subscription_state='cancelled'` as a proxy; not precise, but acceptable for a 30-day window. Flag as `sb10_churn_precision_upgrade` if proxy is used.
- **MRR delta flat band** — if the ±2% amber flat band is fiddly to justify visually, ship up/down only and drop the setting. Andy will see coloured movement either way; band is polish. Silent reconcile.
- **Near-cap uses SB-7 primitive** — reuse `loadDashboardUsage()`-style logic or lower-level usage query; do not re-derive usage math in `headline-signals.ts`. If no suitable per-deal primitive exists, extract one during this session and flag as a small cross-spec primitive.
- **Per-product Overview tab** — if `/lite/admin/products/[id]` currently renders no tab infrastructure (simple page), add a minimal Overview block above any existing sections and leave tab scaffolding for later. No tab library install.
- **HealthBanner type** — Daily Cockpit spec describes the shape but hasn't built the type. Define locally with a narrow interface matching §399 (`{ specSlug, kind, severity: 'amber'|'red', payload: Record<string, unknown> }`). When Daily Cockpit lands, it imports from `headline-signals.ts` or migrates the type to a shared module.
- **`feedback_individual_feel` vs admin surface** — admin cockpit is Andy's private surface; "individual" applies to client-facing. Voice can be aggregate-operational here.
- **`feedback_no_lite_on_client_facing`** — admin, so "Lite" is fine in internal copy if it appears, but keep brand-consistent ("SuperBad") for restraint.
- **Motion** — headline strip uses `houseSpring` fade-in on mount; numeric updates on refresh stagger (per `feedback_motion_is_universal`). Confetti-free — this is data, not a celebration moment.
- **`feedback_earned_ctas_at_transition_moments`** — no CTA on the strip itself. Past-due count links through to a deals-filtered list if one exists; otherwise number stays inert.

## Rollback strategy (G6)

- `feature-flag-gated` — `saas_headlines_enabled`. Flip off and pages fall back to legacy zero-state or hide the strip. Migrations are additive (2 settings rows) + reversible. Removing `getSaasProductSummaryCounts` is a breaking export change; if any unseen callsite relies on it, rollback = re-export a thin wrapper around the new primitive.

## Memory alignment (pre-flight)

- `project_tier_limits_protect_margin` — headlines make margin pressure visible; near-cap count is the upgrade-pipeline lens, past-due is the revenue-at-risk lens. Signal selection intentional.
- `feedback_visual_references_binding` — `mockup-cockpit.html` is binding for voice/density; do not ship generic dashboard styling.
- `feedback_technical_decisions_claude_calls` — expect silent reconciles on: churn fallback path, flat-band drop, HealthBanner local type, kill-switch scope.
- `project_settings_table_v1_architecture` — window + threshold both live in settings; no literals.
- `feedback_individual_feel` — admin surface, aggregate voice OK.
- `feedback_earned_ctas_at_transition_moments` — no CTAs on the strip; past-due is a number, not an ask.
- `feedback_motion_is_universal` — strip animates in with `houseSpring`.
- `project_ghl_current_stack` — headlines replace the fragment of GHL Andy uses to eyeball subscriber health.
- `feedback_no_content_authoring` — no copy composition; numeric + label only.
- `feedback_primary_action_focus` — strip is read-only; doesn't compete with pipeline/invoice CTAs.
- `feedback_no_lite_on_client_facing` — admin only, so not strictly binding; default to "SuperBad" anyway.

## Notes for the next-session brief writer (SB-11)

- SB-10 ships `getSaasHealthBanners()` contract stub. When Daily Cockpit wave opens, it imports directly from `lib/saas-products/headline-signals.ts`; no re-plumbing.
- Churn window query may use a proxy (`deals.updated_at_ms`) if `saas_subscription_cancelled` activity kind is absent — SB-11 cancel flow is the right place to introduce the canonical kind + backfill churn precision.
- MRR query normalises annual/12 — SB-11 cancel flow with `cancelling_at_period_end` needs to decide whether those count toward MRR until period end (recommend yes, consistent with Stripe collection semantics).
- If flat-band dropped in SB-10, SB-11 inherits a binary up/down MRR treatment; finance-dashboard wave can reintroduce a nuanced band later.
- Near-cap count is a natural trigger for SB-11 retention prompts (cancel-flow upgrade-instead offers).
