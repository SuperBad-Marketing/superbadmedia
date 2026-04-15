# SB-8 handoff — 2026-04-15

**Wave 8 SB-8 CLOSED.** SaaS tier change + product switch primitives landed with upgrade (immediate, pro-rated), downgrade (deferred to period boundary via new scheduled task), product switch (atomic Stripe item swap), admin-override pre-flight block, kill switch, dashboard upgrade CTA wired to Server Action with celebration flourish.

**Spec:** `docs/specs/saas-subscription-billing.md` §6 + §2. **Brief:** `sessions/sb-8-brief.md`.

## What landed

- **`lib/stripe/subscriptions.ts`** (NEW) — `swapSubscriptionPrice({mode: "immediate" | "deferred"})`, `switchSubscriptionProduct(...)`, `readCurrentPeriodEndMs(...)`. Immediate mode sets `proration_behavior: "create_prorations"`; deferred sets `proration_behavior: "none"` + `billing_cycle_anchor: "unchanged"`. Product switch does delete-old + add-new in one atomic update.
- **`lib/saas-products/tier-change.ts`** (NEW, ~340 lines) — `applyTierChange(dealId, newTierId, {mode, overrideBlock?, actor?})` + `applyProductSwitch(dealId, {newProductId, newTierId, newBillingCadence?})` + typed `TierChangeError`. Pre-flight usage check on downgrade consults `loadDashboardUsage()` and returns `{blocked: true, reason: "usage_over_new_limit", dimensions}` when any dim's current `used > newTier.limit`. Price ID picked from `saas_tiers.stripe_*_price_id` by `deal.billing_cadence`. Mode/rank sanity rejects upgrade-that-is-downgrade and vice versa. Guards `subscription_state === "active" | null`.
- **`lib/scheduled-tasks/handlers/saas-subscription-tier-downgrade-apply.ts`** (NEW) — handler re-checks state, calls `swapSubscriptionPrice(mode: "deferred")`, flips `deals.saas_tier_id`, logs `saas_subscription_downgraded`. Idempotent on re-run (no-op if already on target tier, no-op if subscription not `active`).
- **`lib/scheduled-tasks/handlers/index.ts`** (EDIT) — spreads `SAAS_TIER_CHANGE_HANDLERS` into the registry.
- **`lib/db/schema/scheduled-tasks.ts`** (EDIT) — `"saas_subscription_tier_downgrade_apply"` added to `SCHEDULED_TASK_TYPES` (SaaS cohort 4 → 5).
- **`lib/db/schema/activity-log.ts`** (EDIT) — `"saas_tier_downgrade_scheduled"` added. Existing `saas_subscription_upgraded` / `_downgraded` / `_product_switched` kinds reused (silent reconcile; see below).
- **`lib/kill-switches.ts`** (EDIT) — new `saas_tier_change_enabled: true` (defaults ON). `applyTierChange` + `applyProductSwitch` throw `TierChangeError("tier_change_disabled")` when off.
- **`app/lite/onboarding/actions-tier-change.ts`** (NEW) — `"use server"` module. `requestSubscriberUpgradeAction(newTierId)` — session-gated (`role=client`), resolves the subscriber's deal via `loadSubscriberSummary`, delegates to `applyTierChange` with `mode: "upgrade"`, `actor: "subscriber"`. Returns `{ok, result, error}`.
- **`app/lite/admin/products/[id]/tier-change-action.tsx`** (NEW) — `"use server"` module at the path the brief names. `adminApplyTierChangeAction({dealId, newTierId, mode, overrideBlock?})` + `adminApplyProductSwitchAction({dealId, newProductId, newTierId, newBillingCadence?})`. Both admin-gated; both pass `actor: "admin"` for activity-log attribution. Not yet wired into a page — no per-deal admin detail view exists (see PATCHES_OWED below).
- **`app/lite/onboarding/clients/onboarding-dashboard-client.tsx`** (EDIT) — `UpgradeCard` converted from `<Link>` to `<button>` + `useTransition` + Server Action call. Success → layout swap to celebration card with "New tier's live." headline + 12-piece framer-motion confetti on `houseSpring`. Error → dry inline line under the CTA. Pending → disabled button + "Working…" eyebrow. Idle CTA preserved with `data-testid="upgrade-cta"` + new `data-pending`.
- **`tests/saas-products/sb8-tier-change.test.ts`** (NEW, 11 tests) — upgrade happy path (Stripe call shape + deal row + activity log), same-tier reject, upgrade-with-lower-rank reject (mode_mismatch), downgrade pre-flight block, admin-override bypass (scheduled task + no deal mutation + `saas_tier_downgrade_scheduled` log), downgrade-within-limit schedules cleanly, kill-switch off, past_due reject, product switch (deal row + Stripe items + activity log), downgrade-apply handler (deferred swap flags + tier flip + log), handler no-op on past_due.

## Verification

- `npx tsc --noEmit` — 0 errors.
- `npm test` — 110 files, 800 passing / 1 skipped (+11 from 789 SB-7 baseline).
- Playwright scoped spec — **DEFERRED** to PATCHES_OWED `sb8_playwright_upgrade_e2e` (needs Stripe stub plumbing; tier change isn't on the mandatory-E2E critical-flow list per `START_HERE.md` Phase 4 step 11 bullet 5; unit coverage is comprehensive).
- G4 literal grep: no autonomy tunables introduced. Period end comes from Stripe (`current_period_end`), tier ranks come from `saas_tiers`, price IDs from `saas_tiers.stripe_*_price_id`. No literals to convert.
- Manual browser walk: **owed** (PATCHES_OWED `sb8_manual_browser_verify`).

## Silent reconciles per `feedback_technical_decisions_claude_calls`

1. **Activity-log kinds reuse existing `saas_subscription_upgraded` / `_downgraded` / `_product_switched`.** Brief asked for `saas_tier_changed` / `saas_product_switched` / `saas_tier_downgrade_scheduled`. The first two duplicate semantics already in the enum; only the scheduled-intent kind is genuinely new. Collapsed.
2. **Product-switch pre-flight is a no-op.** Brief AC #1 names product switch alongside downgrade for the pre-flight usage block, but the brief's own Reconcile notes spell out that switching products zeroes usage by definition (keyed on `(contactId, productId, dimensionKey)`). Blocking on current-product usage against new-product limits has no meaning. Documented in the module header; admin callers should expect it to never block.
3. **Subscriber Server Action is upgrade-only.** Spec §6.6 puts downgrade + cancel in `/lite/portal/subscription` (Quote Builder §9.4 shared flow). Subscriber-initiated downgrade from the onboarding dashboard isn't a real path in v1 — the at-cap CTA is always an upgrade. Only the admin Server Action exposes `mode: "downgrade"`.
4. **Admin surface not wired into a page.** Brief allows "SB-2c product detail page ... OR edit existing deal detail page". No per-deal admin detail page exists, and the product detail page doesn't list subscribers. Shipped the Server Action primitives at `app/lite/admin/products/[id]/tier-change-action.tsx` (the exact path the brief names) so a future deal-list / subscriber-search UI can import them. Opened `sb8_admin_tier_change_wired_surface` as PATCHES_OWED.
5. **Playwright spec deferred.** Brief G12 called for scoped Playwright upgrade spec with Stripe mocked. No existing Stripe stubbing primitive in the repo — every Stripe mutation path uses `getStripe()` singleton. Building the stub plumbing + fixture is a session on its own. Tier-change isn't on the mandatory-E2E list (the `START_HERE.md` list is: trial shoot booking, quote accept, invoice pay, subscription signup, portal auth — SB-8 is a subscription *mutation*, not the initial signup). Opened `sb8_playwright_upgrade_e2e`.
6. **`TierChangeError` instead of `{ok, error}`.** Internal primitive throws on guardrail violations; Server Actions catch and convert to `{ok: false, error: code}` at the HTTP boundary. Keeps the internal contract sharp.
7. **Mode/rank sanity check inside `applyTierChange`.** Brief didn't spell this out. Without it, a misconfigured admin UI could submit `mode: "upgrade"` with a lower-rank tier and silently trigger `proration_behavior: "create_prorations"` on what's really a downgrade. Hardened at the primitive layer.
8. **`billing_cycle_anchor: "unchanged"` on deferred swap.** String literal per Stripe's API (alongside `"now"` + timestamp), not a numeric anchor. Stripe types accept it at runtime. Current period end is read at schedule-time (upgrade path) from Stripe rather than from our `deals` row, because Stripe is the source of truth for the boundary and our `committed_until_date_ms` tracks the commitment, not the billing period.

## PATCHES_OWED opened

- **`sb8_manual_browser_verify`** — Andy to drive: land on `/lite/onboarding` as at_cap subscriber → click upgrade CTA → confirm pending state → (Stripe call will hit live Stripe in dev unless stubbed) → confirm celebration card renders with confetti + "New tier's live." headline. Expect to flag any visual polish gaps.
- **`sb8_playwright_upgrade_e2e`** — build a minimal Stripe stub (env-flag-gated `getStripe()` override or global test-only injection) + fixture for at_cap subscriber → Playwright spec that seeds, redeems magic link, clicks `data-testid="upgrade-cta"`, asserts `data-testid="upgrade-celebration"` visible. One session on its own.
- **`sb8_admin_tier_change_wired_surface`** — admin deal-detail page doesn't exist; when it does (or when the product detail page grows a subscriber list), wire `adminApplyTierChangeAction` + `adminApplyProductSwitchAction` + a confirm modal with the override checkbox.
- **`sb8_enforcement_flip_checklist`** — extension of SB-7's flip checklist: once `saas_usage_enforcement_enabled` flips, verify the at-cap hero still renders the upgrade CTA and that the Server Action still works while hard caps are live (no infinite loops, no circular blocks).
- **`sb8_downgrade_apply_concurrent_state_race`** — if a subscriber flips to `past_due` between the `applyTierChange` schedule and the handler fire, the handler no-ops silently. That's safe, but the queued task sits in the table forever. Add a sweeper or scope the handler to mark the task `skipped` with a reason.

## PATCHES_OWED closed

None this slice.

## Things SB-9 will need

- `subscription_state` is now consulted in two mutation paths (`applyTierChange` + `applyProductSwitch`). Payment-failure branch (SB-9) will set `past_due`; confirm tier-change gracefully rejects when SB-9 lands.
- `saas_tier_change_enabled` kill switch is separate from `saas_usage_enforcement_enabled`. SB-9's payment-failure path should NOT flip either.
- Downgrade-apply handler ignores non-active states. If SB-9 adds a `paused` state transition, the deferred swap task sits waiting; add a sweeper during SB-9 if the pause flow ends up common.
- Activity log now carries `saas_subscription_product_switched` with `from_product_id` + `to_product_id` — SB-9's payment-failure history view can render these alongside failure kinds.

## Memory alignment

- `project_tier_limits_protect_margin` — tier change IS the margin-protection lever; upgrade promotes CTA, downgrade pre-flight blocks regressions that would over-serve at a lower price.
- `feedback_setup_is_hand_held` — upgrade is a single click from the at-cap CTA; no form, no confirmation modal at the primitive layer (admin override is a one-call flag).
- `feedback_technical_decisions_claude_calls` — eight silent reconciles documented above; zero questions asked of Andy.
- `feedback_earned_ctas_at_transition_moments` — at-cap is the earned transition; upgrade + celebration flourish land at the right moment.
- `feedback_motion_is_universal` — celebration card uses `houseSpring` + `AnimatePresence`; confetti pieces use framer-motion only (no third-party library).
- `project_settings_table_v1_architecture` — no literals introduced (Stripe + tier DB are sources of truth for all tunables SB-8 touches).
- `feedback_individual_feel` — upgrade card reads the subscriber's own tier name + next tier name; not communal.
- `feedback_no_lite_on_client_facing` — no "Lite" on the surface.
- `feedback_primary_action_focus` — at-cap variant still has one primary action (upgrade); error / pending states ride on the same card without adding clutter.
