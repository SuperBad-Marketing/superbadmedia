# `sb-11` — SaaS cancel flow (`/lite/portal/subscription`)

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §6 (full cancel flow) + §6.5 pre-term branches + §6.6 post-term branches + §6.7 card-not-on-file edge. Shared route with retainer cancel (Quote Builder §9.4); SaaS-specific branching added here.
**Predecessor:** `sessions/sb-10-handoff.md` (headlines primitive + HealthBanners — churn signal currently proxies `deals.updated_at_ms`; this session owns the canonical kind). `sessions/sb-9-handoff.md` (payment-failure lockout; subscribers in lockout still land on this route via portal). `sessions/sb-8-handoff.md` (tier-change activity kinds; product-switch soft first step reuses SB-8 product-switch action).
**Visual reference (binding per `feedback_visual_references_binding`):** `mockup-portal.html` for cancel-surface voice + density; fall back to `mockup-cockpit.html` only for shared chrome primitives. §6.1 motivational copy authored by a content mini-session with `superbad-brand-voice` loaded — **do not** compose in-build; use a named placeholder string the Phase 5 copy wave will fill, or pull the voice-locked string from an already-landed copy constant file (grep first).
**Model:** `/deep` (Opus). Branch logic + idempotent exit actions + Stripe subscription mutation + shared retainer/SaaS route.

## Goal

Ship `/lite/portal/subscription` as a shared cancel surface that branches by subscription type (SaaS vs retainer) and commitment state (paused / pre-term / post-term), landing the four SaaS pre-term options (pay remainder / 50% buyout / 1-month pause / continue), post-term upgrade/downgrade/cancel branches, product-switch soft first step, and the card-not-on-file fallback. All terminal transitions emit the new `saas_subscription_cancelled` activity kind so SB-10's churn signal upgrades off the `updated_at_ms` proxy.

## Acceptance criteria (G12)

1. **Route shell** — `app/lite/portal/subscription/page.tsx` resolves the subscriber's active SaaS deal (via magic-link session from SB-6a), determines the branch via `§6.4 gate`, and dispatches to one of: `PausedStatus` / `PreTermBranch` / `PostTermBranch`. Retainer deals render the Quote Builder §9.4 shared layout unchanged — the SaaS vs retainer split is a single `if (deal.saas_product_id)` switch at the top.
2. **Motivational reality check** — `§6.1` copy rendered above branch options. Copy loaded from `lib/portal/cancel-copy.ts` (new constant module) — content mini-session authors the string out-of-band; this session ships a placeholder marked with a `// COPY_OWED: cancel.motivational_reality_check` sentinel. No in-brief composition (per `feedback_no_content_authoring`).
3. **Product switch soft first step** — `§6.2` renders `listActiveSaasProducts()` filtered to products the subscriber is not on; one-click switch reuses SB-8's product-switch Server Action. On switch success the page closes with a portal redirect; on dismiss proceeds to branch options. Skipped entirely if the subscriber is the only active product's subscriber (no alternative).
4. **Pre-term branch (`§6.5`)** — four options as specified:
   - **Pay remainder** — confirmation screen with `remainder_cents = monthly_amount_cents * ceil((committed_until_date - today) / 30)` (helper in `lib/saas-products/cancel-math.ts`, literal-free — reads `deals.committed_until_date` + current tier's `monthly_price_cents_inc_gst`). Off-session PaymentIntent via existing `createOffSessionPaymentIntent()` helper; idempotency `saas_exit:{deal_id}:paid_remainder:{today_iso}`. On success: `deals.subscription_state = 'cancelled_paid_remainder'`, Stripe subscription `cancel_at = committed_until_date`, activity-log `saas_subscription_cancelled` (see AC11).
   - **50% buyout** — same pattern, `buyout_cents = Math.floor(remainder_cents / 2)`. Access ends immediately, `subscription_state = 'cancelled_buyout'`, Stripe subscription cancelled immediately; idempotency `saas_exit:{deal_id}:buyout:{today_iso}`.
   - **1-month pause** — reuses Quote Builder §9.3 pause action; anti-stack disabled when `pause_used_this_commitment=true`. Resume-reminder email gains the cancel-link variant (Q16 amendment) — emit via existing scheduled-email primitive; flag `pause_reminder_cancel_link_variant` OWED if the email template doesn't have a cancel-visible variant yet.
   - **Continue** — client-side close; no action.
5. **Post-term branch (`§6.6`)** — three options: **Upgrade** lists higher-ranked tiers in the same product; click logs intent + routes to the SB-8 upgrade flow. **Downgrade** lists lower-ranked tiers; click logs intent + routes to the SB-8 deferred-downgrade flow. Edge: already on smallest tier → "you're already on the smallest plan." **Cancel** renders the "here's what you'd be losing" list from the current tier's limits + feature flags; two buttons `actually, I'll stay` + `cancel anyway`; cancel-anyway calls Stripe `subscriptions.cancel()` immediately and sets `subscription_state = 'cancelled_post_term'`.
6. **Paused branch** — `§6.4` renders a status card (currently paused until `paused_until_ms`) with three actions: **Resume early** / **Extend pause** (if not stacked beyond anti-stack limit) / **Cancel** (jumps into the appropriate pre-term or post-term branch ignoring the pause). No motivational copy on the paused branch; it already has a resume-email cancel link.
7. **Card-not-on-file edge (`§6.7`)** — if `customer.default_payment_method` is absent at route render (read via existing Stripe customer helper), paid-exit options (pay remainder + 50% buyout) are rendered disabled with a muted note + a prominent "Talk to us" button that opens the portal chat (bartender). Pause + continue remain enabled. Free exit (post-term cancel) also remains enabled.
8. **Shared retainer route unchanged** — retainer branch must render exactly what Quote Builder §9.4 currently ships; grep-verify no existing retainer portal tests regress. If retainer cancel isn't yet routed through `/lite/portal/subscription`, this session lifts the existing retainer cancel surface into the shared path and leaves a breadcrumb comment at the old location.
9. **Server Actions** — `lib/saas-products/cancel-actions.ts` exports `cancelSaasSubscriptionAction(dealId, branch: 'paid_remainder' | 'buyout' | 'post_term')` + `switchProductSoftStepAction(dealId, newProductId)` wrapper over SB-8. All actions admin/session-gated (subscriber session only — not admin; grep `auth()` precedent from SB-6a portal).
10. **Kill switch** — new `saas_cancel_flow_enabled: true` (defaults ON). Off → route 404s with a "Talk to us" bartender link. Pre-launch safety valve if a Stripe mutation bug surfaces.
11. **New activity-log kind `saas_subscription_cancelled`** — migration adds the kind to `ACTIVITY_LOG_KINDS`. Emitted on all three terminal transitions (`cancelled_paid_remainder` / `cancelled_buyout` / `cancelled_post_term`); `meta.branch` carries the option. SB-10's `computeChurn()` in `lib/saas-products/headline-signals.ts` **must** switch off the `updated_at_ms` proxy and read this kind in the same session — closes `sb10_churn_precision_upgrade`.
12. **Tests** — `tests/saas-products/sb11-cancel-flow.test.ts`:
    - Branch gate: paused → paused; pre-term → pre-term; post-term → post-term.
    - `remainder_cents` math correct for 1, 5, 11.5 months remaining (ceil rule).
    - `buyout_cents` = `floor(remainder / 2)` client-favourable.
    - Paid-remainder action: Stripe subscription `cancel_at` set; `subscription_state` flipped; activity row written; idempotent re-run is a no-op.
    - Buyout action: Stripe subscription cancelled immediately; state flipped; idempotent.
    - Post-term cancel: Stripe cancel + state flip; activity row.
    - Card-not-on-file: paid options disabled; free exits enabled.
    - Product switch soft step: skipped when no alternative products; routes to SB-8 action when one exists.
    - `sb10_churn_precision_upgrade` closure: `computeChurn()` reads activity-log + test fixture proves it over the `updated_at_ms` proxy regression case.
    - Kill switch off → route returns 404 + bartender link shape.

## Out of scope

- Bartender chat render itself (lives in Client Management spec; "Talk to us" is a link, not a rebuild).
- Finance-side refund handling (post-launch; §10 reconciliation).
- Churn-reason survey (post-launch polish; data not yet requested by spec).
- Retainer §9.4 rework beyond the route-lift (retainer owns its own wave).
- Email-template authoring for the resume-reminder cancel-link variant if the base template lacks the slot (defer to `pause_reminder_cancel_link_variant` patch).
- Win-back offers / discount presentation (spec §6.1 explicitly forbids).

## Gates

- **G0** — read this brief + `sessions/sb-10-handoff.md` + `sessions/sb-9-handoff.md` + `sessions/sb-8-handoff.md` + spec §6 + Quote Builder §9.3/§9.4 + memories `feedback_visual_references_binding`, `feedback_no_content_authoring`, `feedback_individual_feel`, `feedback_primary_action_focus`, `feedback_earned_ctas_at_transition_moments`, `project_settings_table_v1_architecture`, `feedback_technical_decisions_claude_calls`, `feedback_motion_is_universal`, `project_tier_limits_protect_margin`.
- **G1 preconditions** — grep-verify:
  - `deals.committed_until_date`, `deals.saas_tier_id`, `deals.saas_product_id`, `deals.subscription_state`, `deals.paused_until_ms`, `deals.pause_used_this_commitment` exist.
  - `DEAL_SUBSCRIPTION_STATES` contains `cancelled_paid_remainder`, `cancelled_buyout`, `cancelled_post_term`, `paused`.
  - Quote Builder §9.3 pause action + retainer §9.4 cancel surface — locate the existing file(s); note the path for the route-lift.
  - SB-8 product-switch + tier-change Server Actions — locate exported names.
  - `createOffSessionPaymentIntent()` or equivalent — grep; if absent, build a minimal wrapper + flag.
  - Stripe `subscriptions.update({ cancel_at })` + `subscriptions.cancel()` helpers — grep in `lib/stripe/**`.
  - Subscriber magic-link session (SB-6a) — confirm `auth()` returns the subscriber's deal id.
  - `ACTIVITY_LOG_KINDS` enum file — locate; `saas_subscription_cancelled` is the new entry.
- **G3 whitelist (NEW unless marked):**
  - `lib/db/migrations/00XX_sb11_cancel_activity_kind.sql` (NEW — adds `saas_subscription_cancelled` kind)
  - `lib/activity-log.ts` or equivalent enum file (EDIT — add kind)
  - `lib/settings.ts` / `lib/kill-switches.ts` (EDIT — `saas_cancel_flow_enabled`)
  - `lib/saas-products/cancel-math.ts` (NEW — remainder + buyout helpers)
  - `lib/saas-products/cancel-actions.ts` (NEW — Server Actions)
  - `lib/saas-products/headline-signals.ts` (EDIT — `computeChurn()` switches to activity-log)
  - `lib/portal/cancel-copy.ts` (NEW — copy constants + `COPY_OWED` sentinels)
  - `app/lite/portal/subscription/page.tsx` (NEW or EDIT if retainer path already there)
  - `components/lite/portal/cancel/**` (NEW — branch components)
  - `tests/saas-products/sb11-cancel-flow.test.ts` (NEW)
- **G4 literal grep** — no inline `30` (day-rounding → `SAAS_REMAINDER_MONTH_DAYS` constant or helper), no inline `0.5` in buyout (use `Math.floor(remainder / 2)`), no hard-coded Stripe status strings outside the existing mapper.
- **G6 rollback** — `feature-flag-gated` via `saas_cancel_flow_enabled`. Migration additive (enum extension). Stripe mutations are all idempotent via the documented idempotency keys. Terminal-state transitions are write-once (re-run is a no-op guard).
- **G10.5 external reviewer** — **required**. Terminal financial transitions + Stripe mutations + idempotency. Reviewer checks: (a) remainder + buyout math matches spec; (b) idempotency keys scoped correctly; (c) card-not-on-file branch genuinely disables paid paths (server-side, not just UI); (d) `computeChurn()` upgrade doesn't regress SB-10 tests; (e) retainer route-lift preserves existing behaviour.
- **G11.b pre-compile `sessions/sb-12-brief.md`** at close. Likely topic: **SB-12** per BUILD_PLAN (confirm at close — likely the **portal bartender SaaS-awareness** session or **SaaS trial period** if scheduled; default to the next `SB-N` brief title in BUILD_PLAN.md ordering).
- **G12** — `npx tsc --noEmit` 0 errors, `npm test` green (baseline 817 + SB-11 additions; SB-10 churn test migrates to the canonical kind and should still pass), manual browser walk OWED as `sb11_manual_browser_verify`.

## Reconcile notes

- **Motivational copy** — ship a placeholder; `COPY_OWED` sentinel is the canonical mechanism (per `feedback_no_content_authoring`). Do not attempt to write the entrepreneurship reality message in-build.
- **Retainer route-lift** — if the existing retainer cancel lives at a different path (e.g. `/lite/portal/cancel`), prefer redirecting the old path → new shared `/lite/portal/subscription`. Don't fork the route tree.
- **"Talk to us" bartender link** — if bartender chat isn't a first-class route yet, link to the portal home chat and leave a `TODO(bartender)` comment. Don't build bartender in this session.
- **Pause anti-stack** — reuse Quote Builder §9.3's `pause_used_this_commitment` check unchanged; don't re-derive.
- **SB-10 churn-signal upgrade is in-scope** — this session closes `sb10_churn_precision_upgrade` explicitly. Treat it as a binding AC, not a nice-to-have.
- **Kill-switch scope** — gates the surface; does NOT gate the Stripe cancel path (admin can still cancel from the admin UI if that exists later). Mirrors SB-10's kill-switch-doesn't-gate-primitive pattern.
- **`feedback_earned_ctas_at_transition_moments`** — cancel is a genuine transition moment; the motivational copy + product-switch soft step are earned CTAs, not mid-arc clutter. This is the exception, not a violation.
- **`feedback_primary_action_focus`** — the page has multiple options by necessity; ordering is the primary-action discipline (product switch > pause > paid-exit > cancel), de-emphasising the destructive option (charcoal-on-cream confirms per Quote Builder pattern).
- **`feedback_individual_feel`** — subscriber-facing surface; ensure copy references the subscriber's own product + tier + dates, not aggregate language.

## Rollback strategy (G6)

- `feature-flag-gated` — `saas_cancel_flow_enabled`. Flip off → 404 with bartender fallback. Stripe mutations idempotent; terminal states write-once. Migration additive; down-migration removes the enum member (safe if no rows exist yet, which is true pre-launch).

## Memory alignment (pre-flight)

- `feedback_no_content_authoring` — motivational reality-check copy is authored out-of-band; placeholder + `COPY_OWED` sentinel.
- `feedback_visual_references_binding` — bind to `mockup-portal.html`; no generic cancel-page styling.
- `feedback_individual_feel` — subscriber-specific numbers + dates, not aggregate.
- `feedback_earned_ctas_at_transition_moments` — cancel is a valid transition moment for a soft product-switch CTA + pause offer.
- `feedback_primary_action_focus` — destructive actions de-emphasised via weight + ordering.
- `feedback_motion_is_universal` — branch transitions animate on `houseSpring`; confirm panels morph in via `AnimatePresence`.
- `project_settings_table_v1_architecture` — kill switch + any thresholds via `settings.get()`; no literals.
- `project_tier_limits_protect_margin` — post-term cancel "here's what you'd be losing" list reads honest limits + feature flags from the current tier.
- `feedback_technical_decisions_claude_calls` — expect silent reconciles on: retainer route-lift path, Stripe helper names, bartender link target, `cancel_at` vs immediate cancel Stripe shape.

## Notes for the next-session brief writer (SB-12)

- SB-11 closes `sb10_churn_precision_upgrade`. SB-12 inherits a canonical `saas_subscription_cancelled` kind — no more `updated_at_ms` proxy anywhere.
- Cancel-flow motivational copy is a `COPY_OWED` sentinel — content mini-session wave is a downstream dependency.
- Retainer route-lift may expand this surface's scope if the existing retainer cancel was structurally different than expected — flag scope drift early and split if needed.
- Bartender `Talk to us` link is a stub; bartender SaaS-awareness session is a natural SB-12 candidate.
