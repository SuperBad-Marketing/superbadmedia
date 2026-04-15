# `sb-8` — SaaS tier change + product switch

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §6 (mutations) + §2 (tier/product model).
**Predecessor:** `sessions/sb-7-handoff.md` — usage metering live; `checkUsageLimit` returns `nextTier`; period anchored on `deals.created_at_ms`; `saas_usage_enforcement_enabled` kill switch still off.
**Model:** `/deep` (Opus). Stripe Subscription mutation + pro-ration + downgrade-safe usage check + activity log + client-side tier-change surface.

## Goal

Let an active subscriber change tier (upgrade immediate + pro-rated; downgrade end-of-period) or switch to a different product (Stripe Subscription item swap). Surface the change from the subscriber dashboard (primary path off the at-cap upgrade CTA) and from the admin deal view. All mutations route through a single `applyTierChange(dealId, newTierId, opts)` / `applyProductSwitch(dealId, newProductId, newTierId, opts)` primitive that talks to Stripe + writes local rows in the same unit.

## Acceptance criteria (G12)

1. **`lib/saas-products/tier-change.ts`** exports:
   - `applyTierChange(dealId, newTierId, { mode: "upgrade" | "downgrade" }) → { scheduledFor: "immediate" | "end_of_period", effectiveAtMs }`
   - `applyProductSwitch(dealId, { newProductId, newTierId, billingCadence? }) → { effectiveAtMs }`
   - Both check `loadDashboardUsage()` for any dimension `used > next-tier.limit`; downgrade + product switch surface a pre-flight `{ blocked: true, reason: "usage_over_new_limit", dimensions }` result that the caller can either honour or override.
2. **Stripe mutations** — `stripe.subscriptions.update(...)` with `items[].price` swap + `proration_behavior: "create_prorations"` on upgrade, `proration_behavior: "none"` + `billing_cycle_anchor: "unchanged"` on downgrade (deferred-apply), product switch removes old item + adds new item atomically.
3. **Local state** — `deals.saas_tier_id` (+ `saas_product_id` on switch) updated inside same transaction as the activity log entry; `last_stage_change_at_ms` stamped; `billing_cadence` updated if it changes.
4. **Deferred downgrades** — new scheduled-task kind `saas_subscription_tier_downgrade_apply` scheduled at period end; handler flips `saas_tier_id` locally after Stripe has already swapped (Stripe does the actual swap at its period boundary via the update we queue).
5. **Dashboard surfaces** — upgrade CTA on at_cap hero (SB-7 surface) now POSTs to a Server Action that calls `applyTierChange`; success swaps the page to a celebration flourish ("New tier's live") + dismissable banner on the dashboard for 7 days.
6. **Admin deal view** — SB-2c product detail page (or the deal detail page if it exists) gets a "Change tier / switch product" action row that opens a confirm modal. Admin overrides the pre-flight block.
7. **New activity-log kinds** — `saas_tier_changed`, `saas_product_switched`, `saas_tier_downgrade_scheduled`.
8. **Tests** — `applyTierChange` upgrade/downgrade paths + pre-flight block + idempotent replay; `applyProductSwitch` clears old usage effectively (document the behaviour); scheduled downgrade handler; admin override path.

## Out of scope

- Cancellation flow (SB-11).
- Pause flow (SB-9 — payment failure branch may introduce pause states; tier change must be a no-op on `paused` deals).
- Refund math beyond Stripe's default pro-ration.
- Setup-fee re-charge on switch (SB-12 — closes resubscribe loophole).

## Gates

- G0 read this brief + `sessions/sb-7-handoff.md` + spec §6 + `project_tier_limits_protect_margin` + `feedback_setup_is_hand_held`.
- G1 preconditions: SB-7 shipped (`loadDashboardUsage` live, `nextTier` on `CheckUsageLimitResult`); Stripe Subscription update primitive exists in `lib/stripe/subscriptions.ts` (audit at brief-start — may need an extension, not a new file).
- G3 whitelist (NEW unless marked):
  - `lib/saas-products/tier-change.ts`
  - `lib/scheduled-tasks/handlers/saas-subscription-tier-downgrade-apply.ts`
  - `lib/db/schema/scheduled-tasks.ts` (EDIT — new kind)
  - `lib/db/schema/activity-log.ts` (EDIT — 3 new kinds)
  - `app/lite/onboarding/clients/onboarding-dashboard-client.tsx` (EDIT — upgrade CTA wires to Server Action + celebration flourish)
  - `app/lite/onboarding/actions-tier-change.ts` (NEW Server Action module)
  - `app/lite/admin/products/[id]/tier-change-action.tsx` (NEW admin surface) OR edit existing deal detail page
  - `tests/saas-products/sb8-*.test.ts`
- G10.5 required — tier change is a state-change moment; reviewer should sanity-check voice, pre-flight block copy, and celebration flourish proportion.
- G11.b pre-compile `sessions/sb-9-brief.md` (payment failure sequence) at close.
- G12 typecheck / unit tests / Playwright scoped spec for upgrade happy path (seed subscriber, click upgrade CTA with Stripe mocked, assert celebration).

## Reconcile notes

- **Product switch zeroes usage effectively.** Usage is keyed on `(contactId, productId, dimensionKey)`. Switching products creates a new tally. Intended behaviour — switching is a fresh start, not a migration. Document in handoff; don't try to carry over usage.
- **Period anchor survives tier change.** `deals.created_at_ms` is the anchor; a tier change within a period must NOT reset it (pro-ration math depends on Stripe's period boundary matching ours). Product switch *may* reset anchor — open question, resolve at brief-start.
- **Pre-flight usage block.** Downgrade + product-switch where the new tier's limit is below current usage → block by default, admin can override (one-click via a modal checkbox). Subscriber cannot override — spec their way to upgrade or wait for period end.
- **Kill switches** — add `saas_tier_change_enabled: true` so the whole feature can be dark-launched off if Stripe mutations start misbehaving.
- **Celebration flourish.** `houseSpring` + `AnimatePresence` swap of tier name + subtle confetti via framer-motion (no third-party lib). Follow `feedback_earned_ctas_at_transition_moments` — this IS the earned moment.
- **Payment failure crossover.** If subscriber is `past_due`, tier change is blocked with a copy pointer to the billing portal. SB-9 will flesh out `past_due` handling; SB-8 just respects it.
