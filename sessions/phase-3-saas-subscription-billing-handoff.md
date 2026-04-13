# Phase 3 — SaaS Subscription Billing — Handoff Note

**Date:** 2026-04-12
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/saas-subscription-billing.md`
**Status:** Locked, 29 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for SaaS Subscription Billing — the generic infrastructure for SuperBad's self-serve subscription products. 29 questions asked, all locked. This is the billing platform that all future SaaS products (outreach/enrichment, Studio, ads wizard, etc.) plug into.

Multiple mid-brainstorm redirects from Andy that shaped the spec's character:

1. **Q5 — Pricing model.** I proposed conventional SaaS discount framing (strikethroughs, "save 17%", "2 months free"). Andy pushed back: "This feels like trickster pricing that we're trying to avoid as a brand." Led to the identity-commitment model: same price monthly and annual, monthly pays a setup fee, annual waives it. Framing is about commitment, not discounts.

2. **Q12 — Demo gating.** I proposed gating the demo result behind an email capture. Andy's instinct: fully open, no gate, and explicitly call out that this is where businesses normally gatekeep. Led to the anti-convention brand moment on the demo page.

3. **Q15–Q16 — Cancel flow.** Andy diverged from retainer cancel: AI chatbot instead of Andy's email for contact, pay-remainder retains access until anniversary (not immediate cutoff), and added a motivational reality check about entrepreneurship as the cancel page header.

4. **Q23 — Trial model.** I proposed four trial options. Andy redirected: same principle as trial shoot — give them dashboard access, take payment when they want anything to function. Then pushed further for cold outreach: the outreach email should BE the product demo (meta-demonstration), and the dashboard should arrive pre-populated with their enrichment data.

5. **Q25 — Multi-subscription.** I recommended one subscription per customer (Full Suite for multi-product). Andy redirected: allow multiple independent subscriptions, no bundle discount. Should feel like building a custom package, with Full Suite as the obvious value play.

6. **Q26 — Account management.** I recommended hybrid (native display, Stripe for card writes). Andy: "We have Claude Code. Build time is virtually irrelevant." Locked fully native.

7. **Q19 — Product duplication.** I recommended both duplicate and archive. Andy killed duplicate: "that's how small details get missed." Wizard is the only creation path.

---

## 2. Key decisions summary

### Pricing philosophy
- **Identity-based, not discount-based.** Same per-month price everywhere. Monthly pays a setup fee. Annual waives it. Three commitment levels: getting started / committed / all in.
- **Setup fee per new monthly subscription** naturally closes the cancel-long-resubscribe-short loophole. No special anti-gaming logic.
- **Popcorn at two levels:** within products (small/medium/large tiers) and across products (Full Suite priced to make individual stacking obviously worse).

### Product infrastructure
- **Lite DB is source of truth.** Andy manages everything in Lite admin. Stripe auto-synced on publish.
- **Multiple named usage dimensions per product** (1–3 practical guardrail) + feature flags.
- **Hard cap with one-click upgrade** when limits hit. Persistent usage sticky bar with evolving voice treatment.
- **Setup wizard** for new product creation. Archive only, no duplicate.

### Entry paths
- **Warm traffic:** interactive demo (fully open, no gate) → pricing page → account → locked dashboard → payment → Brand DNA → product unlocked.
- **Cold outreach:** meta-demonstration email → pre-populated dashboard from enrichment data → locked dashboard → payment → Brand DNA (pre-seeded, shorter questionnaire) → product unlocked.
- **No traditional free trial.** The demo + locked dashboard IS the trial.

### Cancel flow (SaaS-specific divergences from retainer)
- AI chatbot contact, not Andy's email. Max escalation only.
- Motivational reality check header (entrepreneurship is hard, the frustration is the job).
- Pay remainder retains access until commitment anniversary. 50% buyout cancels immediately.
- Product switch offered as soft first step before cancel branches.

### Subscriber experience
- Same chat-first portal as retainer. Product-specific menu items via `productConfig` interface.
- Fully native account management (card, invoices, payment methods). No Stripe Billing Portal exposure.
- Immediate lockout on payment failure. Data preserved. 3 failures in 7–10 days → data-loss warning escalation.
- Multiple independent subscriptions per customer allowed.

---

## 3. No new memories

No new principles surfaced. The spec applied existing memories extensively:
- `project_saas_popcorn_pricing` — three tiers per product
- `feedback_felt_experience_wins` — identity framing over discount framing, GST-inclusive display
- `feedback_primary_action_focus` — minimal checkout, no re-selling
- `feedback_setup_is_hand_held` — product creation wizard
- `feedback_no_lite_on_client_facing` — subscriber-facing surfaces say "SuperBad"
- `feedback_pre_populated_trial_experience` — cold outreach pre-population
- `project_brand_dna_as_perpetual_context` — Brand DNA hard gate
- `feedback_individual_feel` — each subscriber's portal feels like their own

---

## 4. Sprinkle bank updates

- **"Subscription cancelled" email** (§3) — claimed for dying-fall grace moment
- **Browser tab titles** — added `saas-subscription-billing` to existing claim list for `/lite/products` admin surface

---

## 5. Cross-spec flags (consolidated)

### 5.1 Sales Pipeline (LOCKED)
- `deals` gains 3 nullable columns: `saas_product_id`, `saas_tier_id`, `billing_cadence`
- Multiple deals per contact (one per product subscription)
- Cold SaaS signups create deals at Won directly

### 5.2 Lead Generation (LOCKED)
- SaaS outreach meta-demonstration email template
- Enrichment data accessible for dashboard pre-population

### 5.3 Intro Funnel (LOCKED)
- `recommendation_type: 'saas'` routes to SaaS signup

### 5.4 Onboarding + Segmentation (LOCKED)
- SaaS onboarding trigger from payment
- Brand DNA pre-seeding for cold prospects (new mechanism)

### 5.5 Brand DNA Assessment (LOCKED)
- Must define enrichment → Brand DNA pre-seeding mechanism
- Pre-seeded answers clearly marked, overridable

### 5.6 Client Management (LOCKED)
- Product-specific portal menu items
- Native account management pages (new portal sections)
- AI chatbot handles SaaS cancel flow contact
- SaaS cancel branches on existing `/lite/portal/subscription`

### 5.7 Client Context Engine (LOCKED)
- Usage patterns and payment failures as signals

### 5.8 Daily Cockpit (#12)
- SaaS headlines: signups, churn, payment failures, MRR, limit hits

### 5.9 Finance Dashboard (#17)
- Reads SaaS revenue: MRR by product, subscriber counts, churn, ARPU

### 5.10 Quote Builder (LOCKED)
- Shared cancel flow, shared `scheduled_tasks` worker, shared `subscription_state` enum

---

## 6. New data

### 6.1 New tables: 5
- `saas_products` — product definitions
- `saas_tiers` — tier definitions per product
- `saas_usage_dimensions` — named usage dimensions per product
- `saas_tier_limits` — caps per dimension per tier
- `usage_records` — central usage tracking

### 6.2 New columns on `deals`
- `saas_product_id` (nullable FK)
- `saas_tier_id` (nullable FK)
- `billing_cadence` (nullable enum)

### 6.3 `activity_log.kind` gains 11 values
See spec §11.3.

### 6.4 `scheduled_tasks.task_type` gains 3 values
`saas_data_loss_warning`, `saas_annual_renewal_reminder`, `saas_card_expiry_warning`

---

## 7. New build-time disciplines
38–42. See spec §15. Key ones: every capped action calls `checkUsageLimit()`/`recordUsage()`, Stripe Price changes always create new objects, no Billing Portal exposure, setup fee logic centralised, product demos are product-specific.

---

## 8. Content mini-session scope

**Large.** 12 voice-treated surfaces + 9 email templates + admin empty states + browser tab titles. Dedicated creative session with `superbad-brand-voice` + `superbad-visual-identity` + `superbad-business-context` loaded. See spec §14 for full list.

---

## 9. Phase 5 sizing

5 sessions:
- **A:** Data model + Stripe integration (large)
- **B:** Product admin — wizard, index, detail, archive (medium-large, depends on A)
- **C:** Public signup — pricing page, checkout, demo frame (medium, depends on A)
- **D:** Subscriber experience — usage, upgrades, account management (large, depends on A+C)
- **E:** Cancel flow + payment failure (medium, depends on D)

B and C can run in parallel after A. D after A+C. E after D.

---

## 10. What the next session should know

### 10.1 Next recommended spec: Content Engine (#10)

Semi-autonomous SEO content engine. Best sequenced now — reuses Resend patterns, Claude chat primitive, SerpAPI integration plumbing from Lead Gen. Blog generation reads Brand DNA as context. This is also likely the first SaaS product to ship, so it can serve as the reference implementation for the billing infrastructure defined in this spec.

### 10.2 Things easily missed

- **The setup fee IS the loophole closure.** No complex anti-gaming logic anywhere. If someone asks "how do we prevent cancel-long-resubscribe-short," point them at Q7.
- **Multiple subscriptions means multiple deals per contact.** Any code that assumes one deal per contact will break for SaaS multi-subscribers.
- **Brand DNA pre-seeding is a new mechanism.** This spec flags it, Brand DNA spec must define it. Cold outreach prospects should not face the full 30-minute questionnaire when the system already knows half the answers.
- **The cancel flow motivational message is a brand-defining moment.** Content mini-session must nail it — entrepreneurship reality check, not retention begging.
- **No Stripe Billing Portal for subscribers.** Account management is fully native. Card updates use SetupIntent + Payment Element inline in the portal.
- **Demo results persist to account.** When a warm-traffic user runs the demo then signs up, their demo search result should be their first dashboard data. Product-specific mechanism, but the billing spec establishes the expectation.

---

## 11. Backlog state

**Phase 3 spec backlog: 17 total, 12 locked, 5 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, Brand DNA Assessment, Onboarding + Segmentation, Client Context Engine, Client Management, **SaaS Subscription Billing** (this session).

Next recommended: Content Engine (#10).

---

**End of handoff.**
