# Intro Funnel — Feature Spec

**Phase 3 output. Locked 2026-04-12.**

> **Prompt files:** `lib/ai/prompts/intro-funnel.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

The Intro Funnel is SuperBad's customer-facing acquisition surface for the paid **$297 trial shoot** offer (editable from Settings). It covers the entire journey from first landing-page visit through the trial shoot itself and on to the retainer/SaaS decision. It drops cards directly at the Pipeline's **Trial Shoot** stage via `createDealFromLead()` (skipping Lead / Contacted / Conversation), and is one of two feeders into that stage alongside manual entry.

The Intro Funnel composes, rather than re-specifies, the five Foundations §11 cross-cutting primitives:

- §11.1 universal audit log (every funnel state change, payment, booking, abandon trigger, and reflection event is an `activity_log` row)
- §11.2 safe-to-send gate (every outbound email and SMS flows through it)
- §11.3 timezone-correct timestamps (all times stored UTC, rendered via `formatTimestamp()` in the prospect's tz)
- §11.4 outreach quiet window (abandon-cadence emails and SMS obey it; SMS uses a stricter 8am–9pm local window)
- §11.5 brand-voice drift check (synthesis, abandonment emails, apology emails — all customer-facing Claude output — passes through it; the retainer-fit recommendation is internal-only per §13.4 / F2.d but also passes through it as a belt-and-braces voice-consistency check on Andy's surfaces)

Integration with the Sales Pipeline (`docs/specs/sales-pipeline.md`) is via `createDealFromLead(..., source: 'intro_funnel_trial_shoot')` at Stripe payment success (not at contact submission — see §5.2 for why). Before payment, prospects exist as `intro_funnel_submissions` without a Pipeline Deal; that changes in the refinement below.

---

## 0. Retroactive patches (2026-04-13 Phase 3.5)

Four memory-derived patches to a spec locked 2026-04-12:

**P1 — Trial shoot facts (`project_trial_shoot_facts`).** The trial shoot is **60 minutes on-site only** (no studio variant in v1). **A bespoke 6-week marketing plan is included as a deliverable** alongside the photo/video output (see Six-Week Plan Generator spec). **Reschedule is free up to 48h before**; inside 48h the booking is lost with extenuating-circumstances handled case-by-case at Andy's discretion (the cockpit surfaces a case-by-case review card). Q16's "48h refund window, 2 reschedules max" already encodes the cancellation cutoff; this patch just pins the duration + location + deliverable facts the spec originally left ambiguous. Affects §2 journey copy, §17 notifications, §11 payment-flow "what you're getting" block, §12 calendar slot length.

**P2 — Non-converter portal 60-day lifecycle (`project_non_converter_portal_lifecycle`).** Replace every "portal stays dormant indefinitely" with **60 days post-shoot-completion, then archive** for non-converters. At archive: portal goes offline, the 6-week plan PDF is emailed one last time ("keep this"), deliverables gallery link retained while Pixieset hosts it. A scheduled task `portal_archive_non_converter` fires 60 days after `shoots.slot_end_at` for portals where `deals.stage != 'won'`. Settings key: `portal.non_converter_archive_days` (default 60). Converted clients unaffected — they migrate to full retainer-mode portal.

**P3 — Questionnaire extension for plan generation.** The 8-screen reflection questionnaire (§9) must capture enough practical info to feed the Six-Week Plan Generator: marketing infrastructure status, current channels, current budget sense, concrete business goals. Either adds a new "practical section" before the shape-branched reflection banks or folds these prompts into the existing shape-branched banks — decision deferred to Intro Funnel content mini-session. Output persisted to `questionnaire_responses` with a taxonomy tag `practical_signal` for downstream Plan-Generator consumption.

**P4 — Post-shoot portal surface migrates to Client Management portal.** Deliverables reveal (§8), reflection questionnaire (§9), retainer-fit recommendation (§11), and the dormant-state (§10) all render inside the Client Management `/portal/[token]` shell — not an Intro-Funnel-owned surface. Pre-retainer rate limits apply (portal chat Opus-gated via `portal.chat_calls_per_day_pre_retainer`). This spec continues to own the **journey logic** (state machine, scheduled-task emissions, Claude prompts, questionnaire content) but **renders through** Client Management's portal. Unifies "same portal a retainer client would, for 60 days" per memory. See Client Management §"Pre-retainer rendering mode" for the shell contract.

Each patch is applied inline where the spec has a concrete anchor; elsewhere the patches are authoritative and Phase 5 build sessions must honour them.

---

## 1. Purpose and shape

The Intro Funnel is a **branded experience that happens to convert**, not a conversion funnel that happens to be branded. That framing distinguishes it from every generic "SaaS landing page → checkout" pattern and dictates decisions across the whole spec:

- The landing page is editorial, not direct-response.
- The questionnaire is a self-persuasion instrument, not a data-capture form.
- The portal is a dopamine-first premium surface, not a task list.
- The post-shoot reflection is a commitment-and-consistency arc, not a feedback form.
- The deliverables reveal is a Tier-2 motion moment, not a file download.

It is also the first feature to put a real customer on a paid surface inside Lite. This makes it the canary for the Foundations cross-cutting primitives and for Stripe + Resend + Twilio + Pixieset wired end-to-end. Any gap in §11.1–§11.5 becomes visible here first.

Prospects enter via multiple possible paths:

- **Organic landing page visit** (direct, SEO, social)
- **Inbound from marketing site CTA** (`superbadmedia.com.au` homepage link)
- **Click-through from a Lead Gen cold email** (§18.2)
- **Direct link from Andy personally** (sent over email, DM, in-person handoff)

All paths converge at `/trial-shoot`.

### 1.1 Setup wizard shell reference (added 2026-04-13 Phase 3.5)

The 8-screen reflection questionnaire (§9) renders through the `WizardDefinition` primitive owned by [setup-wizards.md](./setup-wizards.md) §5.3. Wizard key: **`intro-funnel-questionnaire`**. Render mode: **dedicated route**. This spec owns the step content, shape-branched question banks, signal-tag taxonomy, and the completion payload (questionnaire persisted + reflection signals + `activity_log`). Shell chrome (progress bar, resume, cancel, celebration, Observatory integration) lives in the primitive. Landing page (§8) and payment flow (§11) remain bespoke surfaces outside the wizard shell.

---

## 2. The 16 locks (quick reference)

| # | Decision | Detail |
|---|---|---|
| Q1 | **Full flow shape** | Landing → questionnaire section 1 (contact) → instant portal access → sections 2–4 (self-persuasion) → "pay now & book" dashboard → Stripe Payment Element → native calendar booking → shoot → deliverables → reflection → retainer-fit synthesis. |
| Q2 | **Portal opens after section 1** | Fast dopamine payoff. Questionnaire sections 2–4 happen inside the portal, not pre-portal. Personalised with prospect's name and business. |
| Q3 | **Enrichment runs async on section 1 submit** | Gives automated follow-ups context + disqualifies poor fits from follow-up drafting. Poor-fit means no auto-follow-up, NOT Pipeline removal. |
| Q4 | **Portal state machine** | 4 pre-payment states + 5 post-payment sub-states. Time-based transitions via hourly cron. |
| Q5 | **Shape-branched questionnaire** | Single branching dimension: solo_founder / founder_led_team / multi_stakeholder_company. 3 variants × 4 sections = 12 question banks. Content authored in follow-up mini-session. |
| Q6 | **Payment = Stripe Payment Element inline** | Dynamic amount Payment Intent (editable in Settings). Cinematic reveal motion (candidate Tier-2 moment #1). |
| Q7 | **Native calendar, not Cal.com** | 5-business-day advance notice + 3-per-week cap, both editable in Settings with positive-framing copy. Opportunistic primitive shared with marketing-site booking widget. |
| Q8 | **Price editable via Settings → Products → Trial Shoot** | Stripe Payment Intent with dynamic amount, NOT Stripe Products + Prices (which are immutable). |
| Q9 | **Retainer-fit recommendation is Claude-generated** | Opus-tier, structured JSON output (recommendation_type + confidence + reasoning + flags). Surfaced in Daily Cockpit for Andy's review. No training data required — rich context + described criteria. |
| Q10 | **Post-shoot reflection is a self-persuasion instrument** | 8 questions, one per screen, premium card UI. Q1 is a safety-valve negative-escape. Q2–Q7 walk experience→value→working-with-Andy→future-casting→commitment. Final screen is Claude synthesis reveal (candidate Tier-2 moment #2). |
| Q11 | **Abandon cadence: 15m SMS → 24h SMS+email → 3d email → demote** | Aggressive. Twilio integration for SMS. "Inactivity" resets on any portal activity. After demotion, Deal → Lost, contact re-enters cold pool with context flag. |
| Q12 | **Cold re-engagement reads funnel history as context** | Single drafting path in Lead Gen. `funnel_history` becomes one more context field for `generateDraft()`. No special "returning prospect" template. |
| Q13 | **Deliverables via Pixieset API + native branded gallery** | Pixieset hosts files (30+ day retention). We fetch via API and render in our gallery component. Gallery URL fallback if API insufficient. Candidate Tier-2 moment #3. |
| Q14 | **Landing page: on-brand editorial, platform-agnostic URL** | `/trial-shoot` route, Lite pre-cutover, marketing site post-cutover. Not a high-conversion funnel page — branded experience with delight + value upfront. |
| Q15 | **Notification policy: loud on money + human touchpoints** | Urgent sound + top cockpit slot: payment, SMS reply, negative feedback, booking cancellation. Surfaced quietly: starts, sections, recommendations, deliverables views, reflection completion. Silent: automation events. |
| Q16 | **Cancel/reschedule: D + SuperBad-side always-refundable** | Customer: 48h refund window, 2 reschedules max, auto-Lost on 3rd attempt. SuperBad: always refundable regardless of timing. |

---

## 3. End-to-end user journey

Narrated once so every subsequent section has the shared mental model.

1. **Discovery.** Prospect hits `/trial-shoot` via any of the entry paths in §1. The landing page is an on-brand editorial experience (§8): understated opener, a delight moment, a value drop, a plain-English "what happens at a trial shoot", curated past work, the quiet commitment section (advance notice + per-week cap framed as care), the price, a final CTA, minimal footer.

2. **Section 1 (contact).** Prospect clicks CTA. Hero collapses, section 1 form slides in where the hero was. Fields: name, business name, email, phone, SMS opt-in (checked by default), plus the shape-classification question(s) that determine which questionnaire variant they get in sections 2–4. On submit:
   - `intro_funnel_submissions` row created.
   - Pipeline Deal created via `createDealFromLead(source: 'intro_funnel_contact_submitted')` at **Trial Shoot** stage with `funnel_state: 'contact_submitted'` (not at the Lead stage — Intro Funnel skips ahead per Pipeline Q12). **Contact dedupe applies per Sales Pipeline §10.4** — if a contact already exists on normalised email or phone (e.g. from prior cold outreach), the existing contact + Company are reused; a new Deal is attached to them. Never duplicate contacts. Business-lifecycle status remains **Lead/Prospect** through the trial shoot — trial shoot completion is a note on the profile (`trial_shoot_status`/`trial_shoot_completed_at`), not a promotion. Only a signed retainer promotes the contact to Client (business sense).
   - **Canonical shape write (F1.b, 2026-04-13 Phase 3.5 Step 11).** Copy the Section 1 shape answer to the Intro Funnel submission snapshot (`intro_funnel_submissions.shape` — historical) AND to the canonical source (`companies.shape`) using this rule: if `companies.shape` is `null`, set it from Section 1. If `companies.shape` is non-null and disagrees with Section 1, leave `companies.shape` alone and write `activity_log.kind = 'shape_mismatch_flagged'` with `{ company_shape, section_1_shape, submission_id }` — quiet cockpit surface for Andy to reconcile. Never silently overwrite a canonical shape. Downstream features (retainer-fit recommendation, Six-Week Plan Generator, synthesis) read from `companies.shape`, falling back to `intro_funnel_submissions.shape` only if the canonical is null.
   - Auth.js session created programmatically for the prospect (magic-link emailed in parallel for future returns).
   - Enrichment job queued async (same pipeline as Lead Gen §4.2 signal set).
   - `activity_log` entry `intro_funnel_started`, cockpit feed entry (quiet surface).
   - Redirect to `/lite/intro/[token]` — the portal.

3. **Portal — contact-only state.** Personalised: *"Welcome Andy — here's what's next."* Shows the 3-section questionnaire remaining (progress indicator), a pre-filled placeholder for the "Pay now & book your shoot" dashboard card (visible but disabled until questionnaire complete), a "what to expect" section. Dopamine moment is the fact that they're in a premium branded surface already, just from submitting their name and email.

4. **Questionnaire sections 2–4.** Shape-branched variant loaded (§9). One question per screen, tappable cards for closed-list options, optional free text on select questions. House-spring transitions between questions, sound registry hooks on progression. Each section completion updates `intro_funnel_submissions.questionnaire_answers_json`, extracts `signal_tags`, writes `activity_log` entry `intro_funnel_section_completed`, persists state so the prospect can leave and return at any point.

5. **Portal — questionnaire-complete state.** Now the "Pay now & book your shoot" card activates. Cinematic reveal motion (Tier-2 candidate #1): card expands, payment surface reveals inline. Payment Element (§11) mounted with the dynamic amount from Settings. Prospect pays.

6. **Portal — paid state.** Calendar opens immediately after payment confirmation (§12). Prospect picks a slot that satisfies the 5-business-day advance notice + 3-per-week cap. Confirmation screen + email + calendar invite (`.ics` attachment). Portal transitions through the 5 post-payment sub-states time-based via hourly cron: `freshly_booked` → `approaching` (48h out) → `morning_of` → `completed_awaiting_deliverables` → `deliverables_ready` (when Andy pastes the Pixieset gallery URL).

7. **The shoot itself.** Happens in meatspace. Andy runs it. Nothing inside Lite until he's back and uploads deliverables.

8. **Deliverables reveal — bundled (F2.a, 2026-04-13 Phase 3.5 Step 11 Stage 2).** Two parallel pre-conditions must both be met before the portal flips to `deliverables_ready`: (i) Andy pastes the Pixieset gallery URL into the Trial Shoot panel on the Deal profile (Pipeline integration); and (ii) Andy approves the Six-Week Plan in the review queue (Six-Week Plan Generator §2.5). Whichever lands second fires the bundled transition (see §15.1 for the gate logic). One announcement email goes out covering both artefacts. Next time the prospect opens the portal, the gallery component (Pixieset, Tier-2 reveal candidate #3) and the Six-Week Plan section (S6WPG §6) are both live. `activity_log` entries: `gallery_attached`, `six_week_plan_approved`, then the bundled `deliverables_ready`. On first views: `deliverables_viewed`, `six_week_plan_viewed`. **Customer-perceived timeframe is signposted upfront** in landing/payment/booking copy (~7 days post-shoot) so the bundled wait reads as expected, not as a delay — see §24 content mini-session.

9. **Reflection questionnaire.** A day or so after deliverables go live (configurable delay, starting at 24h), the portal surfaces the post-shoot reflection (§13). 8 questions, linear arc with safety valve at Q1. Prospect completes.

10. **Claude synthesis reveal.** Final screen of the reflection is the synthesis — a Claude Opus generation that mirrors the prospect's own reasoning back to them in SuperBad voice. Candidate Tier-2 motion #2. CTA pair: *"Yes — let's talk about what's next"* / *"Let me think about it"*.

11. **Retainer-fit recommendation.** Behind the scenes, a second Claude Opus call synthesises the retainer-fit recommendation (§13.4) reading the full context bundle: onboarding questionnaire + enrichment profile + shoot plan + reflection + SuperBad's perpetual Brand DNA context. Structured JSON output lands in `intro_funnel_retainer_fit`. Cockpit surface: quiet feed entry `retainer_fit_recommendation_ready` for Andy's review in his own time.

12. **Decision path.**
    - If prospect chose "let's talk" → Andy gets an urgent-ish cockpit card, books a follow-up slot via the native calendar, conversation happens, Deal progresses through Quoted → Negotiating → Won (converting to retainer or SaaS) or Lost.
    - If prospect chose "let me think" → portal transitions to dormant state, no active nudging, a subtle "still here when you're ready" framing. Andy can surface a "reopen conversation" action from the cockpit.
    - If prospect triggered the Q1 safety valve during reflection → Deal sub-status `post_trial_negative_feedback`, urgent cockpit card, Andy follows up personally.

13. **Fork at Won.** When the Deal transitions to Won (via Pipeline), the prospect's Intro Funnel portal data (deliverables reference, questionnaire answers, Brand DNA signals) migrates to the real client portal (Client Management spec, backlog #8) via a background job. Intro Funnel portal is archived with status `archived_migrated`. Magic link still works but now redirects to the new client portal.

14. **Non-conversion + dormant (amended 2026-04-13 Phase 3.5 per P2).** If they never convert, the portal stays live in dormant state for **60 days post-shoot-completion**, then archives. At archive: portal route returns a minimal "we're offline, your plan stays yours" page, a final email sends with the 6-week plan PDF re-attached, deliverables gallery link retained while Pixieset hosts it. Andy can still reopen conversation via a cockpit action that restores the portal. Scheduled task: `portal_archive_non_converter` (Phase 3.5 patch). Settings key: `portal.non_converter_archive_days` (default 60).

---

## 4. Data model

Drizzle schemas. Additions to existing tables are flagged as cross-spec updates in §19.

### 4.1 New tables

```ts
// intro_funnel_submissions — one row per prospect who submits section 1
export const introFunnelSubmissions = sqliteTable('intro_funnel_submissions', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  token: text('token').notNull().unique(), // public URL slug for /lite/intro/[token]
  deal_id: text('deal_id').notNull().references(() => deals.id),
  contact_id: text('contact_id').notNull().references(() => contacts.id),

  // Section 1 snapshot (source of truth lives on contact, but pinned here at submission time)
  submitted_name: text('submitted_name').notNull(),
  submitted_business_name: text('submitted_business_name').notNull(),
  submitted_email: text('submitted_email').notNull(),
  submitted_phone: text('submitted_phone').notNull(),
  sms_opt_in: integer('sms_opt_in', { mode: 'boolean' }).notNull().default(true),
  sms_consent_at: integer('sms_consent_at', { mode: 'timestamp' }),

  // Shape classification — drives which questionnaire variant loads in sections 2-4.
  // HISTORICAL SNAPSHOT ONLY (added 2026-04-13 Phase 3.5 Step 11 F1.b) — captures the shape answered
  // at Section 1 submit. Canonical source is `companies.shape` (Sales Pipeline §4.1). Section 1 submit
  // writes both: canonical companies.shape (if null) and this snapshot. Mismatches log
  // `activity_log.kind = 'shape_mismatch_flagged'`. Downstream reads go to companies.shape first.
  shape: text('shape', {
    enum: ['solo_founder', 'founder_led_team', 'multi_stakeholder_company'],
  }).notNull(),

  // Funnel state machine
  funnel_state: text('funnel_state', {
    enum: [
      'contact_submitted',
      'questionnaire_in_progress',
      'questionnaire_complete',
      'paid',
      'shoot_booked',
      'shoot_approaching',
      'shoot_morning_of',
      'shoot_completed_awaiting_deliverables',
      'deliverables_ready',
      'reflection_complete',
      'portal_dormant',
      'portal_archived_migrated',
    ],
  }).notNull().default('contact_submitted'),

  // Questionnaire state — serialised answers and extracted tags
  questionnaire_answers_json: text('questionnaire_answers_json', { mode: 'json' }),
  questionnaire_sections_completed: integer('questionnaire_sections_completed').notNull().default(0),
  signal_tags_json: text('signal_tags_json', { mode: 'json' }),

  // Abandon sequence state
  abandon_sequence_state: text('abandon_sequence_state', {
    enum: ['pending', 't_15m_sent', 't_24h_sent', 't_3d_sent', 'demoted', 'not_applicable'],
  }).notNull().default('pending'),
  last_activity_at: integer('last_activity_at', { mode: 'timestamp' }).notNull(),

  // Bundled-deliverables-release gate (F2.a, 2026-04-13 Phase 3.5 Step 11 Stage 2).
  // `deliverables_ready` only fires when both timestamps are non-null. Whichever lands
  // second triggers the unified state transition + bundled announcement email.
  // `deliverables_ready_at` is set by the gate handler to the LATER of the two.
  gallery_ready_at: integer('gallery_ready_at', { mode: 'timestamp' }),
  plan_ready_at: integer('plan_ready_at', { mode: 'timestamp' }),
  deliverables_ready_at: integer('deliverables_ready_at', { mode: 'timestamp' }),

  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// intro_funnel_payments — authoritative payment record
export const introFunnelPayments = sqliteTable('intro_funnel_payments', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  submission_id: text('submission_id').notNull().references(() => introFunnelSubmissions.id),
  deal_id: text('deal_id').notNull().references(() => deals.id),

  stripe_payment_intent_id: text('stripe_payment_intent_id').notNull().unique(),
  stripe_customer_id: text('stripe_customer_id'),

  amount_cents: integer('amount_cents').notNull(), // snapshot at purchase time
  currency: text('currency').notNull().default('aud'),

  status: text('status', {
    enum: ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'],
  }).notNull().default('pending'),

  refund_amount_cents: integer('refund_amount_cents'),
  refund_reason_code: text('refund_reason_code'),
  refunded_at: integer('refunded_at', { mode: 'timestamp' }),

  paid_at: integer('paid_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// intro_funnel_bookings — calendar booking record for the trial shoot itself
export const introFunnelBookings = sqliteTable('intro_funnel_bookings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  submission_id: text('submission_id').notNull().references(() => introFunnelSubmissions.id),
  deal_id: text('deal_id').notNull().references(() => deals.id),
  payment_id: text('payment_id').notNull().references(() => introFunnelPayments.id),

  slot_start_at: integer('slot_start_at', { mode: 'timestamp' }).notNull(),
  slot_end_at: integer('slot_end_at', { mode: 'timestamp' }).notNull(),

  status: text('status', {
    enum: ['booked', 'rescheduled', 'cancelled', 'completed', 'no_show'],
  }).notNull().default('booked'),

  reschedule_count: integer('reschedule_count').notNull().default(0),

  cancelled_at: integer('cancelled_at', { mode: 'timestamp' }),
  cancelled_by: text('cancelled_by', { enum: ['customer', 'superbad'] }),
  cancelled_reason_code: text('cancelled_reason_code'),

  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// intro_funnel_reflections — post-shoot self-persuasion questionnaire
export const introFunnelReflections = sqliteTable('intro_funnel_reflections', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  submission_id: text('submission_id').notNull().references(() => introFunnelSubmissions.id),
  deal_id: text('deal_id').notNull().references(() => deals.id),

  answers_json: text('answers_json', { mode: 'json' }).notNull(),
  safety_valve_triggered: integer('safety_valve_triggered', { mode: 'boolean' }).notNull().default(false),

  // Claude synthesis — the reveal screen content
  synthesis_text: text('synthesis_text'),
  synthesis_model: text('synthesis_model'), // e.g. 'claude-opus-4-6'
  synthesis_prompt_version: text('synthesis_prompt_version'),
  synthesis_drift_check_passed: integer('synthesis_drift_check_passed', { mode: 'boolean' }),
  synthesis_generated_at: integer('synthesis_generated_at', { mode: 'timestamp' }),

  decision_cta_choice: text('decision_cta_choice', {
    enum: ['yes_talk', 'think_about_it'],
  }),
  decision_made_at: integer('decision_made_at', { mode: 'timestamp' }),

  completed_at: integer('completed_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// intro_funnel_retainer_fit — Claude-generated recommendation, surfaced in cockpit
export const introFunnelRetainerFit = sqliteTable('intro_funnel_retainer_fit', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  submission_id: text('submission_id').notNull().references(() => introFunnelSubmissions.id),
  deal_id: text('deal_id').notNull().references(() => deals.id),

  recommendation_type: text('recommendation_type', {
    enum: ['retainer', 'saas', 'neither', 'either_strong'],
  }).notNull(),
  confidence: text('confidence', { enum: ['high', 'medium', 'low'] }).notNull(),
  reasoning_text: text('reasoning_text').notNull(),
  flags_json: text('flags_json', { mode: 'json' }), // structured concerns/signals for Andy

  model: text('model').notNull(),
  prompt_version: text('prompt_version').notNull(),
  drift_check_passed: integer('drift_check_passed', { mode: 'boolean' }).notNull(),

  generated_at: integer('generated_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// calendar_bookings — generic primitive shared with future booking widgets
export const calendarBookings = sqliteTable('calendar_bookings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  booking_type: text('booking_type', {
    enum: ['intro_funnel_shoot', 'followup_conversation', 'marketing_site_booking'],
  }).notNull(),

  start_at: integer('start_at', { mode: 'timestamp' }).notNull(),
  end_at: integer('end_at', { mode: 'timestamp' }).notNull(),

  subject_ref_table: text('subject_ref_table').notNull(), // e.g. 'intro_funnel_bookings'
  subject_ref_id: text('subject_ref_id').notNull(),

  status: text('status', { enum: ['active', 'cancelled'] }).notNull().default('active'),
  metadata_json: text('metadata_json', { mode: 'json' }),

  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// calendar_config — single-row config for the native calendar engine
export const calendarConfig = sqliteTable('calendar_config', {
  id: text('id').primaryKey().$defaultFn(() => 'singleton'),

  timezone: text('timezone').notNull().default('Australia/Melbourne'),
  business_hours_json: text('business_hours_json', { mode: 'json' }).notNull(), // per-weekday ranges
  blackout_dates_json: text('blackout_dates_json', { mode: 'json' }), // array of dates

  // Intro Funnel specific — editable via Settings
  intro_funnel_advance_notice_business_days: integer('intro_funnel_advance_notice_business_days').notNull().default(5),
  intro_funnel_per_week_cap: integer('intro_funnel_per_week_cap').notNull().default(3),

  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// dnc_phones — phone-level do-not-contact list, parallel to dnc_emails (Lead Gen §4)
export const dncPhones = sqliteTable('dnc_phones', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  phone: text('phone').notNull().unique(), // E.164 normalised
  reason: text('reason', {
    enum: ['manual_block', 'stop_reply', 'complaint', 'legal_request'],
  }).notNull(),
  source_note: text('source_note'),
  added_at: integer('added_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// twilio_sms_log — delivery and reply tracking for Twilio messages
export const twilioSmsLog = sqliteTable('twilio_sms_log', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  submission_id: text('submission_id').references(() => introFunnelSubmissions.id),
  deal_id: text('deal_id').references(() => deals.id),

  direction: text('direction', { enum: ['outbound', 'inbound'] }).notNull(),
  twilio_message_sid: text('twilio_message_sid').notNull().unique(),
  from_number: text('from_number').notNull(),
  to_number: text('to_number').notNull(),
  body: text('body').notNull(),
  status: text('status', {
    enum: ['queued', 'sent', 'delivered', 'failed', 'undelivered', 'received'],
  }).notNull(),

  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

```ts
// intro_funnel_config — single-row feature config, editable from Settings → Products → Trial Shoot
export const introFunnelConfig = sqliteTable('intro_funnel_config', {
  id: text('id').primaryKey().$defaultFn(() => 'singleton'),

  // Price control — editable
  price_cents: integer('price_cents').notNull().default(29700),
  currency: text('currency').notNull().default('aud'),

  // Copy blocks — editable without code deploy for certain customer-facing strings
  landing_hero_copy: text('landing_hero_copy'),
  landing_commitment_copy: text('landing_commitment_copy'),
  confirmation_email_subject: text('confirmation_email_subject'),
  confirmation_email_body: text('confirmation_email_body'),

  // Reflection timing — DEPRECATED column (F2.e, 2026-04-13 Phase 3.5 Step 11 Stage 2).
  // Migrated to `settings.get('intro_funnel.reflection_delay_hours_after_deliverables')` per Step 7a discipline.
  // Phase 5 Intro Funnel build session: drop this column from the migration; consume settings only.
  reflection_delay_hours_after_deliverables: integer('reflection_delay_hours_after_deliverables').notNull().default(24),

  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

### 4.2 Additions to existing tables

Non-breaking. See §19 cross-spec flags for coordination with Pipeline spec.

**`deals` table — new nullable columns:**

```ts
funnel_submission_id: text('funnel_submission_id').references(() => introFunnelSubmissions.id),
funnel_state: text('funnel_state'), // mirrors intro_funnel_submissions.funnel_state for quick Pipeline queries
post_trial_signal: text('post_trial_signal'), // the recommendation_type from retainer_fit
pixieset_gallery_id: text('pixieset_gallery_id'),
pixieset_gallery_url: text('pixieset_gallery_url'),
reschedule_count: integer('reschedule_count').notNull().default(0),
```

**`contacts` table — new nullable columns:**

```ts
phone: text('phone'), // if not already present
sms_opt_in: integer('sms_opt_in', { mode: 'boolean' }).notNull().default(false),
sms_consent_at: integer('sms_consent_at', { mode: 'timestamp' }),
```

**`activity_log.kind` enum — new values (non-breaking):**

```
intro_funnel_started
intro_funnel_section_completed
intro_funnel_abandoned
intro_funnel_paid
intro_funnel_sms_sent
intro_funnel_sms_delivered
intro_funnel_sms_replied
intro_funnel_cancelled_refunded
intro_funnel_cancelled_no_refund
intro_funnel_no_show
shoot_booked
shoot_rescheduled
shoot_cancelled
shoot_cancelled_by_superbad
shoot_rescheduled_by_superbad
shoot_reschedule_limit_hit
deliverables_ready
deliverables_viewed
post_trial_negative_feedback
retainer_fit_recommendation_ready
reflection_complete
```

**`deals.lost_reason` enum (Pipeline) — new values (non-breaking):**

```
trial_only_no_retainer_fit
intro_funnel_abandoned
intro_funnel_cancelled_refunded
intro_funnel_cancelled_no_refund
intro_funnel_no_show
intro_funnel_cancelled_by_superbad
prospect_unresponsive_reschedules
```

Closed list grows 7 → 14. Still a closed list.

**`deals` Trial Shoot sub-status (Pipeline) — new values:**

```
post_trial_awaiting_decision
post_trial_negative_feedback
```

---

## 5. Flow state machines

### 5.1 `funnel_state` transitions

```
contact_submitted
  ↓
questionnaire_in_progress  ← (first question answered in section 2)
  ↓
questionnaire_complete     ← (section 4 submitted)
  ↓
paid                        ← (Stripe webhook: payment_intent.succeeded)
  ↓
shoot_booked                ← (calendar booking created)
  ↓ (time-based, hourly cron)
shoot_approaching           ← (48h before slot_start_at)
  ↓ (time-based)
shoot_morning_of            ← (day of slot_start_at at 6am local)
  ↓ (time-based)
shoot_completed_awaiting_deliverables  ← (1h after slot_end_at)
  ↓ (triggered by bundle gate per §15.1: BOTH gallery URL pasted AND Six-Week Plan approved)
deliverables_ready
  ↓ (reflection completed)
reflection_complete
  ↓ (decision made or indefinite)
portal_dormant              ← (no activity for 30d OR "let me think" chosen)
  ↓ (Deal → Won in Pipeline)
portal_archived_migrated
```

Abandonment is not a `funnel_state` — it's `abandon_sequence_state` on the same row. A submission in `questionnaire_in_progress` that goes quiet hits `t_15m_sent`, `t_24h_sent`, `t_3d_sent`, `demoted` while its `funnel_state` stays at `questionnaire_in_progress` until demotion.

### 5.2 Candidate → Deal promotion timing

**Intro Funnel promotes to a Pipeline Deal at section 1 submit, not at first-send like Lead Gen.**

This is a deliberate departure from Lead Gen's rule. Rationale:

- Section 1 is a deliberate act of intent — the prospect has typed their name, business, email, phone, and consented to contact. That's a stronger entry-point signal than a cold candidate Claude-sourced from Meta Ad Library.
- The Deal lands directly at the **Trial Shoot** stage (not Lead), which means the Pipeline's Lead-stage graveyard problem doesn't apply — Trial Shoot is an active, in-progress stage by definition.
- Creating the Deal immediately gives the Intro Funnel an authoritative Pipeline home for `activity_log` entries, Twilio SMS events, payment events, etc. — everything threads into the same Deal timeline that Andy already knows how to read.
- If the prospect abandons, the Deal transitions to Lost with reason `intro_funnel_abandoned`, same Pipeline mechanism as any other loss. No orphaned state.

### 5.3 Booking state transitions (per `intro_funnel_bookings`)

```
booked
  ├─ rescheduled (reschedule_count++; new slot, same row or new row per §12.4)
  ├─ cancelled (by customer)
  ├─ cancelled (by SuperBad)
  ├─ completed (Andy marks post-shoot)
  └─ no_show (Andy marks post-shoot)
```

Cancellation policy enforcement is server-side in the cancel action handler; UI state is cosmetic. See §16.

---

## 6. Routes and API surface

### 6.1 Public (no auth) routes

```
GET  /trial-shoot                          Landing page
POST /api/intro-funnel/section-1          Section 1 contact submit → creates submission + Deal + session
```

### 6.2 Prospect-authenticated routes (magic-link session)

```
GET  /lite/intro/[token]                   Portal (state-dependent render)
GET  /lite/intro/[token]/questionnaire    Questionnaire surface (sections 2-4)
POST /api/intro-funnel/[token]/questionnaire/answer    Save one answer
POST /api/intro-funnel/[token]/questionnaire/complete-section    Advance section
GET  /lite/intro/[token]/pay              Payment surface (Payment Element mount)
POST /api/intro-funnel/[token]/payment-intent    Create or retrieve PaymentIntent
GET  /lite/intro/[token]/book             Calendar booking surface
POST /api/intro-funnel/[token]/book       Book a slot
GET  /lite/intro/[token]/manage-booking   Reschedule/cancel surface
POST /api/intro-funnel/[token]/reschedule Reschedule action
POST /api/intro-funnel/[token]/cancel     Cancel action
GET  /lite/intro/[token]/deliverables     Native gallery (Pixieset API-backed)
GET  /lite/intro/[token]/reflect          Reflection questionnaire
POST /api/intro-funnel/[token]/reflection/answer    Save reflection answer
POST /api/intro-funnel/[token]/reflection/complete  Finalise reflection, trigger synthesis
POST /api/intro-funnel/[token]/reflection/decision  Record CTA choice
```

### 6.3 Webhook endpoints

```
POST /api/webhooks/stripe                  Stripe events (payment_intent.succeeded, charge.refunded, etc.)
POST /api/webhooks/resend                  Resend events (delivered, opened, clicked, bounced, etc.)
POST /api/webhooks/twilio/status           Twilio delivery/status callbacks
POST /api/webhooks/twilio/inbound          Twilio inbound SMS (replies)
```

All webhooks are idempotent by provider event ID, per the Pipeline spec's webhook idempotency pattern.

### 6.4 Cron endpoints

```
POST /api/cron/intro-funnel/hourly         Time-based funnel_state transitions + abandon trigger dispatch
POST /api/cron/intro-funnel/abandon-watch  (folded into hourly) — checks for 15m/24h/3d thresholds
```

### 6.5 Admin routes (Andy, Auth.js session)

```
GET  /lite/settings/products/trial-shoot   Intro Funnel config panel
POST /api/settings/intro-funnel/config     Update config
GET  /lite/settings/calendar               Calendar config (business hours, advance notice, per-week cap)
POST /api/settings/calendar                Update calendar config
GET  /lite/deals/[id]/intro-funnel         (Panel inside existing deal profile — see §7.3)
POST /api/deals/[id]/pixieset-gallery      Paste Pixieset URL → triggers deliverables_ready transition
POST /api/deals/[id]/cancel-from-our-end   SuperBad-initiated cancellation
POST /api/deals/[id]/reschedule-from-our-end  SuperBad-initiated reschedule
```

---

## 7. UI surfaces

### 7.1 Customer-side (Intro Funnel portal)

Follows the Q2 state machine. Each state renders a distinct surface, all inside the shared `/lite/intro/[token]` layout with personalised header ("Welcome Andy!") and progress markers.

- **contact_submitted** — questionnaire call-to-action card + disabled payment card + "what to expect" section.
- **questionnaire_in_progress** — questionnaire surface (one question per screen, tappable cards, optional free text).
- **questionnaire_complete** — payment reveal (Tier-2 candidate #1 motion).
- **paid** — calendar booking surface.
- **shoot_booked** through **shoot_morning_of** — progressive portal with booking details, what-to-bring notes, optional reschedule/cancel button (subject to rules).
- **shoot_completed_awaiting_deliverables** — "shoot done, photos coming" placeholder screen.
- **deliverables_ready** — launch CTA for gallery, then inline native gallery component (Tier-2 candidate #3 on first view).
- **reflection_complete** — synthesis reveal screen (Tier-2 candidate #2), decision CTA pair, then transitions to dormant or conversion path.
- **portal_dormant** — minimal surface, "we're here when you're ready", gallery still accessible, reopen conversation affordance.
- **portal_archived_migrated** — redirect to real client portal (Client Management spec).

### 7.2 Landing page (`/trial-shoot`)

On-brand editorial, not conversion-funnel. Structure locked in Q14; content authoring deferred to the follow-up mini-session. Closed list of structural blocks:

1. Understated opener
2. Delight moment
3. Value drop
4. "What happens at a trial shoot"
5. Curated past work
6. Quiet commitment section (advance notice + per-week cap framed as care)
7. Price, matter of fact
8. CTA
9. Minimal footer

Single Next.js App Router page at `app/(public)/trial-shoot/page.tsx`. Client-component form island for the CTA → section 1 transition.

### 7.3 Andy-side (Pipeline Trial Shoot panel extensions)

The existing Trial Shoot panel on the Company/Deal profile (from Pipeline spec §Trial Shoot panel) gains Intro Funnel-specific fields:

- **Questionnaire answers viewer** — read-only surface rendering the shape-branched answers.
- **Signal tags display** — chips showing extracted tags.
- **Reflection answers viewer** — read-only, with the synthesis text shown.
- **Retainer-fit recommendation card** — prominent display of `recommendation_type`, `confidence`, `reasoning_text`, and `flags_json` bullets. Primary action area.
- **Pixieset gallery URL input** — paste field; on submit, triggers deliverables_ready transition.
- **"Cancel from our end" button** — with sub-actions (refund and close / reschedule on the house).
- **"Reschedule from our end" button** — opens calendar picker.
- **Abandon sequence state display** — which of 15m/24h/3d fired, when.
- **Twilio SMS thread view** — conversational view of outbound + inbound messages tied to this submission.

### 7.4 Settings → Products → Trial Shoot

Wizard-wrapped per the `feedback_setup_is_hand_held` memory (all config is step-by-step, not raw forms).

- **Step 1** — Price (dollar input, shown with live formatter)
- **Step 2** — Copy blocks (hero copy, commitment copy, confirmation email subject + body) — with brand-voice assistive drafting option
- **Step 3** — Reflection timing (delay hours after deliverables)
- **Step 4** — Review + save

### 7.5 Settings → Calendar

- **Step 1** — Timezone (prefilled from browser, confirm)
- **Step 2** — Business hours (weekly schedule grid, defaults to Mon–Fri 9am–5pm)
- **Step 3** — Blackout dates (date picker, list view)
- **Step 4** — Intro Funnel advance notice (number input, defaults to 5)
- **Step 5** — Intro Funnel per-week cap (number input, defaults to 3)
- **Step 6** — Review + save

### 7.6 Settings → Integrations → Pixieset / Twilio

Wizard-wrapped. Pixieset step is small — API credentials + account verification. Twilio step is larger — account SID, auth token, phone number provisioning, webhook URL setup.

---

## 8. Landing page spec

See §7.2 for structural blocks. Motion policy:

- House-spring transitions throughout
- Opener has a subtle entrance animation on load (no flash)
- Past work gallery items animate in on scroll (staggered)
- CTA button has a house-spring hover/press
- Transition from hero state → section 1 form uses house-spring; not a new Tier-2 moment

Content authoring flagged for follow-up mini-session. Spec reserves the slots.

---

## 9. Questionnaire spec (sections 2–4)

### 9.1 Shape branching

Section 1 determines the prospect's shape via a direct question (*"Which best describes your business right now?"*). Closed list:

- `solo_founder` — one person running the show
- `founder_led_team` — founder plus a small team
- `multi_stakeholder_company` — multiple decision-makers

Sections 2–4 load a variant based on shape. One branching dimension only. Three variants × four sections = twelve question banks.

### 9.2 Section structure

- **Section 1 — Contact + shape** (on landing page, not in portal)
- **Section 2 — Business context** (what you do, who you serve, how long you've been at it)
- **Section 3 — Photography context** (what you currently do for imagery, what's working, what's not)
- **Section 4 — Ambitions** (where you want to be, what support would look like)

Each section is 4–8 questions depending on variant. Closed-list options on tappable cards; 1–2 optional free-text questions per section for texture.

### 9.3 Signal tag extraction

After each section completes, a Haiku-tier Claude call reads the raw answers and emits structured `signal_tags` — a bag of tags from a closed taxonomy shared with Brand DNA Assessment (backlog #5). Tags feed `intro_funnel_submissions.signal_tags_json` and are consumed downstream by the retainer-fit recommender.

Prompt lives at `lib/intro-funnel/prompts/signal-tag-extraction.ts`.

### 9.4 Persistence + resume

Every answer saves immediately via `POST /api/intro-funnel/[token]/questionnaire/answer`. Prospect can leave mid-question and return — portal loads the last question they haven't answered. `last_activity_at` updates on every save, resetting abandon timers.

### 9.5 Content authoring

Question text, closed-list options, free-text prompts, and the signal-tag taxonomy are all authored in the follow-up mini-session with `superbad-brand-voice` + `superbad-visual-identity` skills loaded. Spec reserves the slots and locks the shape.

---

## 10. Portal spec

See §7.1 for state-dependent surfaces. Key cross-cutting concerns:

- **Personalisation** — every screen shows first name + business name in the header. Data source: `intro_funnel_submissions.submitted_name` / `submitted_business_name`.
- **Progress indicators** — a subtle step strip at top showing questionnaire progress (during in-progress) or post-payment stage (during booked→approaching→morning_of→completed).
- **Return path** — the magic link in the section 1 confirmation email is an Auth.js one-click sign-in. Prospect can close the tab and return weeks later. Session duration: 90 days.
- **No keyboard shortcuts** — per the CLAUDE.md "Andy is mouse-first" rule; applies to customer too unless we have reason to believe otherwise.
- **No chat, no messaging, no notifications surface** — explicitly out of scope. Communication happens via email/SMS/phone outside the portal.

---

## 11. Payment flow spec

### 11.1 Stripe architecture choice

**Payment Intents with dynamic amount, NOT Stripe Products + Prices.**

Stripe Products + Prices are immutable once created — changing the price means creating a new Price object and migrating references. For an editable `intro_funnel_config.price_cents` that Andy can tweak freely from Settings, Payment Intent with a runtime-passed `amount` is the correct pattern. No Stripe dashboard dance, no Price object sprawl.

### 11.2 Flow

```
Prospect lands on /lite/intro/[token]/pay
  ↓
POST /api/intro-funnel/[token]/payment-intent
  ↓
Server reads intro_funnel_config.price_cents (authoritative)
Server calls ensureStripeCustomer(deal.primary_contact_id) → stripeCustomerId  // FOUNDATIONS §11.7
Server creates Stripe PaymentIntent({ amount, currency, customer: stripeCustomerId, metadata: { submission_id, deal_id } })
Server returns clientSecret
  ↓
Client mounts Payment Element with clientSecret
Cinematic reveal motion (Tier-2 candidate #1) as card unfolds
  ↓
Prospect submits payment
  ↓
Stripe confirms → webhook fires
  ↓
POST /api/webhooks/stripe receives payment_intent.succeeded
Handler validates signature (Stripe webhook secret)
Handler creates intro_funnel_payments row with status='succeeded'
Handler transitions intro_funnel_submissions.funnel_state = 'paid'
Handler writes activity_log entry intro_funnel_paid (LOUD — celebratory sound + top cockpit slot)
Handler emits Pipeline event → deal stage stays Trial Shoot but sub-status updates
  ↓
Client redirects to /lite/intro/[token]/book
```

### 11.3 Failure handling

- Declined card → Stripe Payment Element surfaces the error inline; prospect retries in-place.
- Webhook failure → Stripe retries on its own schedule; meanwhile polling on the client side also confirms via `payment-intent/status` GET to bridge the gap.
- Refund handling → `charge.refunded` webhook mirrors the refund state on `intro_funnel_payments`.

### 11.4 Receipt

Stripe handles the tax receipt automatically (standard Stripe receipt email). Andy's branded confirmation email fires from the Lite side as a separate communication containing booking details + next steps + portal link.

---

## 12. Calendar spec (native)

### 12.1 Why native

Q7 lock: native build over Cal.com. Opportunistic primitive shared with future marketing-site booking widget. The shared `calendar_bookings` table (§4.1) is polymorphic on `booking_type`, anticipating multiple booking surfaces.

### 12.2 Availability engine

```
computeAvailableSlots({
  fromDate,
  toDate,
  bookingType: 'intro_funnel_shoot',
  timezone,
}): Slot[]
```

Reads `calendar_config`, applies:
- Business hours filter
- Blackout date filter
- Intro Funnel: 5-business-day advance notice (`addBusinessDays(today, 5)` is the minimum startable date)
- Intro Funnel: 3-per-week cap — counts existing `calendar_bookings` of type `intro_funnel_shoot` in the target week, excludes weeks where count ≥ cap
- Slot granularity: 2-hour slots starting on the hour (configurable in `calendar_config` v1.1; hardcoded in v1)

Returns an array of slot candidates rendered in the booking surface.

### 12.3 Booking action

```
POST /api/intro-funnel/[token]/book { slot_start_at, slot_end_at }
  ↓
Server re-computes availability (prevents race conditions)
If slot no longer valid → 409 Conflict with fresh slots
If valid → create intro_funnel_bookings row + calendar_bookings row (atomic)
Transition funnel_state → 'shoot_booked'
Emit shoot_booked activity_log entry (quiet)
Send confirmation email via Resend with .ics attachment
Server responds 200
```

### 12.4 Reschedule

```
POST /api/intro-funnel/[token]/reschedule { new_slot_start_at, new_slot_end_at }
  ↓
Server checks:
  - reschedule_count < 2 (hard cap from Q16)
  - new slot >48h out (customer-side cannot reschedule inside 48h)
  - new slot passes availability engine checks
If reschedule_count === 2 → 403 Forbidden with "contact Andy" message + urgent-sound cockpit notification
If >48h violation → 403 Forbidden with message
If slot invalid → 409 Conflict
Otherwise:
  - Update intro_funnel_bookings: increment reschedule_count, update slot
  - Update calendar_bookings: update start/end
  - Emit shoot_rescheduled activity_log (quiet)
  - Email confirmation with new .ics
```

Rescheduling is an in-place update on the same `intro_funnel_bookings` row. `reschedule_count` tracks total attempts across the life of the booking.

### 12.5 SuperBad-initiated reschedule

`POST /api/deals/[id]/reschedule-from-our-end` — bypasses reschedule_count limit (doesn't increment), bypasses 48h restriction, emits `shoot_rescheduled_by_superbad` event, sends apology email with brand-voice copy generated by a Haiku-tier Claude call (§11.5 drift-checked).

### 12.6 `.ics` generation

Standard RFC 5545 ICS file, attached to the confirmation email. Includes shoot title, location TBD (filled in Andy-side via Pipeline Trial Shoot panel), duration, organiser (Andy), attendee (prospect), description with portal link.

---

## 13. Post-shoot spec

### 13.1 Reflection timing

Reflection surface becomes available `intro_funnel_config.reflection_delay_hours_after_deliverables` hours after `deliverables_ready` fires (default 24h — registered as `intro_funnel.reflection_delay_hours_after_deliverables` in `docs/settings-registry.md`). Hourly cron checks and transitions the portal to surface the reflection CTA.

**Note (F2.a, 2026-04-13).** `deliverables_ready` is the bundled state per §15.1 — fires only when **both** the Pixieset gallery URL is pasted and the Six-Week Plan is approved. The 24h reflection clock runs from that single bundled transition. The prospect therefore always has both artefacts in hand for at least 24h before being asked to reflect.

### 13.2 Reflection question arc (8 questions, one per screen)

Locked shape; exact wording deferred to content authoring. The 8-screen arc:

1. **Safety valve — honest check.** *"Before we reflect on the shoot, was there anything about the experience that wasn't right?"* Options: *"Everything was great"* / *"There was something off — I'd like to share"*. Second option triggers `safety_valve_triggered = true`, routes into a short free-text feedback screen, completes the reflection early, and creates a `post_trial_negative_feedback` sub-status + urgent cockpit card for Andy.
2. **Experience.** How did the shoot feel?
3. **Value reflected.** What did you get out of it?
4. **Working with Andy.** What was it like working together?
5. **Specific value (optional free text).** One moment or detail that stood out?
6. **Future-casting.** If this was the start of a longer relationship, what would it look like?
7. **Commitment crystallisation.** What would you want SuperBad to handle if we kept working together?
8. **Synthesis reveal screen.** Claude-generated, Tier-2 motion, decision CTA pair.

### 13.3 Claude synthesis

The single most load-bearing Claude generation in Intro Funnel.

- **Model:** `claude-opus-4-6`
- **Prompt file:** `lib/intro-funnel/prompts/reflection-synthesis.ts`
- **Inputs:** reflection answers, shape, signal tags, onboarding questionnaire answers, **SuperBad's perpetual Brand DNA profile (`brand_dna_profiles` row where `subject_type = 'superbad_self'`, `status = 'complete'`)** — guaranteed to exist by the foundation-level First-Login Brand DNA Gate (FOUNDATIONS §11.8 / Brand DNA Assessment §11), so the prompt reads it unconditionally with no stub fallback (F2.b, 2026-04-13 Phase 3.5 Step 11 Stage 2)
- **Output:** prose synthesis that mirrors the prospect's own reasoning back to them in SuperBad's voice, framing continuation as the obvious next step
- **Drift check:** §11.5 passes before display. Fail → show a safe fallback synthesis that's still warm but less personal.
- **Storage:** `intro_funnel_reflections.synthesis_text` + metadata (model, prompt_version, drift_check_passed, generated_at)

### 13.4 Retainer-fit recommendation

Fires in the background after reflection completes — **including when the safety valve was triggered** (F2.d, 2026-04-13 Phase 3.5 Step 11 Stage 2).

- **Model:** `claude-opus-4-6`
- **Prompt file:** `lib/intro-funnel/prompts/retainer-fit.ts`
- **Inputs:** onboarding questionnaire answers, enrichment viability profile, reflection answers (including the safety-valve free-text feedback when present), synthesis text (null if safety valve skipped Q8), **SuperBad's perpetual Brand DNA profile** (read unconditionally per F2.b — guaranteed by First-Login Brand DNA Gate; see §13.3), standing brief from Settings, **`safety_valve_triggered` boolean flag** (so the prompt can branch into the safety-valve handling described below)
- **Output:** structured JSON
  ```ts
  {
    recommendation_type: 'retainer' | 'saas' | 'neither' | 'either_strong',
    confidence: 'high' | 'medium' | 'low',
    reasoning_text: string, // 2-3 paragraphs in Andy's voice
    flags: Array<{ type: string, detail: string }>, // e.g. [{ type: 'budget_concern', detail: '...' }]
  }
  ```
- **Safety-valve branch (F2.d).** When `safety_valve_triggered = true`, the prompt is biased to honour the negative signal: `recommendation_type` typically lands on `'neither'` (with rare exceptions where the underlying business signal is strong enough to warrant `'retainer'` or `'saas'` despite the experience friction); `flags` includes a `{ type: 'safety_valve_triggered', detail: <summary of the feedback> }` entry; `reasoning_text` names the safety valve as the primary input and explicitly does not pitch around it. The output remains useful for Andy's manual handling — informing the conversation, not pre-empting it.
- **Drift check:** §11.5 passes before storage. Fail → re-generate once with an amended prompt; if second fail, store with `drift_check_passed: false` and still surface to Andy (with a warning chip in the cockpit card — Andy is the ultimate arbiter).
- **Storage:** `intro_funnel_retainer_fit` row
- **Surface — Andy-only, hard lock (F2.d).** Quiet cockpit feed entry `retainer_fit_recommendation_ready`, plus display on the Pipeline Trial Shoot panel for the Deal. **The retainer-fit recommendation is internal-only and must never reach the prospect via any channel — no email, no SMS, no portal surface, no PDF, no quote auto-population copy that quotes the recommendation back at them.** Build-time discipline: every consumer of `intro_funnel_retainer_fit` must be on an Andy-authenticated route or an Andy-targeted comm. A `lib/intro-funnel/retainer-fit.ts` accessor function with a `// internal-only` JSDoc + an ESLint-able marker keeps this honest. Phase 5 Intro Funnel build session adds the marker; Phase 4 foundation session adds the lint rule (or comments-as-discipline if a custom rule is overkill).
- **Cockpit ordering on safety-valve path (F2.d).** Both cards may fire on the same Deal: the urgent `post_trial_negative_feedback` card AND the quiet `retainer_fit_recommendation_ready` entry. Cockpit's existing urgent-above-quiet ordering handles the layout — no new ordering rule needed. The retainer-fit card visually deprioritises (smaller, lower) when the urgent card is present on the same Deal.

### 13.5 Decision CTA handling

- **"Yes — let's talk about what's next"** → opens a follow-up booking via the native calendar (new `booking_type: 'followup_conversation'`), creates urgent cockpit card for Andy, emails Andy the context bundle.
- **"Let me think about it"** → portal transitions to dormant state after 48h. `reflection_complete` activity log (quiet). Andy can reopen from cockpit.

---

## 14. Abandon + re-engagement spec

### 14.1 Detection

Hourly cron `/api/cron/intro-funnel/hourly` reads `intro_funnel_submissions` where:
- `funnel_state IN ('contact_submitted', 'questionnaire_in_progress', 'questionnaire_complete')`
- `abandon_sequence_state !== 'demoted'`
- `NOW - last_activity_at` exceeds the next threshold for current state

### 14.2 Thresholds and actions

| State | Threshold | Action | New state |
|---|---|---|---|
| `pending` | ≥ 15 min | Send SMS via Twilio (conversational, from Andy's number) | `t_15m_sent` |
| `t_15m_sent` | ≥ 24 h since creation | Send SMS + email (SMS first, email ~1h later) | `t_24h_sent` |
| `t_24h_sent` | ≥ 3 d since creation | Send email (rescue, reframe) | `t_3d_sent` |
| `t_3d_sent` | ≥ 3 d + 1 h | Demote Deal → Lost with reason `intro_funnel_abandoned`, contact flows to cold pool, activity log | `demoted` |

Any portal activity before demotion resets `last_activity_at` and the sequence state to `pending`.

### 14.3 Send gating

- All outbound (email + SMS) flows through §11.2 safe-to-send gate.
- Email uses §11.4 quiet window (7am–10pm local).
- SMS uses stricter 8am–9pm local window.
- SMS adds `isBlockedFromOutreach(phone)` check against `dnc_phones`.
- Email adds the existing `isBlockedFromOutreach(email)` check from Lead Gen.
- Any gate block triggers a deferred-until-tomorrow-morning retry; multiple gate blocks emit a silent `activity_log` entry (no cockpit surface).

### 14.4 Content

- **15m SMS** — conversational, low-key, from Andy's voice. Plain sentence. No links (links in SMS reduce delivery). Example register: *"Hey [name], saw you started booking your trial shoot and didn't finish — anything I can help with? — Andy"*
- **24h SMS** — quick nudge with portal link. Example: *"Your trial shoot spot is still open — [portal_link]"*
- **24h email (~1h after 24h SMS)** — branded email with portal deep-link, one-paragraph re-pitch, CTA button.
- **3d email** — final rescue, reframes rather than reminds. One paragraph on why it's worth 15 minutes. *"If now's not the right time, no worries, we'll be here"* closer.

All email copy drafted by Claude Haiku from a prompt that reads `intro_funnel_submissions.questionnaire_answers_json` and `shape` for personalisation. `lib/intro-funnel/prompts/abandon-email.ts`. Passes §11.5 drift check before send.

SMS copy is hardcoded templates with personalisation tokens — no Claude involvement. SMS is too short and too legally sensitive to Claude-generate; fixed templates are safer and faster.

### 14.5 Twilio reply handling

Inbound SMS → `POST /api/webhooks/twilio/inbound` → match `From` against `intro_funnel_submissions.submitted_phone` → write `twilio_sms_log` row with `direction: 'inbound'` → write `activity_log` entry `intro_funnel_sms_replied` → emit urgent cockpit card + urgent sound. Andy handles the reply personally. No AI-drafting of SMS replies in v1.

### 14.6 Post-demotion drafting (Q12 lock)

Once demoted, the contact flows back to the cold outreach pool. Lead Gen's `generateDraft()` reads `funnel_history` as one more context field — no new prompt path, no branching. Claude decides the angle based on what it sees (sections completed, signal tags, time since abandonment, SMS reply presence).

---

## 15. Deliverables spec (Pixieset integration)

### 15.1 Flow

**Bundled release rule (F2.a, 2026-04-13 Phase 3.5 Step 11 Stage 2).** `deliverables_ready` is a unified state that fires only when **both** the Pixieset gallery URL has been pasted **and** the Six-Week Plan has been approved by Andy. Whichever step lands second is the trigger. One announcement email goes out covering both. Reflection clock starts from this single transition (see §13.1). Rationale: clean single reveal moment ("here's your shoot, here's what to do with it"); avoids two separate reveal beats; matches Six-Week Plan §2.6. The trade-off — that one artefact may have to wait briefly for the other — is mitigated by upfront timeframe signposting in landing/payment/booking copy (see §24 content mini-session).

```
Shoot happens (meatspace)
  ↓
[parallel pre-conditions, in any order]
  ├─ Andy processes photos → creates Pixieset gallery → pastes URL
  │     POST /api/deals/[id]/pixieset-gallery { url }
  │     Server parses URL, stores pixieset_gallery_id + pixieset_gallery_url on deals + intro_funnel_submissions
  │     Sets intro_funnel_submissions.gallery_ready_at = NOW
  │     activity_log entry: gallery_attached (silent)
  │
  └─ Andy fills Trial Shoot panel notes → Generate plan → review queue → approve
        Six-Week Plan Generator §2.5 transitions plan to 'approved'
        Sets intro_funnel_submissions.plan_ready_at = NOW
        activity_log entry: six_week_plan_approved (already specced in S6WPG §2.5)
  ↓
Bundle gate: when BOTH gallery_ready_at AND plan_ready_at are non-null
  ↓
Server transitions funnel_state → 'deliverables_ready'
Server sets intro_funnel_submissions.deliverables_ready_at = NOW (= the later of gallery_ready_at, plan_ready_at)
Server writes activity_log entry deliverables_ready (quiet)
Server sends single bundled announcement email to prospect (classification: deliverables_ready_announcement; copy drafted in §24 content mini-session — covers both gallery + plan in one beat)
Six-Week Plan releases to prospect portal per S6WPG §2.6
```

The bundle gate is checked twice: once on `gallery_attached`, once on `six_week_plan_approved`. Whichever handler observes both flags non-null fires the transition. Idempotency: if `funnel_state` is already `deliverables_ready`, the second handler no-ops on the transition + email.

**Cockpit visibility for the waiting half.** While waiting on the slower side, Andy's cockpit shows a quiet feed entry `intro_funnel_awaiting_bundle { deal_id, prospect_name, waiting_on: 'gallery' | 'plan' }` so he knows which side is the gate. Refreshes (i.e. clears + re-emits with updated `waiting_on`) on each side completing.

### 15.2 Portal gallery component

On portal load in `deliverables_ready` state:
- Launch CTA appears with house-spring motion
- Prospect clicks launch
- Native gallery component mounts at `/lite/intro/[token]/deliverables`
- Component calls Pixieset API via `lib/integrations/pixieset.ts` to fetch gallery contents (image list, metadata, full-size URLs)
- Renders in our design system with cinematic reveal (Tier-2 candidate #3)
- `deliverables_viewed` activity log fires on first view (quiet cockpit surface)

### 15.3 Pixieset API integration

`lib/integrations/pixieset.ts` — capability confirmation **moved earlier (F2.c, 2026-04-13 Phase 3.5 Step 11 Stage 2)**: a 1-session Phase 4 prep spike confirms the API surface (private gallery access, image-URL fetching, auth model, rate limits) before BUILD_PLAN.md is finalised. The deliverables reveal is one of the funnel's bigger emotional moments; surprise risk gets removed before the build commits to either path.

**Two outcomes from the spike:**

1. **API sufficient** → inline gallery component path (§15.2) builds as specced. Cinematic Tier-2 reveal candidate #3 is live. `deliverables_viewed` fires on first view inside the portal.

2. **API insufficient** → on-brand link-out fallback. The portal still renders a branded "Your gallery is ready" surface using the design system + house-spring motion (NOT a raw HTML anchor). The CTA opens the Pixieset gallery in a new tab. Cinematic Tier-2 reveal candidate #3 does **not** fire on this path (the reveal happens in Pixieset's UI, outside our control). `deliverables_viewed` fires when the CTA is clicked. If this path lands as v1.0 default, a Phase 4 mop-up brainstorm decides whether to evaluate Pixieset alternatives (Pic-Time, Cloudspot, ShootProof) before accepting it as final.

### 15.4 Retention

30+ days is Pixieset's responsibility. Our portal link stays live indefinitely; if Andy ever expires a Pixieset gallery, the portal shows a fallback screen with a "contact Andy" affordance.

---

## 16. Cancellation + reschedule spec

### 16.1 Customer-side rules

- **Refund window**: >48h before `slot_start_at` = full refund. Inside 48h = no refund.
- **Reschedule limit**: max 2 reschedules. 3rd attempt is blocked and routes to "contact Andy".
- **Auto-Lost on 3rd attempt**: Deal → Lost with reason `prospect_unresponsive_reschedules`, prospect stays in cold pool with signal tags indicating "timing is the blocker."

### 16.2 Customer-side UI surface (`/lite/intro/[token]/manage-booking`)

- Current booking display (date, time, location)
- Reschedule button — disabled if `reschedule_count >= 2` OR `slot_start_at - NOW < 48h`
- Cancel button — always available, copy changes based on timing:
  - >48h out: *"Cancel and refund $X"*
  - <48h out: *"Cancel booking (no refund inside 48 hours)"*
- Clean explainer copy, no hidden fees, matches the quiet-commitment tone from the landing page

### 16.3 Cancel action handler

```
POST /api/intro-funnel/[token]/cancel
  ↓
Server reads booking, computes time-to-slot
If >48h out:
  - refundPaymentIntent() full refund via Stripe
  - Update payments.status = 'refunded'
  - Update booking.status = 'cancelled', cancelled_by = 'customer', cancelled_reason_code = 'customer_cancel_refunded'
  - Transition Deal → Lost with reason intro_funnel_cancelled_refunded
  - activity_log: intro_funnel_cancelled_refunded
  - Contact flows back to cold pool
  - Cockpit: urgent-ish (booking cancellation is a human touchpoint)
If <48h out:
  - Update booking.status = 'cancelled', cancelled_by = 'customer', cancelled_reason_code = 'customer_cancel_no_refund'
  - Transition Deal → Lost with reason intro_funnel_cancelled_no_refund
  - activity_log: intro_funnel_cancelled_no_refund
  - Contact flows back to cold pool
  - Cockpit: urgent-ish
```

### 16.4 SuperBad-initiated cancellation (always refundable)

Triggered from the Trial Shoot panel.

```
POST /api/deals/[id]/cancel-from-our-end { mode: 'refund_and_close' | 'reschedule_on_the_house', reason_note }
  ↓
If mode = 'refund_and_close':
  - refundPaymentIntent() full refund (regardless of timing)
  - Update payments.status = 'refunded'
  - Update booking.status = 'cancelled', cancelled_by = 'superbad', cancelled_reason_code = reason_note
  - Transition Deal → Lost with reason intro_funnel_cancelled_by_superbad
  - activity_log: shoot_cancelled_by_superbad
  - Send apology email (brand-voice, Haiku-drafted, §11.5 drift-checked)
If mode = 'reschedule_on_the_house':
  - Do NOT refund
  - Do NOT increment reschedule_count
  - Open calendar picker for the new slot
  - Update booking.slot_start_at + slot_end_at
  - activity_log: shoot_rescheduled_by_superbad
  - Send apology + rebooking email
```

### 16.5 Copy policy

Landing page, section 1, checkout page, and booking confirmation email all carry one consistent line:

> *"If we ever need to cancel or reschedule on our end, you get a full refund — no questions, no timing catches."*

Legal review flagged for launch checklist — copy must be reviewed by legal before launch but not a v1 build blocker.

---

## 17. Notifications spec

Per Q15 policy. Enumerated:

### 17.1 Urgent (cockpit top slot + sound)

| Event | Sound | Cockpit surface |
|---|---|---|
| `intro_funnel_paid` | celebratory | top of attention feed, "new payment" card |
| `post_trial_negative_feedback` | urgent alert | top of feed, "follow up personally" card |
| `intro_funnel_sms_replied` | attention | top of feed, raw SMS content visible |
| `shoot_booking_cancelled` (customer-initiated) | attention | cockpit card with "reschedule offer" CTA |
| `shoot_reschedule_limit_hit` | attention | cockpit card with "contact prospect" CTA |

### 17.2 Surfaced quietly (cockpit normal slot, no sound)

- `intro_funnel_started` (section 1 submitted)
- `intro_funnel_complete` (all 4 sections submitted, questionnaire_complete state)
- `retainer_fit_recommendation_ready` (with recommendation summary in card)
- `deliverables_viewed` (once per deal, first view)
- `six_week_plan_viewed` (once per deal, first view) — F2.a addition
- `reflection_complete` (with synthesis summary)
- `intro_funnel_awaiting_bundle` (F2.a addition) — quiet feed entry showing which side of the bundle gate Andy still needs to complete (`waiting_on: 'gallery' | 'plan'`); refreshes when state changes; clears on `deliverables_ready`.
- `deliverables_ready` (bundled — single quiet feed entry naming both artefacts as released)

### 17.3 Silent (activity_log only)

- Section transitions mid-questionnaire
- Abandon timers firing (15m, 24h, 3d)
- Auto-drafted abandonment emails sending
- Time-based funnel_state transitions (approaching, morning_of)
- Pixieset gallery URL pasted (Andy's own action)

### 17.4 Not built in v1

- Settings UI for notification tuning — defaults hardcoded, v1.1 can add
- Email-to-Andy digest — cockpit is the surface
- Phone push notifications — browser only
- Quiet hours for Andy's cockpit — Andy chooses when to open; cockpit doesn't time-gate itself

---

## 18. Claude prompts catalogue

All prompts live under `lib/intro-funnel/prompts/` in version-controlled files. Matches Lead Gen + Content Engine conventions.

| File | Tier | Purpose | Inputs | Output |
|---|---|---|---|---|
| `signal-tag-extraction.ts` | Haiku | Extract `signal_tags` from questionnaire section answers | Section answers (raw), shape, existing tags (for idempotency) | Array of tags from closed taxonomy |
| `reflection-synthesis.ts` | Opus | Generate the post-shoot synthesis reveal text | Reflection answers, shape, signal tags, onboarding answers, Brand DNA perpetual context, SuperBad voice skill | Prose synthesis text |
| `retainer-fit.ts` | Opus | Generate retainer-fit recommendation | Full context bundle (onboarding + enrichment + reflection + synthesis + Brand DNA + standing brief) | Structured JSON (recommendation_type, confidence, reasoning_text, flags) |
| `abandon-email.ts` | Haiku | Draft abandonment rescue email (24h + 3d variants) | Submission state, questionnaire answers, shape, stage (24h/3d) | Email subject + body |
| `apology-email.ts` | Haiku | Draft apology email for SuperBad-initiated cancel/reschedule | Reason note, prospect context, mode (cancel/reschedule) | Email subject + body |

Every customer-facing output (synthesis, abandon emails, apology emails) passes through §11.5 drift check before send/display. The retainer-fit recommendation is internal-only per §13.4 (F2.d, 2026-04-13) — never reaches the prospect via any channel — but also passes through the drift check as a belt-and-braces voice-consistency safeguard on Andy's surfaces. Failures route to safe fallbacks — none of these LLM calls are allowed to silently ship broken output.

All prompts read the SuperBad perpetual Brand DNA context — guaranteed by the First-Login Brand DNA Gate (FOUNDATIONS §11.8 / Brand DNA Assessment §11.1, F2.b 2026-04-13) — AND the Client Context Engine output (once Context Engine ships, backlog #7), per the two-perpetual-contexts memory. No stub path exists; the gate guarantees the perpetual profile is real before any consumer runs.

---

## 19. Cross-spec update flags

Non-breaking changes that other specs need to absorb. None are blocking for Intro Funnel's Phase 5 build.

### 19.1 `docs/specs/sales-pipeline.md` updates

- **`deals` table columns**: `funnel_submission_id`, `funnel_state`, `post_trial_signal`, `pixieset_gallery_id`, `pixieset_gallery_url`, `reschedule_count`. All nullable.
- **`contacts` table columns**: `phone`, `sms_opt_in`, `sms_consent_at`. All nullable.
- **`activity_log.kind` enum**: 21 new values (§4.2 list).
- **`deals.lost_reason` enum**: 7 new values (closed list grows 7 → 14).
- **Trial Shoot sub-status** (existing enum from Pipeline spec §Trial Shoot): add `post_trial_awaiting_decision` and `post_trial_negative_feedback`.
- **`createDealFromLead()`**: add `source: 'intro_funnel_contact_submitted'` to the accepted sources enum. Pipeline's function signature already supports this — just a new enum value.
- **Trial Shoot panel**: gains 8 new fields/sub-surfaces listed in §7.3. These are additive to the existing panel spec.
- **Stripe webhook handler**: `payment_intent.succeeded` event handling for Intro Funnel products. Existing webhook endpoint; new case branch.

None of these break existing Pipeline behaviour. Can be picked up in the first Phase 5 schema session alongside the Lead Gen update flags from the Lead Gen handoff.

### 19.2 `docs/specs/design-system-baseline.md` revisit

3 new candidate Tier-2 motion moments:
- Payment Element reveal (inline card unfolding to checkout)
- Claude synthesis reveal (reflection final screen)
- Deliverables gallery reveal (first view of native Pixieset gallery)

Closed list grows from 7 → 10 Tier-2 moments + 2 overlays unchanged. A brief revisit of the design system baseline spec to evaluate and absorb. Not a full session — likely 15–20 minutes.

### 19.3 `FOUNDATIONS.md` — new stack dependency

Twilio. Non-breaking addition:
- New integration wrapper at `lib/integrations/twilio.ts` with parity to Resend's wrapper (safe-to-send gate, quiet-window, DNC enforcement, audit logging)
- New table `dnc_phones` parallel to `dnc_emails`
- New SMS-specific quiet window constant (8am–9pm local)
- Setup wizard step for Twilio credentials + phone number provisioning

Pixieset is NOT a stack addition — just a URL field and an API call. No new Foundations dependency beyond the integration wrapper file.

### 19.4 Downstream spec integration notes

- **Brand DNA Assessment (backlog #5)**: the signal-tag taxonomy is shared. Brand DNA session should inherit the taxonomy v0 from this spec's follow-up mini-session authoring.
- **Onboarding + Segmentation (backlog #6)**: receives retainer-fit recommendation as input at Won time for retainer onboarding kickoff. Flag to that session.
- **Client Context Engine (backlog #7)**: the reflection synthesis and retainer-fit prompts will refactor to delegate to the Context Engine primitive once it ships. Behaviour unchanged; implementation consolidates.
- **Client Management (backlog #8)**: receives the fork-at-Won migration from Intro Funnel portal. Must handle the migration job + preserve deliverables/questionnaire/Brand DNA signals.
- **SaaS Subscription Billing (backlog #9)**: receives Won-as-SaaS path from Intro Funnel when retainer-fit recommendation is `saas` and prospect subscribes.
- **Content Engine (backlog #10)**: no direct integration, but past work gallery on the landing page may eventually be populated from Content Engine's curated case studies.
- **Unified Inbox (backlog #11)**: Twilio SMS thread should appear in the inbox alongside email threads once inbox ships. Until then, the thread view lives on the Trial Shoot panel.
- **Daily Cockpit (backlog #12)**: consumes all the notification events enumerated in §17. Flag to Cockpit session.
- **Setup Wizards (backlog #13)**: adds wizard steps for Pixieset, Twilio, calendar config, Settings → Products → Trial Shoot.
- **Hiring Pipeline (backlog #14)**: no integration. Unrelated CRM.

---

## 20. Build-time disciplines

Chokepoints and invariants that must be enforced by code, not trust. Each is a named function or module boundary.

### 20.1 `enforceAdvanceNoticeRule(slotStartAt, configSnapshot)`

Pure function. Single source of truth for the 5-business-day rule. Called from:
- Customer booking action
- Customer reschedule action
- Availability engine (upfront filter)

Never bypassed. Tests assert it's called from every booking write path. SuperBad-side cancel/reschedule is a separate code path that explicitly does NOT call this function — that's the documented exception, not a bypass.

### 20.2 `enforcePerWeekCap(targetWeekStart, configSnapshot)`

Pure function. Counts existing Intro Funnel bookings in the target week and returns true/false. Called from same sites as §20.1.

### 20.3 `isBlockedFromOutreach({ email?, phone? })`

Extends Lead Gen's single enforcement function to include the phone variant. Called from:
- Intro Funnel abandon email dispatcher
- Intro Funnel abandon SMS dispatcher
- Apology email dispatcher
- Any future outbound

Single source of truth for DNC + unsubscribe + complaint state across both email and phone channels.

### 20.4 `refundPaymentIntent(paymentIntentId, { amount? })`

Stripe integration wrapper. Always fires synchronously and awaits confirmation. Called from:
- Customer cancel handler (when >48h out)
- SuperBad cancel handler (always)

Failures raise an alert + urgent cockpit card for Andy to handle manually.

### 20.5 `generateSynthesisText()` and `generateRetainerFitRecommendation()`

Both always run through §11.5 drift check before display/storage. Drift-check failure routes to safe fallback (synthesis) or flagged-to-Andy path (retainer fit). Tests assert drift check is called every time.

### 20.6 `parsePixiesetUrl(url) → { gallery_id, canonical_url }`

Pure function with strict validation. Called from the `paste Pixieset URL` handler. Invalid URLs raise a form validation error, never silently fail.

### 20.7 Prompt files are version-controlled at `lib/intro-funnel/prompts/`

No inlined prompt strings in route handlers or components. Matches Content Engine + Lead Gen locked pattern. Every prompt file exports a named `PROMPT_VERSION` constant that gets written into the relevant record (`reflection_synthesis.synthesis_prompt_version` etc.) for auditability.

### 20.8 `calendar_bookings` is the authoritative availability source

No second booking table. No Google Calendar sync in v1 (`calendar_bookings` is the source; Google Calendar could be a publish target in v1.1). Any code path that wants to check "is this slot free" reads `calendar_bookings`, never a cached view or a computed in-memory structure.

### 20.9 Intro Funnel config is singleton + versioned

`intro_funnel_config` has a single row with id `singleton`. Updates write a new `updated_at`. If any future feature needs config history, add a `config_versions` table — do not turn the singleton into a multi-row history.

### 20.10 Section 1 submit is the Deal creation point

Deal is created on section 1 submit, not on any later state. This is the architectural answer to "where does the Pipeline card come from" for Intro Funnel. Do not add alternative creation paths.

---

## 21. Open questions deferred to Phase 5

Captured for future reference. None block Phase 4 build planning.

1. **SMS quiet window exact bounds** (8am–9pm local is the starting point; may tune with data)
2. **Abandonment threshold values** (15m / 24h / 3d are starting points; may tune)
3. **Reschedule limit value** (2 is the starting point; may tune)
4. **Refund window value** (48h is the starting point; may tune)
5. **Per-week cap value** (3 is the starting point; may tune — editable in Settings)
6. **Pixieset API capability** (full surface confirmation happens in the Phase 5 integration session; fallback is gallery URL link-out)
7. **Calendar slot granularity** (2h hardcoded in v1; editable in v1.1 if needed)
8. **Reflection delay hours after deliverables** (24h default; editable in Settings)
9. **Twilio conversational identity** (does Andy use a dedicated Twilio number or his personal mobile? — setup wizard decision, not a spec decision)
10. **Signal-tag taxonomy v1 content** (authored in follow-up mini-session alongside question banks)
11. **Dormant portal activity threshold** (30 days starting point; may tune)
12. **Follow-up conversation booking duration** (default 30 min; editable via Settings in v1.1)

---

## 22. Risks carried forward

1. **Twilio integration is new-stack territory** — first time wiring SMS into Lite. Unknown unknowns around Australian carrier compliance, delivery rates, number provisioning. Mitigation: small, isolated integration; fallback is email-only abandon cadence if Twilio onboarding blocks launch.
2. **Pixieset API capability risk** — the API may not fully support what the native gallery needs. Mitigation: documented fallback to gallery URL link-out with a still-premium launch CTA.
3. **Claude synthesis is load-bearing on retention** — a bad synthesis kills the reveal moment. Mitigation: §11.5 drift check + safe fallback + dedicated prompt iteration time in Phase 5.
4. **Self-persuasion questionnaire psychology is subtle** — a clumsy implementation can feel manipulative instead of genuine. Mitigation: content authoring is a dedicated mini-session with voice/visual skills loaded; Q1 safety valve is always the first screen; no manipulative patterns.
5. **Payment Element amount override vulnerability** — a malicious client could theoretically intercept and tamper with the amount. Mitigation: amount is server-computed at PaymentIntent creation from `intro_funnel_config.price_cents`, never accepted from the client. Webhook re-verifies on `payment_intent.succeeded`.
6. **Calendar race conditions** — two prospects grabbing the same slot. Mitigation: re-check availability inside the booking transaction; return 409 Conflict with fresh slots if raced.
7. **Refund automation failure** — Stripe refund call fails mid-cancel. Mitigation: urgent cockpit card + manual resolution; `intro_funnel_payments.status` stays at `succeeded` until refund actually confirms so we never show a false refund state.
8. **Funnel abandonment at the 15-min mark is aggressive** — customers who are genuinely mid-form will get an interruption if they click away and back quickly. Mitigation: "inactivity" is portal-activity based, not submission-time based; any click, any tab focus, resets the timer.
9. **Deliverables retention dependency on Pixieset** — if Andy lets a gallery expire, the portal breaks. Mitigation: fallback screen + notify-Andy affordance; v1.1 could add a "Pixieset gallery expiring soon" cockpit alert.
10. **Prospect session hijacking via magic link sharing** — magic links are long-lived; a forwarded link gives access. Mitigation: magic link expires after 90 days; sensitive actions (cancel, reschedule) are behind a re-verify step; payment is one-shot.

---

## 23. Sequencing within Phase 5

Rough estimate of Intro Funnel build sessions. Each is small enough to finish in one conversation with debugging headroom.

| Session | Scope |
|---|---|
| 1 | Schema + migrations (all new tables, additions to existing tables, activity_log/lost_reason enum extensions) |
| 2 | Settings → Products → Trial Shoot + Settings → Calendar wizards (config surfaces, no funnel logic yet) |
| 3 | Landing page scaffold + section 1 form (no personalisation yet, just the structural skeleton + form submit → Deal creation) |
| 4 | Portal shell + funnel_state machine + hourly cron (no questionnaire yet, just the state transitions) |
| 5 | Questionnaire surface (sections 2–4, shape-branched loader, answer persistence) — content lives in the follow-up authoring mini-session |
| 6 | Stripe Payment Element integration + payment webhook + `intro_funnel_paid` handling |
| 7 | Native calendar engine + booking action + reschedule action + customer-side manage-booking surface |
| 8 | Twilio integration (SMS send, webhook inbound, delivery status, DNC phone handling) |
| 9 | Abandon cadence dispatcher (15m SMS, 24h SMS+email, 3d email, demotion) |
| 10 | Pixieset integration + native gallery component + deliverables_ready transition |
| 11 | Reflection questionnaire + Claude synthesis prompt + synthesis reveal screen |
| 12 | Retainer-fit recommendation prompt + cockpit surfacing |
| 13 | SuperBad-initiated cancel/reschedule + apology email drafting |
| 14 | Landing page content authoring + polish (follows the content mini-session output) |
| 15 | End-to-end test harness — manufacture all the flows and corner cases |

Roughly 13–15 Phase 5 sessions for Intro Funnel. Biggest unknowns are sessions 8 (Twilio) and 10 (Pixieset API) — if either integration is harder than expected, that session splits.

Prerequisite: the Pipeline spec updates from §19.1 should land before or alongside session 1. Can be absorbed into session 1 directly.

---

## 24. What the follow-up content-authoring mini-session must produce

Separate from the build sessions above. This is a creative/authoring session using `superbad-brand-voice` + `superbad-visual-identity` skills.

- **Landing page copy** — opener, delight moment creative direction, value drop, "what happens", past work captions, quiet commitment, price copy, CTA
- **Section 1 form copy** — field labels, helper text, SMS opt-in copy, shape classification question wording
- **Questionnaire sections 2–4 — 3 shape variants × 3 sections = 9 question banks** (sections 2, 3, 4; section 1 is the landing-page form) with full question text, closed-list options, optional free-text prompts
- **Signal-tag taxonomy v1** — the closed list of tags + their definitions
- **Reflection questionnaire — 8 screens** with full question wording, closed-list options, safety-valve copy, synthesis reveal screen framing
- **Confirmation email copy** (post-payment) — brand-voice body, booking details templating
- **Apology email templates** — SuperBad-initiated cancel + reschedule variants
- **Landing page hero visual direction** + past work curation guidance
- **Upfront timeframe signposting (F2.a, 2026-04-13)** — copy lines for landing page ("what happens after the shoot"), payment-confirmation surface, booking-confirmation email, post-shoot portal "awaiting bundle" state. Sets the customer expectation that **photos and the six-week plan arrive together within ~7 days post-shoot**, framed as care (we're putting both into your hands at the same moment, not drip-feeding) rather than apology. The bundled-release rule in §15.1 only works narratively if this signposting is in place.
- **Bundled deliverables-ready announcement email** — single email covering both gallery and Six-Week Plan. Brand-voice body that introduces both artefacts and points to the portal. (Replaces the photos-only "your photos are ready" wording originally implied in §15.1.)

All copy committed to the codebase (no CMS). Andy reviews inline during the mini-session.

---

## 25. Honest reality check

**Is this spec doable?** Yes. Biggest unknowns are Twilio (new stack) and Pixieset API (unknown capability surface). Every other component — payment, calendar, questionnaire, portal — is well-trodden territory with clear patterns.

**What's genuinely hard:**
- Twilio integration wiring (new stack, carrier compliance)
- Pixieset API capability confirmation
- Claude synthesis prompt quality (iteration-heavy)
- Self-persuasion questionnaire authoring (creative load-bearing)
- Native calendar availability engine edge cases (races, timezones, business-day math)

**What's probably fine:**
- Stripe Payment Intents with dynamic amount (textbook)
- Single enforcement chokepoints (pattern from Lead Gen)
- State machine transitions (well-bounded)
- Funnel_state hourly cron (simple, testable)
- Portal personalisation (static render from submission row)
- Deal creation at section 1 (one touchpoint, one function)

**What's out of scope and tempting:**
- Multi-language support (v1.1+)
- A/B testing framework (v1.1+)
- In-portal chat (never in v1; v1.1+ if ever)
- Google Calendar sync (v1.1+)
- Push notifications to prospects' phones (never)
- CMS for landing page copy (never)
- Dynamic price per-prospect (v1.1+ if ever)
- Gift cards / promo codes (v1.1+ if ever)
- Multi-shoot packages (v1.1+ — Intro Funnel is single-shoot only)
- Customer account management (redirect to Client Management after Won, no self-service)

**Verdict:** green light. Architecture is sound, disciplines are named, failure modes are mapped, two integrations are isolated enough to fail gracefully. The content authoring mini-session is the biggest creative unknown and that's handled separately.

---

*End of Intro Funnel spec. Locked 2026-04-12.*
