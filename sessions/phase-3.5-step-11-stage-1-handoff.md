# Phase 3.5 Step 11 — Stage 1 handoff

**Date:** 2026-04-13
**Phase:** 3.5 — Spec Review (exit gate), Step 11 (end-to-end flow walkthrough)
**Stage:** 1 of 4 — Entry → Booking (prospect hits `/trial-shoot` through to shoot slot confirmed)

## Scope of Stage 1

Walked the Intro Funnel entry arc: landing page → Section 1 contact submit → Auth.js session → portal (`contact-only` state) → questionnaire sections 2–4 (via `setup-wizards` primitive) → Stripe Payment Element inline → native calendar → slot confirmed (`freshly_booked`).

Four friction flags surfaced + resolved.

## Flags resolved

### F1.a — Portal session durability to a paid surface

**Problem.** Section 1 submit mints an Auth.js session + magic link. A prospect who loses both (different device, expired cookies, spam-filtered magic link) cannot re-enter a portal they've paid real money for.

**Resolution: Option A — session cookie primary + "send me a fresh link" form on any expired portal URL + magic link embedded in every journey-beat email.**

Patches:
- `docs/specs/intro-funnel.md` — portal-guard recovery flow (owed, gated to inline-at-walkthrough-closure; not yet written into spec prose).
- `docs/specs/intro-funnel.md` §11/§12/§13/§15/§17 — every confirmation email carries a fresh magic link (owed).
- `FOUNDATIONS.md` §11 — `portal-guard` as a cross-cutting shared primitive (owed, Phase 4 foundation).
- `docs/specs/client-management.md` §10 — references `portal-guard` (owed).

All logged in `PATCHES_OWED.md` under "Phase 3.5 Step 11 walkthrough — friction resolutions".

### F1.c — Unified Stripe Customer

**Problem.** Intro Funnel uses Payment Element (dynamic PaymentIntent); Quote Builder/Branded Invoicing/SaaS Billing use Checkout + Subscriptions. No lock on when/how a single `stripe.Customer` is created and reused. Also: Andy used "customer" to mean "retainer client" (business sense), colliding with Stripe's technical `Customer` object.

**Resolution: Option B — lazy creation via `ensureStripeCustomer(contactId)` helper + canonical `contacts.stripe_customer_id` column + explicit terminology separation.**

APPLIED INLINE:
- `FOUNDATIONS.md` §11.7 — new primitive documented (lazy-creation + no-direct-import discipline + business-lifecycle separation note).
- `docs/specs/sales-pipeline.md` §4.1 — `contacts.stripe_customer_id: text unique nullable` added.
- `docs/specs/sales-pipeline.md` §10.4 — `createDealFromLead()` signature expanded with explicit contact dedupe rule (email → phone fallback, non-destructive merge, Company reuse, stage from source).
- `docs/specs/intro-funnel.md` §3 step 2 — dedupe call-out + business-lifecycle lock (Lead/Prospect through trial shoot; only retainer promotes to Client).
- `docs/specs/intro-funnel.md` §11.2 — `ensureStripeCustomer()` call added before PaymentIntent creation; `customer` field attached to PaymentIntent.

LOGGED (gated to future build sessions):
- Quote Builder, Branded Invoicing, SaaS Billing — all must call `ensureStripeCustomer()` before any Stripe create.
- Foundation-session ESLint rule blocking direct `stripe.customers.create` imports.
- Phase 3.5 step 8 glossary lock: `stripe.Customer` ≠ **Client** ≠ "customer" (standalone banned).

### F1.b — Shape mutability + canonical home

**Problem.** `shape` lives on `intro_funnel_submissions.shape` AND `brand_dna_profiles.shape` with no reconciliation. No canonical "shape of company" anywhere. Shape drives questionnaire variants, Brand DNA routing, Six-Week Plan personalisation, retainer-fit recommendation.

**Resolution: Option B — canonical `companies.shape` + Andy-editable on company profile + lazy downstream staleness cascade.**

APPLIED INLINE:
- `docs/specs/sales-pipeline.md` §4.1 — `companies.shape` enum column added (nullable).
- `docs/specs/sales-pipeline.md` §4.1A — **NEW SECTION** documenting shape editing surface + staleness cascade behaviour.
- `docs/specs/sales-pipeline.md` activity_log.kind enum — 2 new values: `company_shape_updated`, `shape_mismatch_flagged`.
- `docs/specs/intro-funnel.md` §3 step 2 — canonical shape write rule (update `companies.shape` if null; log `shape_mismatch_flagged` on disagreement; never silently overwrite).
- `docs/specs/intro-funnel.md` §4.1 — `intro_funnel_submissions.shape` reframed as historical snapshot (comment added).
- `docs/specs/brand-dna-assessment.md` §8.1 — `shape` reframed as historical snapshot + **new column** `needs_regeneration` (boolean, default false, set true on `company_shape_updated` for current profile).

LOGGED (gated to future build sessions):
- Six-Week Plan Generator — read from `companies.shape`; add `needs_regeneration` column on the plan itself; staleness hook on `company_shape_updated`.
- Client Context Engine — `active_strategy` gains `company_shape_updated` as a staleness trigger.
- Daily Cockpit — quiet surface for `shape_mismatch_flagged`.
- Onboarding + Segmentation — read from `companies.shape`.
- Intro Funnel §13.4 retainer-fit — read from `companies.shape`; `intro_funnel_retainer_fit` gains `needs_regeneration` flag.

### F1.d — Setup Wizards as blocking dependency (sequencing note, no product decision)

Intro Funnel's questionnaire renders through the `WizardDefinition` primitive from `setup-wizards.md` §5.3. Phase 4 Build Plan must sequence Setup Wizards foundation before Intro Funnel. Logged in `PATCHES_OWED.md` as a Phase 4 Build Plan note.

## Side effects of Andy's lead-lifecycle lock

Andy surfaced a business-lifecycle clarification during F1.c that became its own set of locks:

1. Lead/Prospect is created on trial shoot application (if not already existing from prior outreach).
2. A contact/company remains a Lead/Prospect through the trial shoot — trial shoot completion is a note on profile, not a promotion.
3. Only a signed retainer promotes a contact to **Client** (business sense).

Codified in `createDealFromLead()` dedupe rule + Intro Funnel §3 step 2 + FOUNDATIONS §11.7 terminology note.

## Files changed

- `FOUNDATIONS.md` — §11.7 new primitive + terminology lock note.
- `docs/specs/sales-pipeline.md` — `companies.shape` + `contacts.stripe_customer_id` + `createDealFromLead()` dedupe + §4.1A staleness cascade + 2 activity_log.kind values.
- `docs/specs/intro-funnel.md` — §3 step 2 dedupe + shape write rules + lifecycle note; §4.1 snapshot comment; §11.2 ensureStripeCustomer call.
- `docs/specs/brand-dna-assessment.md` — §8.1 `shape` snapshot note + `needs_regeneration` column.
- `PATCHES_OWED.md` — Phase 3.5 Step 11 subsection added with all resolutions (applied + owed).
- `SESSION_TRACKER.md` — Next Action updated to Stage 2.

## What the next session should know

1. **Stage 2 starts with Trial Shoot → Deliverables → Reflection.** Anticipated friction:
   - **Six-Week Plan generation timing** — Intro Funnel §3 journey narrates discovery → Section 1 → portal → questionnaire → pay → book → shoot → deliverables → reflection → synthesis → retainer-fit, but never explicitly narrates **where the Six-Week Plan gets generated and delivered** despite P1 patch (trial shoot facts) naming it as a real deliverable. This is likely the biggest gap of Step 11.
   - **Brand DNA context stubbing for synthesis** — Intro Funnel §13.3 says synthesis reads Brand DNA "stubbed before Brand DNA ships". If Intro Funnel Phase 5 ships before Brand DNA, the single most load-bearing Claude generation ships without its full context. Sequencing implication for BUILD_PLAN.md.
   - **Pixieset API capability risk** — §15.3 defers capability confirmation to Phase 5. If API insufficient, the Tier-2 deliverables reveal collapses. Product-level risk.
   - **Safety-valve-to-retainer-fit interaction** — if prospect triggers reflection Q1 safety valve, does the retainer-fit recommendation still fire? Spec ambiguous.
   - **Reflection delay setting** — `intro_funnel_config.reflection_delay_hours_after_deliverables` (default 24h). Check if this is in `docs/settings-registry.md` or still a spec-inline literal.

2. **Still not applied inline but logged: portal-guard primitive + magic-link-in-every-email.** Stage 2 walkthrough should either apply these inline during closure, or carry them forward to Stage 4 closure.

3. **Resolving all 4 stages feeds Batch C.** Batch C step 8 (glossary pass) must pick up the F1.c terminology lock (`stripe.Customer` vs **Client** vs banned "customer"). Batch C step 9 (LLM job inventory) will benefit from knowing which shape-stale-regeneration jobs exist (per F1.b cascade — Brand DNA regen, active_strategy regen, retainer-fit regen).

4. **Context load.** Stage 1 read: `CLAUDE.md`, `START_HERE.md`, `SESSION_TRACKER.md`, Intro Funnel §0-4, §13, §15, §16, §11; Sales Pipeline §4, §9, §10; Brand DNA §8; Six-Week Plan + Onboarding + Quote Builder section headers; FOUNDATIONS §11-§12; full `PATCHES_OWED.md`. Stage 2 should start by reading Intro Funnel §13 in full (reflection arc + synthesis + retainer-fit) + Six-Week Plan Generator §2 end-to-end flow + §8 retainer migration + §12 cross-spec contracts + Brand DNA §3 journey + §7 downstream consumption + §11 SuperBad perpetual profile.
