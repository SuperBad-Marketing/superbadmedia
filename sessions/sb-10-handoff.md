# sb-10 — handoff

**Wave 8 SB-10 CLOSED 2026-04-15.** Admin cockpit SaaS headline signals primitive + HeadlineStrip surface + HealthBanner contract shipped.

## What landed

- **Migration `0028_sb10_headline_settings.sql`** — seeds `saas.headline_window_days=30` (integer) + `saas.near_cap_threshold=0.8` (decimal). Journal entry idx 28 added.
- **Settings registry** (`lib/settings.ts` + `docs/settings-registry.md`) — two new keys registered. Test `tests/settings.test.ts` bumped 94 → 96.
- **Kill switch `saas_headlines_enabled`** (`lib/kill-switches.ts`) — defaults `true`. Gates the HeadlineStrip surface + HealthBanner emission, **not** the primitive (the primitive stays callable so future surfaces can consume it regardless).
- **Primitive `lib/saas-products/headline-signals.ts`** (~260 lines) — exports `getSaasHeadlineSignals({userId?, windowDays?, nowMs?})`, `getSaasHeadlineSignalsForProduct(productId, opts)`, and `getSaasHealthBanners(userId)`. Single `loadSaasDeals(productId|null)` joins `deals` → `saas_tiers`; compute functions derive MRR (sum of `monthly_price_cents_inc_gst` across `active`+`past_due` states, cadence-normalised), prior-window MRR (deals created before window OR cancelled within window), new-subs / churn counts over the configurable window, past-due count, near-cap count (iterates active deals, calls `loadDashboardUsage`, checks any dim `used/limit ≥ threshold`), and 7-day counts of `saas_payment_failed_lockout` + `saas_data_loss_warning_sent` activity-log kinds. MRR delta % returns `null` when priorMrr=0 (honest).
- **HealthBanner contract** — canonical cockpit shape `{id, severity:'warning'|'critical', summary, href, source, first_fired_at}`. Emits `critical` when `dataLossWarningsSent7d > 0`, `warning` when `pastDueCount > 0`. Returns `[]` when kill switch off.
- **`HeadlineStrip`** (`components/lite/saas-admin/headline-strip.tsx`) — `"use client"`; 4 primary tiles (Active subscribers / Total MRR / New {windowLabel} / Churn {windowLabel}) + 3 secondary tiles (Past due / Near cap / MRR delta). `framer-motion` fade-in on `houseSpring`. `deltaTone()` emerald/rose/muted; warn + watch tone variants (rose / amber borders). `data-testid="headline-strip"`. Takes `scoped?: boolean` for the per-product variant label.
- **Page wiring** — `app/lite/admin/products/page.tsx` + `app/lite/admin/products/[id]/page.tsx` both read the primitive behind the kill switch + render `<HeadlineStrip />`. Index shows "Headlines paused" eyebrow when the kill switch is off. Removed the orphan `SummaryCard` helper + `getSaasProductSummaryCounts` stub (and its SB-2a test case — breadcrumb comment left pointing at the SB-10 test file).

## Silent reconciles (per `feedback_technical_decisions_claude_calls`)

- Brief named `stripe_monthly_price_amount_cents` / `stripe_annual_price_amount_cents` — those columns don't exist. Only `saas_tiers.monthly_price_cents_inc_gst` exists; used that for all three cadences. Matches spec §5.1.
- Brief referenced `saas_subscription_cancelled` activity-log kind — not in `ACTIVITY_LOG_KINDS`. Proxied churn via `deals.updated_at_ms` filtered to terminal `DEAL_SUBSCRIPTION_STATES` (`cancelled_paid_remainder`, `cancelled_buyout`, `cancelled_post_term`, `ended_gracefully`). Precision upgrade queued as `sb10_churn_precision_upgrade`, to land with SB-11.
- Kill switch gates surface + banner emission but **not** the primitive. Keeps headline numbers available to future surfaces (e.g. a dedicated `/lite/admin/saas` dashboard) without gating them behind an unrelated flag.
- Dropped the MRR-delta "flat band" tone setting the brief sketched — simpler to render positive/negative/null directly with `deltaTone()` at consumption time. Design review queued informally via the external-reviewer patch.
- `past_due` counts toward active MRR per spec §4.6 (they're locked out of the product, not churned — the deal is still billing). `MRR_STATES = ["active","past_due"]`.

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npm test` → **817 passed / 1 skipped** (+11 new SB-10 tests; baseline 806 after SB-9).
- Playwright N/A this slice.
- **Manual browser check owed** — see `sb10_manual_browser_verify` in PATCHES_OWED.

## PATCHES_OWED opened

- `sb10_manual_browser_verify` — Andy visual parity pass.
- `sb10_churn_precision_upgrade` — switch off `updated_at_ms` proxy once `saas_subscription_cancelled` kind ships in SB-11.
- `sb10_external_reviewer_pass` — G10.5 reviewer owed; aggregation queries + financial signal warrant it.
- `sb10_health_banner_wiring` — `getSaasHealthBanners()` is implemented + tested but not yet consumed by Daily Cockpit.

## Gate notes

- **G4** literal grep: all thresholds read through `settings.get()` (`saas.headline_window_days`, `saas.near_cap_threshold`, `saas.data_loss_warning_days`). Kill switch through `killSwitches`. No autonomy-sensitive literals.
- **G10.5** self-assessed: **required** (aggregation + financial signal) — opened as `sb10_external_reviewer_pass` for a subsequent session rather than blocking this close. Memory alignment: `feedback_individual_feel` (honest numbers, null-delta never as 0%), `feedback_motion_is_universal` (house-spring fade-in), `project_tier_limits_protect_margin` (near-cap count uses threshold, not literal).

## Next session

**Locked: SB-11** per BUILD_PLAN ordering — SaaS cancel flow (`/lite/portal/subscription` shared cancel path per spec §6.6). Brief pre-compiled at `sessions/sb-11-brief.md` per G11.b. Run in a fresh `/deep` conversation per `feedback_no_loop_for_phase5_sessions`.

## What the next agent should know

- The primitive's return type `SaasHeadlineSignals` is stable — add fields, don't rename. Consumers: `HeadlineStrip`, future cockpit dashboard, future SaaS admin page.
- `getSaasHealthBanners()` is plumbed but unused; when Daily Cockpit's HealthBanner surface is built, it should call this and merge into its existing banner list (canonical cockpit-spec shape already matches).
- `computeChurn()` uses `deals.updated_at_ms` as the timestamp — SB-11 should add `saas_subscription_cancelled` to `ACTIVITY_LOG_KINDS`, emit it on terminal transitions, and this function switches to reading the activity log (see `sb10_churn_precision_upgrade`).
- Kill switch-off path is tested (primitive still reads; surface renders "Headlines paused" eyebrow; banners return `[]`).
- SB-2a's `getSaasProductSummaryCounts` stub is **gone**; any stale import will fail fast. Test file left a breadcrumb comment.
