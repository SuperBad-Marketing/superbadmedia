# `IF-1` — Intro Funnel: schema + landing page + questionnaire + Stripe Payment Element — Session Brief

> **Pre-compiled by LG-10 closing session per AUTONOMY_PROTOCOL.md §G11.b rolling cadence.**
> Read this file at the start of the session. **Do not read full spec files** — the excerpts inlined in §2 are the spec for this session.
> If a precondition below is missing from the repo, **stop** (G1) — do not build on a claim a prior handoff made.
> If §1's G0.5 input budget estimate exceeds 35k tokens, **stop** — split the session or trim references before proceeding.

> **Wave 14 brief gap note (LG-10 G3 escape hatch):** LG-10 wrote this brief only (IF-1). Briefs for IF-2, IF-3, IF-4, and IF-E2E are **NOT yet written**. Before starting IF-1's own work, the IF-1 session must write briefs for IF-2 through IF-E2E using `sessions/_brief-template.md` + `BUILD_PLAN.md` Wave 14 + `docs/specs/intro-funnel.md`. This is IF-1's first action (G11.b mop-up rule — §"Mop-up rule").

---

## 1. Identity

- **Session id:** `IF-1`
- **Wave:** `14 — Intro Funnel` (1 of 5)
- **Type:** `FEATURE` (schema + server logic + payment integration — no client UI this session)
- **Model tier:** `/deep` (Opus) — schema design + createDealFromLead integration + Stripe Payment Intent flow. Complex multi-table transaction.
- **Sonnet-safe:** `no`
- **Estimated context:** `large`
- **G0.5 input budget estimate:** ~30k tokens (brief + spec excerpts + 2 handoffs + skills). Under 35k. Watch for drift — this is a large-context spec.

> **Note on session scope:** BUILD_PLAN marks IF-1 as "large" covering landing page + questionnaire UI + Stripe Payment Element + `createDealFromLead()` + `ensureStripeCustomer()`. Given the complexity, IF-1 **may need to be split** into IF-1a (schema + server primitives) and IF-1b (UI + payment surface) at the IF-1 session's discretion per G3. If split is needed, write interim handoff + IF-1b brief before stopping. The priority is the schema and server primitives — the UI layer is secondary.

---

## 2. Spec excerpts

### Excerpt 1 — New tables §4.1 (key fields only)

Source: `docs/specs/intro-funnel.md` §4.1

```
intro_funnel_submissions — one row per prospect who submits section 1
  id: text (PK, nanoid)
  token: text NOT NULL UNIQUE  // public URL slug for /lite/intro/[token]
  deal_id: text NOT NULL → deals.id
  contact_id: text NOT NULL → contacts.id
  submitted_name, submitted_business_name, submitted_email, submitted_phone: text NOT NULL
  sms_opt_in: boolean default true
  shape: enum solo_founder|founder_led_team|multi_stakeholder_company NOT NULL
  funnel_state: enum contact_submitted|questionnaire_in_progress|questionnaire_complete|
    paid|shoot_booked|shoot_approaching|shoot_morning_of|
    shoot_completed_awaiting_deliverables|deliverables_ready|reflection_complete|
    portal_dormant|portal_archived_migrated  default contact_submitted
  questionnaire_answers_json: json
  questionnaire_sections_completed: int default 0
  signal_tags_json: json
  abandon_sequence_state: enum pending|t_15m_sent|t_24h_sent|t_3d_sent|demoted|not_applicable default pending
  last_activity_at: timestamp NOT NULL
  gallery_ready_at, plan_ready_at, deliverables_ready_at, bundled_hub_seen_at: timestamp nullable
  created_at, updated_at: timestamp NOT NULL

intro_funnel_bookings — per-submission shoot booking row
  id: text PK
  submission_id → intro_funnel_submissions.id
  scheduled_at: timestamp NOT NULL (UTC)
  duration_min: int NOT NULL default 60
  booking_state: enum pending|confirmed|rescheduled|cancelled|no_show|completed default pending
  reschedule_count: int default 0
  notes: text nullable
  shoot_day_notes_json: json nullable  // added post-shoot
  created_at, cancelled_at: timestamp

intro_funnel_reflections — post-shoot questionnaire answers
  id: text PK
  submission_id → intro_funnel_submissions.id
  answers_json: json NOT NULL
  completed_at: timestamp NOT NULL
```

### Excerpt 2 — Section 1 submit flow §3 steps 2–3

Source: `docs/specs/intro-funnel.md` §3

```
2. Section 1 (contact). Fields: name, business name, email, phone, SMS opt-in (checked by default),
   plus shape-classification question. On submit:
   - createDealFromLead(source: 'intro_funnel_contact_submitted') at Trial Shoot stage
     with funnel_state: 'contact_submitted'. Contact dedupe applies per Sales Pipeline §10.4.
   - Stripe PaymentIntent created with amount from settings.get('trial_shoot.price').
   - intro_funnel_submissions row inserted (token = nanoid()).
   - Magic link (OTT) emailed to submitted_email.
   - activity_log: intro_funnel_started.
   - Redirect to /lite/intro/[token] (portal-contact-only state).

3. Portal — contact-only state. Personalised welcome. Shows sections 2–4 questionnaire
   remaining (progress indicator), a pre-filled placeholder for "Pay now & book your shoot"
   card (visible but disabled until questionnaire complete), and a "what to expect" section.
```

### Excerpt 3 — Payment and deal promotion §5.2

Source: `docs/specs/intro-funnel.md` §5.2

```
Deal promotion timing: Deal is created at section 1 submit (not at payment). Payment success:
- Stripe PaymentIntent confirmed.
- funnel_state → 'paid'.
- activity_log: intro_funnel_paid.
- ensureStripeCustomer(contact_id) — stamps stripe_customer_id on contact row.
- Email confirmation sent.
Stripe Payment Element is mounted at questionnaire-complete state with the dynamic
trial_shoot.price amount. If payment fails, portal shows inline error (Stripe's own
error message). No retry limit in v1.
```

### Excerpt 4 — Routes §6.1–6.2

Source: `docs/specs/intro-funnel.md` §6

```
Public (no auth):
  GET /lite/intro             — landing page
  POST /lite/intro/contact    — section 1 submit (server action or route handler)

Prospect-authenticated (magic-link session):
  GET /lite/intro/[token]     — prospect portal (all states after section 1)
  POST /lite/intro/[token]/questionnaire  — section answer submit
  POST /lite/intro/[token]/pay            — Stripe Payment Intent confirm
```

### Excerpt 5 — Settings keys §BUILD_PLAN Wave 14

```
trial_shoot.price — integer (cents) — price of the trial shoot (e.g. 29700 for $297)
intro_funnel.reflection_delay_hours_after_deliverables — integer default 24
```

**Audit footer:**
- `docs/specs/intro-funnel.md` §4.1 — full schema
- `docs/specs/intro-funnel.md` §3 — full user journey
- `docs/specs/intro-funnel.md` §5.2 — candidate→deal promotion + payment timing
- `docs/specs/intro-funnel.md` §6 — full routes

---

## 2a. Visual references (UI type — N/A for FEATURE type)

N/A — IF-1 is FEATURE type (schema + server primitives). Landing page UI lands in IF-1b (if split) or in the UI portion of the same session. When the UI phase starts, load `docs/superbad_brand_guidelines.html` and `docs/superbad_voice_profile.html` as minimums. A landing-page-specific mockup does not yet exist — the session may stub `mockup-intro-landing.html` extending the brand guidelines.

---

## 3. Acceptance criteria

```
IF-1 is done when:

1. lib/db/schema/intro-funnel-submissions.ts exports:
   - introFunnelSubmissions table with all columns per §4.1 excerpt
   - FUNNEL_STATE_VALUES const
   - ABANDON_SEQUENCE_STATE_VALUES const
   - IntroFunnelSubmissionRow, IntroFunnelSubmissionInsert types

2. lib/db/schema/intro-funnel-bookings.ts exports introFunnelBookings table

3. lib/db/schema/intro-funnel-reflections.ts exports introFunnelReflections table

4. Migration file at lib/db/migrations/*.sql creating the 3 tables (drizzle-kit generate)

5. Settings seeded:
   - trial_shoot.price (integer, default 29700) in docs/settings-registry.md + A5 seed migration
   - intro_funnel.reflection_delay_hours_after_deliverables already exists in registry

6. lib/intro-funnel/index.ts exports:
   - submitSection1(data): creates deal via createDealFromLead(), inserts submission row,
     returns { ok, token, error? }
   - Gated behind intro_funnel_enabled kill-switch (add to lib/kill-switches.ts)

7. GET /lite/intro renders — landing page with:
   - Section 1 form (name, business name, email, phone, SMS opt-in, shape question)
   - Hero copy (brand voice)
   - Server action for form submit

8. GET /lite/intro/[token] renders — contact-only portal state (skeleton acceptable for IF-1)
   with personalised welcome + "questionnaire in progress" indicator

9. Payment Element surface:
   - createPaymentIntent(submissionId) server action creates Stripe PaymentIntent
     with amount from settings.get('trial_shoot.price')
   - Stripe Payment Element rendered in portal at questionnaire-complete state
   - confirmPayment action: confirms intent, sets funnel_state → 'paid',
     calls ensureStripeCustomer(), writes activity_log intro_funnel_paid

10. npx tsc --noEmit → 0 errors
11. npm test → green
12. npm run build → clean
13. npm run lint → clean
14. G10: dev server walk — /lite/intro renders landing, form submits, portal skeleton renders
15. G10.5: external reviewer verdict PASS or PASS_WITH_NOTES
```

---

## 4. Skill whitelist

- `drizzle-orm` — schema creation + migration
- `stripe` — PaymentIntent creation, Payment Element integration
- `nextauth` — magic-link session check for /lite/intro/[token]
- `tailwind-v4` — landing + portal surface styling
- `framer-motion` — section 1 form reveal, portal animations

---

## 5. File whitelist

- `lib/db/schema/intro-funnel-submissions.ts` — new
- `lib/db/schema/intro-funnel-bookings.ts` — new
- `lib/db/schema/intro-funnel-reflections.ts` — new
- `lib/db/migrations/*.sql` — new (generated by drizzle-kit)
- `lib/db/schema/index.ts` — edit (add new schemas to barrel if needed)
- `lib/intro-funnel/index.ts` — new — submitSection1()
- `lib/kill-switches.ts` — edit — add intro_funnel_enabled
- `app/lite/intro/page.tsx` — new — landing page
- `app/lite/intro/[token]/page.tsx` — new — prospect portal
- `app/lite/intro/[token]/actions.ts` — new — submitSection1 + createPaymentIntent + confirmPayment
- `docs/settings-registry.md` — edit — seed trial_shoot.price
- `lib/db/migrations/seed-A5.ts` — edit — add trial_shoot.price seed (if applicable)
- `tests/intro-funnel/if1-schema.test.ts` — new
- `tests/intro-funnel/if1-submit-section1.test.ts` — new

---

## 6. Settings keys touched

- **Reads:** `trial_shoot.price`, `intro_funnel.reflection_delay_hours_after_deliverables`
- **Seeds (new):** `trial_shoot.price` — `29700` (integer, cents) — price of the $297 trial shoot. Must be added to `docs/settings-registry.md` + A5 seed migration.

---

## 7. Preconditions (G1)

- [ ] `lib/crm/create-deal-from-lead.ts` exports `createDealFromLead` — verify: `grep "export function createDealFromLead" lib/crm/create-deal-from-lead.ts`
- [ ] `lib/stripe/customer.ts` exports `ensureStripeCustomer` — verify: `grep "export async function ensureStripeCustomer" lib/stripe/customer.ts`
- [ ] `lib/kill-switches.ts` does NOT yet have `intro_funnel_enabled` — verify: `grep "intro_funnel_enabled" lib/kill-switches.ts` (expect no match)
- [ ] `intro_funnel.reflection_delay_hours_after_deliverables` already in settings registry — verify: `grep "reflection_delay" docs/settings-registry.md`
- [ ] `trial_shoot.price` NOT yet in settings registry — verify: `grep "trial_shoot.price" docs/settings-registry.md` (expect no match — session seeds it)
- [ ] `deals` table exists — verify: `grep "export const deals" lib/db/schema/deals.ts`
- [ ] `contacts` table exists — verify: `grep "export const contacts" lib/db/schema/contacts.ts`
- [ ] `npx tsc --noEmit` passes before starting

---

## 8. Rollback strategy (G6)

- [x] `migration reversible` — 3 new tables only; down-migration drops them. No existing schema changes.

---

## 9. Definition of done

- [ ] 3 schema files exist and export their tables
- [ ] Migration file generated and clean
- [ ] `trial_shoot.price` in settings registry + seed migration
- [ ] `intro_funnel_enabled` in `lib/kill-switches.ts`
- [ ] `submitSection1()` in `lib/intro-funnel/index.ts`
- [ ] GET `/lite/intro` renders without error
- [ ] GET `/lite/intro/[token]` renders without error
- [ ] Payment Element mounted at questionnaire-complete state
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → green
- [ ] `npm run build` → clean
- [ ] `npm run lint` → clean
- [ ] G10: dev server walk
- [ ] G10.5: reviewer verdict PASS or PASS_WITH_NOTES

---

## 10. Notes for IF-1 session (wave brief gap + next briefs)

**FIRST ACTION for IF-1:** Write briefs for IF-2, IF-3, IF-4, IF-E2E before starting own work. Read `BUILD_PLAN.md` Wave 14, `docs/specs/intro-funnel.md`, and `sessions/_brief-template.md`. Commit the 4 briefs before touching code.

**Wave 14 context:**
- IF-2: Calendar booking + confirmation + shoot-day portal view + Pixieset link-out
- IF-3: Retainer/SaaS offer + synthesis Opus (reads Brand DNA) + quote recommendation
- IF-4: Portal-guard recovery (A8) + OTT magic-link embedding
- IF-E2E: Playwright E2E critical flow — landing → questionnaire → booking → payment

**Key interfaces IF-1 must leave clean for downstream sessions:**
- `submitSection1()` return type must include `{ ok, token, submissionId }`
- `intro_funnel_enabled` kill-switch must gate all server-side mutations
- `intro_funnel_submissions` schema must include all columns upfront (avoid retroactive migrations)
- Magic-link session approach: use existing A8 OTT primitive (check `lib/portal-guard/` for pattern)
