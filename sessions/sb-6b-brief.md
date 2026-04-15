# `sb-6b` — SaaS onboarding gate — full dashboard + status variants + Brand DNA CTA + E2E

**Wave:** 8. **Type:** FEATURE. **Spec:** `docs/specs/saas-subscription-billing.md` §3.4, §4.3, §5.1.
**Predecessor:** `sessions/sb-6a-handoff.md` — magic-link auth primitive (`lib/auth/subscriber-magic-link.ts`), redeem route, webhook-issued + resend-issued login emails, minimal `/lite/onboarding` landing with subscription summary card, prospect→client promotion, 6 unit tests all green (773/1/0 full suite).

**Model:** `/deep` (Opus). State-machine around `subscription_state` + onboarding progress; motion polish.

## Goal

Polish `/lite/onboarding` from placeholder-text landing into the **earned transition moment** per `feedback_earned_ctas_at_transition_moments`: status-aware variants, Brand DNA CTA hero, house-spring motion, cross-product checkout guard, Playwright E2E.

## Acceptance criteria (G12)

1. **Status-aware variants** — render different hero body based on `deals.subscription_state`:
   - `active` → full dashboard (subscription summary + Brand DNA CTA hero + "Andy will be in touch" line)
   - `past_due` → "Payment didn't land — update card" + Stripe billing-portal link (new `/api/stripe/billing-portal` route, short TTL)
   - `incomplete` → "We're still waiting on Stripe — refresh in a minute" copy, same portal link
2. **Brand DNA CTA hero** — single primary action, large surface, `Link` to `/lite/brand-dna` (or closest existing BDA route). First-visit auto-enter considered but not required for v1 — skippable.
3. **Motion** — `houseSpring` + `AnimatePresence` on card mount + CTA hover/tap per `feedback_motion_is_universal`. No "click to open" jumps.
4. **Cross-product revisit guard** — authenticated client hitting `/get-started/checkout?tier=…&product=…` for a product they **already subscribe to** (match on `deals.saas_product_id` + `status != "lost"` + `subscription_state ∈ {active, past_due, incomplete}`) redirects to `/lite/onboarding`. Different product still allowed.
5. **E2E Playwright spec** `tests/e2e/saas-onboarding-gate.spec.ts` — seed a SaaS deal via fixture, issue magic link, redeem, assert dashboard render + subscription summary values + CTA href. 2–3 tests max.

## Out of scope

- Brand DNA questionnaire itself.
- Actual Stripe billing portal session creation (stub route; test-mode URL OK) unless trivial.
- Usage metering, tier-limit enforcement, downgrade/cancel.
- Full Suite upsell beyond `feedback_primary_action_focus` respect — no cross-sell clutter on this surface.

## Gates

- **G0** read this brief + `sessions/sb-6a-handoff.md` + spec §3.4/§4.3/§5.1 + existing `/lite/onboarding` page + `feedback_earned_ctas_at_transition_moments` + `feedback_primary_action_focus` + `project_brand_dna_flagship_experience` + `feedback_motion_is_universal`.
- **G1** preconditions: `loadSubscriberSummary` already exists from SB-6a; extend shape if needed. BDA route location — grep for it before hard-coding. Stripe billing portal — `stripe.billingPortal.sessions.create` needs customer id (we have `deals.stripe_customer_id`).
- **G2** cite `docs/specs/saas-subscription-billing.md §3.4, §4.3, §5.1` in commit.
- **G3** file whitelist (EDIT unless marked):
  - `app/lite/onboarding/page.tsx`
  - `app/lite/onboarding/clients/onboarding-dashboard-client.tsx` (NEW)
  - `app/api/stripe/billing-portal/route.ts` (NEW)
  - `app/get-started/checkout/page.tsx` (cross-product guard)
  - `lib/saas-products/subscriber-summary.ts` (extend if needed)
  - `tests/e2e/saas-onboarding-gate.spec.ts` (NEW)
  - `scripts/seed-sb6b-e2e.ts` (NEW) — fixture seeder
- **G4** no hard-coded literals — TTLs / thresholds via `settings.get()`.
- **G5** no new npm deps.
- **G10.5** external-reviewer self-assessment required — public-adjacent authenticated surface, Brand DNA CTA is a flagship touchpoint per `project_brand_dna_flagship_experience`. Check: motion on every state change, no nav clutter, dry-voice, individual-feel per `feedback_individual_feel`, no "Lite" branding per `feedback_no_lite_on_client_facing`.
- **G11.b** pre-compile `sessions/sb-7-brief.md` (next SB wave per BUILD_PLAN) at close.
- **G12** `npm test` green + `npx tsc --noEmit` clean + Playwright suite green + manual browser walk: pay with test card → get email → click → land on dashboard → click Brand DNA → (lands on BDA or route-404 logged as PATCHES_OWED).

## Reconcile notes

- SB-6a silently chose `subscriber_login_initial` vs `subscriber_login` for `issued_for` column values; keep both, don't collapse.
- `/lite/onboarding` currently dual-purpose (A8 admin Brand DNA placeholder + SB-6a subscriber dashboard, role-branched). Keep the role branch; don't break the admin path.
- Email shell reused `lib/invoicing/email-html.ts#paragraphsToInvoiceHtml` — same for any future SB-6b emails.
