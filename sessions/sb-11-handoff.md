# SB-11 handoff — 2026-04-15

**Wave 8 SB-11 CLOSED.** SaaS cancel flow shipped at `/lite/portal/subscription`. Shared surface, branch-dispatched by subscription state (paused / pre-term / post-term). Pre-term offers pay-remainder, 50% buyout, product soft-switch, pause, or continue; post-term offers tier up/down or final cancel. Unified `saas_subscription_cancelled` activity kind closes the SB-10 churn proxy.

**Spec:** `docs/specs/saas-subscription-billing.md` §6. **Brief:** `sessions/sb-11-brief.md`.

## What landed

- **`lib/db/schema/activity-log.ts`** (EDIT) — `saas_subscription_cancelled` added to `ACTIVITY_LOG_KINDS`. No SQL migration (TS-enforced enum).
- **`lib/kill-switches.ts`** (EDIT) — `saas_cancel_flow_enabled: true`, surface-only gate.
- **`lib/saas-products/cancel-math.ts`** (NEW) — pure `computeSaasExitMath` (ceil partial months × monthly inc-GST; buyout = `floor(remainder/2)` — client-favourable on odd cents) + DB-backed `loadSaasExitMath(dealId)` joining `deals → saas_tiers` + typed `SaasExitMathError` (codes: `deal_not_found`, `not_saas_deal`, `missing_commitment`, `missing_tier`, `missing_price`). Reuses `AVG_MONTH_MS` from `lib/subscription/remainder.ts`.
- **`lib/stripe/payment-intents.ts`** (NEW) — `createOffSessionPaymentIntent` (reads `customer.invoice_settings.default_payment_method`, throws `OffSessionPaymentError("no_default_payment_method")` if missing, confirms inline with mandatory Stripe idempotency key). `customerHasDefaultPaymentMethod` helper for CNOF gating from the route shell.
- **`lib/stripe/subscriptions.ts`** (EDIT) — `scheduleSubscriptionCancel(subId, cancelAtMs)` via `cancel_at`; `cancelSubscriptionImmediately(subId)` via `subscriptions.cancel`; `StripeLike` extended with `cancel?`.
- **`lib/saas-products/cancel-actions.ts`** (NEW, `"use server"`) — `cancelSaasSubscriptionAction(dealId, branch)` where branch ∈ `paid_remainder | buyout | post_term`:
  - kill-switch + NextAuth `role=client` + `loadSubscriberSummary` match + `no_stripe_subscription` / `missing_commitment` guards
  - write-once idempotency via `TERMINAL_STATES` short-circuit → `{ ok: true, already: true }`
  - `post_term`: rejects if `committed_until_date_ms > nowMs` (`post_term_before_boundary`), else `cancelSubscriptionImmediately` + `flipTerminalState("cancelled_post_term")` + dual-log (`saas_subscription_cancelled` + `subscription_cancelled_post_term`)
  - `paid_remainder`: `loadSaasExitMath` → `createOffSessionPaymentIntent(remainder_cents, key "saas_exit:{dealId}:paid_remainder:{YYYY-MM-DD}")` → `scheduleSubscriptionCancel(committed_until_date_ms)` → flip `cancelled_paid_remainder` + dual-log
  - `buyout`: same PI path at `buyout_cents` → `cancelSubscriptionImmediately` → flip `cancelled_buyout` + dual-log `subscription_early_cancel_buyout_50pct`
  - `switchProductSoftStepAction({dealId, newProductId, newTierId})` — thin subscriber wrapper over `applyProductSwitch` (`actor: "subscriber"`); returns `TierChangeError.code` on failure.
- **`lib/portal/cancel-copy.ts`** (NEW) — `CANCEL_COPY` with 4 COPY_OWED sentinels (`motivationalRealityCheck`, `productSwitchHeading`, `pausedHeading`, `postTermCancelConfirmHeading`) + 3 locked strings (`talkToUsLabel`, `killSwitchFallback`, `cardNotOnFileNote`). Working placeholders shipped per `feedback_no_content_authoring`; authoring owed to a mini-session with `superbad-brand-voice` loaded.
- **`app/lite/portal/subscription/page.tsx`** (NEW) — Server Component dispatcher: kill-switch fallback → NextAuth gate → `loadSubscriberSummary` → deal load → non-SaaS retainer stub (bartender link; route-lift logged as PATCHES_OWED) → branch gate (`paused` if state=paused, else `pre_term` if committed_until > now, else `post_term`) → math guarded with try/catch on `SaasExitMathError` → CNOF read via `customerHasDefaultPaymentMethod` → alternative products via `listActiveSaasProducts` filtered on `id !== saas_product_id` with first-tier-by-rank pick → higher/lower tier lists via `saas_tiers` scoped to `deal.saas_product_id` split on current `tier_rank`. Money formatted via `Intl.NumberFormat("en-AU", "currency", "AUD")`.
- **`components/lite/portal/cancel/cancel-client.tsx`** (NEW, `"use client"`) — `houseSpring` AnimatePresence dispatcher. Renders `MotivationalBanner` + `CardNotOnFileBanner` (when `!cardOnFile`) above branch content. Panels: `PausedBranch` (resume / cancel), `PreTermBranch` (product-switch entry + pay-remainder + buyout with labels + pause entry + continue — paid paths disabled when `!cardOnFile`), `PostTermBranch` (upgrade/downgrade tier cards + stay/cancel confirm), `ProductSwitch` (list of alternatives → `switchProductSoftStepAction`), `ConfirmCancel` (de-emphasised destructive — "Actually, I'll stay" as primary, "Cancel anyway" as tertiary). Actions wired via `useTransition` with error surface + `done` states.
- **`lib/saas-products/headline-signals.ts`** (EDIT) — `computeChurn` upgraded: churn now counts `activity_log` rows with `kind='saas_subscription_cancelled'` within the window (scoped by product via existing `countActivityKindSince` deal join), replacing the SB-10 `updated_at_ms` proxy. Closes `sb10_churn_precision_upgrade`. Header reconcile #2 rewritten.
- **`tests/saas-products/sb11-cancel-flow.test.ts`** (NEW, 5 tests) — `computeSaasExitMath` ceil partial months, zero remainder when lapsed, buyout floor on odd cents, 11.5mo→12mo full example, field preservation.
- **`tests/saas-products/sb10-headline-signals.test.ts`** (EDIT) — churn test now seeds `saas_subscription_cancelled` activity rows (in-window + out-of-window).

## Verification

- `npx tsc --noEmit` — 0 errors.
- `npm test` — **113 files, 822 passing / 1 skipped** (+5 from 817 SB-10 baseline).
- G10.5 external reviewer — **OWED** (state-change moment + user-visible copy).
- Manual browser walk — **OWED** (`sb11_manual_browser_verify`).
- Server Action integration tests (auth + Stripe mock + DB) — **OWED** (`sb11_action_integration_tests`).
- G11.b next-brief pre-compile (`sessions/sb-12-brief.md`) — **OWED** (`sb11_sb12_brief_precompile`).

## Silent reconciles per `feedback_technical_decisions_claude_calls`

1. **Activity-kind add needs no SQL migration.** `ACTIVITY_LOG_KINDS` is a TS const array constraining the `kind` column at the app layer; SQLite column is free-text. Added `saas_subscription_cancelled` to the const and that's it.
2. **Dual-log emission.** Brief asked for the unified kind; existing SB-7/SB-8 retainer consumers still listen for `subscription_early_cancel_paid_remainder` / `subscription_early_cancel_buyout_50pct` / `subscription_cancelled_post_term`. Every terminal branch emits BOTH — the new kind feeds churn + precision slicing via `meta.branch`; the old kinds keep the retainer audit trail unbroken. Single transaction via `Promise.all`.
3. **Idempotency key shape.** `saas_exit:{dealId}:{branch}:{YYYY-MM-DD}` — daily scope so a subscriber who retries tomorrow doesn't collide with today's succeeded intent. Stripe enforces at the API; our write-once terminal-state guard enforces at the DB.
4. **Retainer branch stubbed, not implemented.** Brief §6.6 mentioned the surface as "shared" but the retainer cancel primitive wasn't wired. Non-SaaS deals hit a "reach out" fallback with bartender link; `sb11_retainer_route_lift` opened to wire existing retainer cancel primitives through this route when that domain is next touched.
5. **CNOF gate is server-rendered, not just client UI.** `customerHasDefaultPaymentMethod` runs in the Server Component and passes `cardOnFile` to the client; the Server Action also re-checks via `OffSessionPaymentError` so a stale client can't force a paid exit without a card. Defence in depth.
6. **`computeChurn` precision upgrade bundled into SB-11.** Brief called this out as binding. Switched to activity-log read in-session; SB-10 test fixture updated to emit the new kind alongside state change.
7. **Money labels formatted at the server boundary.** Server Component pre-computes `remainder_label` / `buyout_label` / `monthly_label` as en-AU AUD strings and passes them to the client — client never runs `Intl.NumberFormat`, so render is deterministic SSR.

## PATCHES_OWED opened

- **`sb11_retainer_route_lift`** — non-SaaS deals currently hit a stub fallback. When retainer cancel domain is next touched, wire existing primitives through `/lite/portal/subscription` and remove the stub.
- **`sb11_manual_browser_verify`** — Andy drives: paused → resume/cancel. Pre-term → each paid option + confirm + product-switch. Post-term → upgrade/downgrade/cancel. CNOF: remove default PM on a test customer, confirm paid paths disable. Mockup-portal parity check.
- **`sb11_g105_external_reviewer`** — state-change moment + user-visible copy + destructive confirm UX; required per brief.
- **`sb11_action_integration_tests`** — cancel-math unit tests shipped; Server Action end-to-end (auth + Stripe mock + idempotent replay + CNOF short-circuit + state flip assertions + activity rows) owed. Pattern exists in `sb9-payment-failure.test.ts`.
- **`sb11_sb12_brief_precompile`** — G11.b owed. Pre-compile `sessions/sb-12-brief.md` at the start of next session before SB-12 build begins.
- **`sb11_copy_mini_session`** — 4 COPY_OWED sentinels (`motivationalRealityCheck`, `productSwitchHeading`, `pausedHeading`, `postTermCancelConfirmHeading`) need authoring with `superbad-brand-voice` loaded. Placeholders ship-safe but not final voice.

## PATCHES_OWED closed

- **`sb10_churn_precision_upgrade`** — `computeChurn` now reads the activity-log kind directly.

## Memory alignment

- `feedback_no_content_authoring` — COPY_OWED sentinels + placeholders; no voice composed in this build session.
- `feedback_primary_action_focus` — ConfirmCancel uses "Actually, I'll stay" as visual primary; "Cancel anyway" is de-emphasised tertiary.
- `feedback_motion_is_universal` — every panel swap animates via `houseSpring` AnimatePresence.
- `feedback_individual_feel` — copy reads the subscriber's product + tier name.
- `feedback_setup_is_hand_held` — no raw forms; every action is a card-click with confirmation.
- `feedback_no_lite_on_client_facing` — subscriber surface uses "SuperBad" framing (via copy), never "Lite".
- `project_settings_table_v1_architecture` — 50% buyout is spec-pinned (§6.5), intentionally not a setting; tier limits protect margin per `project_tier_limits_protect_margin`.
- `feedback_technical_decisions_claude_calls` — seven silent reconciles above; zero questions to Andy.

## Things SB-12 will need

- SB-12 brief pre-compile (G11.b) is the first task.
- If SB-12 touches the retainer cancel domain, pick up `sb11_retainer_route_lift`.
- If SB-12 opens a copy mini-session window, knock off `sb11_copy_mini_session` alongside.
