# `sb-6` — Locked post-payment dashboard / onboarding gate

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §3.4, §4.3, §5.1; `docs/specs/subscriber-onboarding.md` if present (otherwise derive from Brand DNA + Client Context anchors).
**Predecessor:** `sessions/sb-5-handoff.md` — checkout writes a `role="prospect"` user + deal row + prospect contact/company, redirects to `/get-started/welcome?email=…`. The welcome page is a placeholder. SB-6 replaces it with the real locked dashboard behind subscriber auth.

**Model:** `/deep` (Opus). Auth primitive choice, Brand DNA unlock sequencing, state-machine around `subscription_state` + onboarding progress.

## Goal

Ship the authenticated landing that a new SaaS subscriber hits immediately after payment: magic-link session, locked dashboard framing, Brand DNA onboarding gate as the single primary action, status-aware surfacing (active / past_due / incomplete). This is where prospect→client promotion happens.

## Acceptance criteria (G12)

1. **Magic-link subscriber auth primitive** — email-based, single-use token, short TTL, cookie-set on click, `role` promoted `prospect → client` on first successful login. Token issued by the Stripe `invoice.payment_succeeded` (or `customer.subscription.created`) webhook **and** on-demand from `/get-started/welcome` "send me my login" button for users who arrive before the webhook fires.
2. **`/lite/onboarding` locked dashboard** — authenticated, `role === "client"` gate; renders active subscription summary (product + tier + cadence + next bill), Brand DNA unlock CTA as the single primary action, "Andy will be in touch" dry-voice supporting line. No nav clutter; this is the earned transition moment per `feedback_earned_ctas_at_transition_moments`.
3. **Subscription state handling** — `subscription_state="active"` → full dashboard; `"incomplete"` or `"past_due"` → gated state with "Payment didn't land — update card" + Stripe-hosted billing portal link; no silent failures.
4. **Post-checkout redirect** — `/get-started/welcome` now redirects authenticated clients to `/lite/onboarding`; keeps the "A receipt's on the way" copy as a transient interstitial when arriving pre-webhook.
5. **Brand DNA gate** — the CTA links to `/lite/brand-dna` (or the correct BDA route); first-visit auto-enter per `project_brand_dna_flagship_experience`; skippable for now (non-blocking) but prominently surfaced.
6. **Activity log** — `subscriber_logged_in` (or existing kind) on magic-link redeem; `subscriber_promoted_from_prospect` once.
7. **No `/get-started/*` leak** — once authenticated, attempts to revisit `/get-started/checkout` for the same product redirect to `/lite/onboarding`; cross-product checkout (e.g. adding Full Suite) still allowed — keyed by `deals.saas_product_id`.

## Out of scope

- Brand DNA questionnaire itself (covered by BDA wave).
- Usage-based metering / tier limit enforcement (later wave).
- Cancel / downgrade / upgrade flows (§4.4, §5).
- Full Suite upsell mechanics beyond nudge line.

## Gates

- **G0** read this brief + `sessions/sb-5-handoff.md` + spec §3.4 / §4.3 / §5.1 + existing auth primitives (`grep -rn "magic.link\|signIn\|auth().*role"`) + `lib/db/schema/user.ts` + `lib/auth/*`.
- **G1** preconditions verify before code:
  - Session/JWT shape already carries `role` (confirmed in SB-5).
  - `user` table has a `magic_link_tokens` sibling or we add one (migration needed — flag in first pass).
  - Stripe webhook dispatcher (`invoice.payment_succeeded` / `customer.subscription.created`) has a hook slot or we add one.
  - `activity_log` kinds extended if `subscriber_logged_in` / `subscriber_promoted_from_prospect` aren't already in the enum.
- **G2** cite `docs/specs/saas-subscription-billing.md §3.4, §4.3, §5.1` in commit message.
- **G3** file whitelist (NEW unless marked):
  - `lib/auth/magic-link.ts` (issue + redeem; rate-limited)
  - `app/api/auth/magic-link/route.ts` (redeem endpoint)
  - `app/get-started/welcome/page.tsx` (MODIFY — becomes transient interstitial; "send me my login" button)
  - `app/lite/onboarding/page.tsx` (NEW — the locked dashboard)
  - `app/lite/onboarding/clients/subscriber-dashboard-client.tsx`
  - `lib/stripe/webhook-handlers/invoice-payment-succeeded.ts` (MODIFY or NEW — issue magic link, promote prospect→client)
  - `lib/db/migrations/NNNN_sb6_magic_link_tokens.sql` (if the primitive doesn't exist yet)
  - `lib/db/schema/magic-link-tokens.ts`
  - `docs/content/saas-subscription-billing/onboarding-dashboard.md` + `lib/content/onboarding-dashboard.ts`
  - `tests/auth/magic-link.test.ts`
  - `tests/lite/onboarding-page.test.ts` (or pure view-model variant if RTL avoided)
  - `tests/e2e/saas-onboarding-gate.spec.ts`
  - `sessions/sb-6-handoff.md` + `sessions/<next>-brief.md` + `SESSION_TRACKER.md`.
- **G4** literal grep: no hard-coded role strings scattered — route through `lib/auth/roles.ts`; no hard-coded Stripe billing-portal URLs.
- **G5** motion: locked dashboard uses `houseSpring` on entry; status-gated variants cross-fade via `AnimatePresence`.
- **G6** rollback: magic-link token single-use; redeem wraps `user.role` update + `activity_log` insert in a txn; webhook hook is idempotent (dedupe by `stripe_subscription_id`).
- **G7** npm deps: prefer native `crypto.randomBytes` + existing Resend client; flag if anything new needed.
- **G10.5** external-reviewer gate: **REQUIRED** — new auth primitive + state machine + post-money landing. Self-review against `feedback_setup_is_hand_held`, `feedback_individual_feel`, `feedback_earned_ctas_at_transition_moments`, `feedback_motion_is_universal`, `project_brand_dna_flagship_experience`.
- **G11.b** next brief: likely SB-7 (Brand DNA unlock flow) or first subscription-lifecycle handler (cancel / past-due recovery) — pick at session close.
- **G12** verification:
  - `npx tsc --noEmit` zero errors.
  - `npm test` green.
  - `npx playwright test tests/e2e/saas-onboarding-gate.spec.ts` green.
  - Manual browser check mandatory: checkout → welcome → "send me my login" → email arrives → click → lands in `/lite/onboarding` with Brand DNA CTA visible.

## Open question for Andy

**One:** magic-link email — plain-text or full branded template? Recommend **branded template mirroring invoice email shell** (consistency with BI-2b-ii; Brand DNA wave will write richer templates later). Confirm or redirect at session start.

## Memory-alignment to check before starting

- `feedback_setup_is_hand_held` — onboarding dashboard hand-holds into Brand DNA; no raw "set up your profile" forms.
- `feedback_earned_ctas_at_transition_moments` — post-payment IS a transition moment; one earned primary CTA.
- `feedback_individual_feel` — dashboard feels like *their* space, not a shared admin console.
- `project_brand_dna_flagship_experience` — Brand DNA unlock is the hero affordance on this screen.
- `feedback_no_lite_on_client_facing` — copy says "SuperBad", never "SuperBad Lite".
- `project_non_converter_portal_lifecycle` — not relevant here (converted subscriber path), but reference for the inverse route.
