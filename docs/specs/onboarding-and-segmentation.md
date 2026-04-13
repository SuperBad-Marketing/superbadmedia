# Spec — Onboarding + Revenue Segmentation

**Phase 3 spec. Locked 2026-04-12.**

The wrapper experience that composes Brand DNA Assessment, Revenue Segmentation, setup wizards, and SaaS product config into audience-specific onboarding flows. Retainer onboarding is premium and deep. SaaS onboarding is standardised and quality-first. Both converge on the same data quality — every client in Lite has a complete Brand DNA profile, no second-class records.

Governing memories: `feedback_onboarding_multiple_entry_paths.md`, `project_brand_dna_as_perpetual_context.md`, `project_two_perpetual_contexts.md`, `feedback_no_lite_on_client_facing.md`, `feedback_individual_feel.md`, `feedback_pre_populated_trial_experience.md`, `feedback_setup_is_hand_held.md`, `feedback_primary_action_focus.md`.

**All client-facing surfaces say "SuperBad", never "SuperBad Lite."** Lite is the internal/admin platform name. Clients interact with SuperBad.

---

## 1. The 34 locks (quick-reference table)

| # | Decision | Lock |
|---|---|---|
| 1 | Retainer onboarding trigger | Quote acceptance via Quote Builder auto-transitions deal to Won, which auto-triggers onboarding. No manual step. |
| 2 | Retainer welcome experience | Branded welcome screen before Brand DNA — name, dry line, step preview, Claude-generated "what we already know" summary from deal context. |
| 3 | Revenue Segmentation audience | SaaS-only. Retainer clients do not complete Revenue Segmentation — they're already in a direct relationship. |
| 4 | Retainer onboarding structure | Brand DNA is its own sitting. Practical setup (contacts, ad accounts, content archive) is a separate return-when-ready portal section. |
| 5a | Rev Seg Q1: Monthly revenue | 5 ranges: Under $250K / $250K–$500K / $500K–$1M / $1M–$3M / $3M+ |
| 5b | Rev Seg Q2: Team size | 5 options: Just me / 2–5 / 6–15 / 16–50 / 50+ |
| 5c | Rev Seg Q3: Biggest constraint | 6 options (hybrid, plain-spoken): "Not enough of the right customers" / "No time to do marketing properly" / "Don't know what's working and what's not" / "Brand doesn't reflect who we actually are" / "Tried agencies/freelancers, got burned" / "We're growing but marketing hasn't kept up" |
| 5d | Rev Seg Q4: 12-month goal | 5 options: "Keep things ticking over" / "Grow — more of the right customers" / "Scale — double down and push hard" / "Launch something new alongside what we've got" / "Honestly, figure out what's next" |
| 5e | Rev Seg Q5: Industry vertical | 8 broad neutral categories + Other with free-text: Health & wellness / Professional services / Trades & construction / Hospitality & food / Education / Retail / Creative & media / Other: ___ |
| 6 | SaaS onboarding order | Brand DNA first, right after payment. Quality over convenience. Full sequence: Payment → Brand DNA → Revenue Segmentation → product config → product unlocked. |
| 7 | Brand DNA nudge surface purpose | Retake prompting, not first-time completion. Brand DNA is a hard gate — every Subscriber completes it before product access. Nudge becomes "It's been a while — has anything changed?" |
| 8 | SaaS product config shape | Each product implements an interface contract + UX constraints. Products own the content, onboarding owns the frame. |
| 9 | Retainer entry paths | All retainer clients enter via quote acceptance. Direct sales, referrals, and any other path go through Quote Builder first. One trigger, one flow. |
| 10 | Legacy migration | None. No migration tooling. Existing clients re-onboard through the same flow as new clients. GHL subscriptions cancelled manually once confirmed in Lite. |
| 11 | Retainer welcome screen content | Name + dry SuperBad-voice welcome line + "here's what's about to happen" step preview + Claude-generated "what we already know about you" summary from deal notes and quote context. |
| 12 | SaaS welcome screen content | Name + dry welcome line + step preview (time expectations: "~30 min for Brand DNA, then a quick setup"). No pre-populated summary — not enough context depth for cold signups. |
| 13 | Brand DNA hard gate — abandoned state | Resume screen: "Welcome back. You're X% through. Pick up where you left off." No product access, no escape hatch, no visible-but-locked dashboard tease. |
| 14 | Upsell targeting signals | Structured Revenue Segmentation data + product engagement (login frequency, feature usage depth, time-in-product). Two inputs, one targeting layer. |
| 15 | Retainer practical setup steps | Three steps: (1) Primary contact details, (2) Ad account access grants (Meta Business Manager, Google Ads — step-by-step wizard per platform), (3) Content archive links (Google Drive, Dropbox, etc.). Billing data already captured during sales process. |
| 16 | Practical setup nudge cadence | 24h, 72h, then weekly until complete. |
| 17 | Product config interface contract | Two components (`productConfig`, `firstRunView`) + metadata object (`name`, `description`, `configStepCount`, `estimatedConfigTime`). UX constraints: setup wizard format, under 5 min, clear "done" state. |
| 18 | Onboarding progress tracking | Derived from constituent primitives (Brand DNA status, Rev Seg completion, setup wizard step states, product config done flag). No dedicated onboarding state table. |
| 19 | Upsell filter surfaces | Cockpit for new-candidate alerts ("just crossed the threshold"), pipeline for the persistent working filter. |
| 20 | Upsell threshold model | Two-tier: Warm (revenue $500K+ OR high engagement) and Hot (revenue $500K+ AND high engagement AND goal alignment). Both require Victoria, Australia location — configurable for future expansion. Warm shows on pipeline filter. Hot shows on cockpit. |
| 21 | SaaS location capture | Profile field at signup (alongside name, email, business name). Not a segmentation question. |
| 22 | Retainer location source | Pipeline field on the company record — already known from the sales process. |
| 23 | Onboarding portal URL | Token-based first visit at `/portal/[token]`. Token authenticates for onboarding. Credentials created at the end (magic link email confirmation). Subsequent visits use normal auth at `/portal`. |
| 24 | Auth method | Magic link only. No passwords. Credential creation step = "Confirm your email address — this is how you'll log in." One field, one confirmation email. |
| 25 | Welcome email sender | SuperBad as sender. Product name in subject and body for SaaS. One sender identity across all onboarding emails. |
| 26 | Retainer welcome email | Claude-drafted from deal context. Personalised opening referencing something specific from the sales conversation. Portal link + time expectations. Drift-checked before send. |
| 27 | SaaS welcome email | Same Claude-drafted approach, graceful degradation. Rich context if outreach-sourced, basic context (name, product, location, industry) if cold signup. Same pipeline, different context depth. |
| 28 | Retainer non-start nudge | 24h automated email nudge, then cockpit flag for Andy. One reminder is helpful; after that it's a relationship call. |
| 29 | SaaS non-start nudge | 24h, 72h, weekly. Automated chasing at scale. Cockpit shows aggregate count of stalled SaaS onboardings. |
| 30 | Voice & delight | Welcome email first line + client portal footer claimed from sprinkle bank. Full hidden-egg suppression on all onboarding surfaces. |
| 31 | Revenue Segmentation storage | 5 columns directly on the `companies` table. No separate table, no JSON blob. |
| 32 | Company record for SaaS | Auto-create a company record for every SaaS signup, even solo operators. Revenue Segmentation always lives on `companies`. |
| 33 | Location storage | `location` field on `companies`. Single source for the upsell filter's geography gate. |
| 34 | Product config contract (full) | Two components (`productConfig` receiving company record with Brand DNA + Rev Seg, returning `configComplete` signal; `firstRunView` for the first product moment) + metadata object. |

### 1.1 Setup wizard shell reference (added 2026-04-13 Phase 3.5)

This entire onboarding flow renders through the `WizardDefinition` primitive owned by [setup-wizards.md](./setup-wizards.md) §5.3. Wizard key: **`onboarding-segmentation`**. Render mode: **dedicated route** (capstone client-facing onboarding, not a slideover). This spec owns the step content (welcome → segmentation → practical setup → profile complete), copy, and completion payload. Shell chrome (progress bar, resume, cancel, celebration, Observatory integration) lives in the primitive.

---

## 2. End-to-end journeys

### 2.1 Retainer client onboarding

**Trigger:** Quote accepted via Quote Builder Payment Element → deal auto-transitions to `Won` with `won_outcome = 'retainer'` → onboarding fires automatically.

**Step 1 — Welcome email (immediate):**
Claude-drafted from deal context (notes, quote details, sales conversation history). Personalised opening referencing something specific about the client. Link to onboarding portal. Time expectation: "You'll start with something that takes about 30 minutes — it's the best 30 minutes you'll spend on your brand this year." Sent from SuperBad, drift-checked via `generateInVoice()` + brand-voice drift check. Reads both Brand DNA (SuperBad's own profile) and Client Context Engine summary for the client.

**Step 2 — Welcome screen (`/portal/[token]`):**
- Client's name (prominent)
- One dry SuperBad-voice welcome line
- "Here's what's about to happen" — plain-English step preview with time estimates
- "What we already know about you" — Claude-generated summary from deal notes, quote context, and any outreach research. Not a data dump — a warm, observant paragraph that makes them feel known before the assessment starts.
- Single CTA: "Let's get started"

**Step 3 — Brand DNA Assessment:**
Full assessment per `docs/specs/brand-dna-assessment.md`. ~30 minutes. 5 sections, shape-aware, cinematic reveal at the end. Hard gate — must complete before proceeding.

**Step 4 — Assessment complete. Onboarding sitting ends.**
After the Brand DNA reveal, the experience breathes. The client is not immediately funnelled into admin tasks. The portal shows a clear "Practical setup" section marked as incomplete, with a friendly note: "Whenever you're ready — a few quick things to get us set up."

**Step 5 — Practical setup (return-when-ready):**
Three setup wizard steps, completable in any order:
1. **Contact details** — primary contacts for the business (names, emails, phone numbers for key people)
2. **Ad account access** — step-by-step wizard per platform (Meta Business Manager, Google Ads). Hand-held, never self-served.
3. **Content archive** — links to existing asset storage (Google Drive, Dropbox, etc.)

**Step 6 — Credential creation:**
Final step of onboarding. "Confirm your email address — this is how you'll log in." Client confirms their email, system sends a magic link, first authenticated login. Token-based access expires.

**Nudge cadence:**
- If Brand DNA not started: 24h automated email nudge → cockpit flag for Andy.
- If practical setup incomplete: 24h → 72h → weekly automated email reminders.
- Cockpit shows incomplete onboarding status on the client's record throughout.

### 2.2 Subscriber onboarding

**Trigger:** Stripe Payment Element success on any SaaS product signup.

**Step 1 — Company record auto-created.**
System creates a `companies` record (even for solo operators). Location captured from signup form.

**Step 2 — Welcome email (immediate):**
Claude-drafted with graceful degradation. If outreach-sourced: rich personalisation from research data. If cold signup: works with name, product name, location, industry. Sent from SuperBad with product name in subject and body. Drift-checked. Link to onboarding portal.

**Step 3 — Welcome screen (`/portal/[token]`):**
- Customer's name
- Dry welcome line
- Step preview with time expectations: "First up: getting to know you properly (~30 min). Then a quick [product name] setup, and you're in."
- No pre-populated summary (insufficient context depth for cold signups)
- Single CTA: "Let's get started"

**Step 4 — Brand DNA Assessment:**
Same assessment as retainer clients. Hard gate. If abandoned mid-assessment, subsequent visits show the resume screen: "Welcome back. You're X% through. Pick up where you left off." No product access until complete.

**Step 5 — Revenue Segmentation (~2 min):**
5 MC questions, presented as a short questionnaire immediately after Brand DNA reveal settles:
1. Monthly revenue range
2. Team size
3. Biggest current constraint
4. 12-month goal
5. Industry vertical

Stored as columns on the `companies` record.

**Step 6 — Product config:**
Product-specific setup wizard per the interface contract. Receives company record (including Brand DNA profile and Revenue Segmentation data). Setup wizard format, under 5 minutes, consistent with onboarding styling.

**Step 7 — Credential creation:**
Same as retainer: confirm email, magic link, first authenticated login.

**Step 8 — Product unlocked → `firstRunView`:**
Product's first-run component renders. Pre-populated where outreach data exists (per `feedback_pre_populated_trial_experience` memory). This is the product's moment to show value immediately.

**Nudge cadence:**
- If onboarding not started: 24h → 72h → weekly automated emails.
- If abandoned mid-Brand-DNA: same cadence, email references their progress ("You're 40% through — pick up where you left off").
- Cockpit shows aggregate count of stalled SaaS onboardings.

### 2.3 Entry path convergence

All retainer clients enter via quote acceptance. There is no alternative trigger. Direct sales, referrals, word-of-mouth — all go through Quote Builder first. This means:
- Every retainer client has pricing data in the system before onboarding starts.
- The welcome email always has quote context to reference.
- The "what we already know" summary always has material to work with.
- No legacy migration path. Existing GHL clients re-onboard through the same flow.

Subscribers enter via Stripe payment on product signup. One trigger per product.

---

## 3. Revenue Segmentation primitive

### 3.1 Purpose

Structured short questionnaire capturing business-stage data for upsell targeting. SaaS-only — retainer clients do not complete it.

### 3.2 Questions (5, all single-select MC)

**Q1 — Monthly revenue**
- Under $250K
- $250K–$500K
- $500K–$1M
- $1M–$3M
- $3M+

**Q2 — Team size**
- Just me
- 2–5
- 6–15
- 16–50
- 50+

**Q3 — Biggest current constraint**
- "Not enough of the right customers"
- "No time to do marketing properly"
- "Don't know what's working and what's not"
- "Brand doesn't reflect who we actually are"
- "Tried agencies/freelancers, got burned"
- "We're growing but marketing hasn't kept up"

**Q4 — 12-month goal**
- "Keep things ticking over"
- "Grow — more of the right customers"
- "Scale — double down and push hard"
- "Launch something new alongside what we've got"
- "Honestly, figure out what's next"

**Q5 — Industry**
- Health & wellness
- Professional services
- Trades & construction
- Hospitality & food
- Education
- Retail
- Creative & media
- Other: [free text]

### 3.3 Presentation

Rendered as a single-page questionnaire immediately after Brand DNA reveal settles. Card-per-question layout consistent with Brand DNA's visual language but lighter — no ambient visual evolution, no between-question transitions. Progress indicator showing 5 of 5. Submit button at the bottom.

Copy frame: "Five quick questions about where your business is right now. Takes about two minutes."

### 3.4 Reuse

The Revenue Segmentation primitive is designed to plug into any future onboarding flow (lead qualification, event signups, partner onboarding) without rewrite. The questions, storage, and rendering are decoupled from the SaaS onboarding wrapper.

---

## 4. Upsell targeting layer

### 4.1 Two-tier model

**Warm** — any ONE of:
- Revenue range is $500K–$1M, $1M–$3M, or $3M+
- High product engagement: logged in 10+ of last 14 days

**Hot** — ALL of:
- Revenue range is $500K–$1M, $1M–$3M, or $3M+
- High product engagement: logged in 10+ of last 14 days AND used 3+ distinct features in last 7 days
- Goal alignment: 12-month goal is "Scale" or "Launch something new"

**Both tiers require:** `companies.location` = Victoria, Australia. This is a configurable gate — expand to other states/regions as the business grows geographically.

### 4.2 Surfaces

- **Daily Cockpit:** alerts when a Subscriber newly crosses the Hot threshold. Phrased as attention, not a to-do: "[Company name] just hit hot — $1M+ revenue, daily user, wants to scale." Aggregated count of total Warm and Hot Subscribers in the cockpit's SaaS health section.
- **Sales Pipeline:** standing "Upsell candidates" filter showing all Warm and Hot Subscribers. Sortable by tier, revenue, engagement. Andy browses this when he's in prospecting mode.

### 4.3 Signal inputs

**Structured data (from Revenue Segmentation):**
- `companies.revenue_range`
- `companies.twelve_month_goal`
- `companies.location`

**Product engagement (behavioural):**
- Login frequency (count of distinct login days in last 14 days)
- Feature usage breadth (count of distinct features used in last 7 days)
- Time-in-product (session duration, secondary signal — not used in v1 threshold but tracked for future refinement)

### 4.4 Brand DNA retake as engagement signal

Brand DNA completion is no longer a differentiating signal (mandatory for all Subscribers). However, a **retake** is a strong voluntary engagement signal — the Subscriber is investing another 30 minutes to refine their profile. Retakes surface as a bonus signal on the cockpit: "[Company name] just retook their Brand DNA assessment." Not factored into Warm/Hot thresholds in v1, but visible to Andy as qualitative intelligence.

---

## 5. Product config interface contract

### 5.1 Metadata object

Every SaaS product declares:
```
{
  name: string              // e.g. "ContentEngine"
  description: string       // one-line plain-English description
  configStepCount: number   // e.g. 3
  estimatedConfigTime: string // e.g. "about 3 minutes"
}
```

The onboarding orchestrator reads this metadata to render accurate step previews on the welcome screen and in nudge emails ("then a quick 3-step setup for ContentEngine").

### 5.2 `productConfig` component

- **Receives:** company record (including Brand DNA profile, Revenue Segmentation data, any outreach research data)
- **Format:** setup wizard. Step-by-step, not a settings page. Back/next navigation. Progress indication. Consistent with practical setup styling.
- **Constraint:** must complete in under 5 minutes. If a product's config is more complex, break it into "essential config" (onboarding) and "advanced config" (in-product settings).
- **Returns:** `configComplete` signal to the onboarding orchestrator.

### 5.3 `firstRunView` component

- **Receives:** company record + product config data
- **Purpose:** the customer's first moment inside the unlocked product. Must show value immediately — pre-populated where outreach data exists, personalised via Brand DNA profile.
- **No constraints on format** — this is the product's moment. The onboarding orchestrator hands off completely.

### 5.4 UX constraints (apply to `productConfig` only)

1. Setup wizard format — one step at a time, not a form dump.
2. Consistent with the onboarding visual language (same component library, same transitions).
3. Clear terminal "done" state that signals the orchestrator.
4. Under 5 minutes total.
5. Hand-held, never self-served — each step has a short written instruction in SuperBad voice.

---

## 6. Onboarding portal and auth

### 6.1 URL structure

- **First visit:** `/portal/[token]` — token-based access from the welcome email. No login required. The token authenticates the session for the duration of onboarding.
- **Credential creation:** final onboarding step. Client confirms their email address. System sends a magic link. First authenticated login via magic link.
- **Subsequent visits:** `/portal` — standard Auth.js magic link authentication.

Token expires after credential creation. If a client revisits `/portal/[token]` after creating credentials, redirect to `/portal` with standard auth.

### 6.2 Token security

- Tokens are single-use for initial authentication, but the session persists until onboarding completes or the browser closes.
- Tokens expire after 30 days if never used.
- Each token is scoped to one client/customer — no reuse, no sharing.

### 6.3 Auth method

Magic link only via Auth.js v5. No passwords. The credential creation step is: "Confirm your email address — this is how you'll log in." One input field, one confirmation email, one click. Done.

---

## 7. Welcome emails

### 7.1 Retainer welcome email

**Trigger:** quote acceptance (immediate).
**Sender:** SuperBad (`hi@superbadmedia.com.au` or similar — the primary domain sender, not the cold-outreach subdomain).
**Content:**
- Claude-drafted personalised opening referencing something specific from the deal context (sales notes, quote details, conversation history).
- Portal link with token.
- Time expectation for Brand DNA ("about 30 minutes — it's the best 30 minutes you'll spend on your brand this year" or similar in-voice).
- Brief preview of what comes after Brand DNA.
- Drift-checked via brand-voice drift check before send.

**Claude prompt inputs:** SuperBad's own Brand DNA profile + Client Context Engine summary for this client + deal notes + quote context.

**Classification:** `transactional` (bypasses §11.4 quiet window).

### 7.2 SaaS welcome email

**Trigger:** Stripe payment success (immediate).
**Sender:** SuperBad.
**Subject:** includes product name — "Welcome to [Product Name]".
**Content:**
- Claude-drafted with graceful degradation:
  - **Outreach-sourced customer:** personalised from research data — references their industry, something specific about their business.
  - **Cold signup:** works with name, product name, location, industry from signup form. Still individual, not a template.
- Portal link with token.
- Time expectation for Brand DNA + product setup.
- Drift-checked.

**Claude prompt inputs:** SuperBad's own Brand DNA profile + whatever contact/company data exists (outreach research if available, signup fields if not).

**Classification:** `transactional`.

### 7.3 Non-start nudge emails

**Retainer:** one nudge at 24h. Tone: warm reminder, not a chase. After that, cockpit flag for Andy — personal follow-up territory.

**SaaS:** 24h → 72h → weekly. Tone: helpful, references progress if they started ("you're 40% through Brand DNA"). Never guilt. Never "your subscription is active but you haven't started."

**All nudge emails:** `transactional` classification. Sent from SuperBad. Drift-checked.

### 7.4 Practical setup reminders (retainer only)

24h → 72h → weekly until all three steps complete. Per-step targeting — only remind about the steps that are actually incomplete. Tone: brief, specific, helpful. "Quick one — we still need your Meta Business Manager access to get your ads set up. Takes about 2 minutes: [link]."

**Classification:** `transactional`.

---

## 8. Welcome screen

### 8.1 Retainer welcome screen

**Entry-path branch (F4.c, 2026-04-13 Phase 3.5 Step 11 Stage 4).** The welcome screen runs for **direct/referral retainer entrants only**. Trial-shoot graduates bypass this surface entirely — their portal experience is continuous (pre-retainer → retainer) and a fresh "welcome to SuperBad" interstitial breaks the lived continuity per `feedback_felt_experience_wins`. Their retainer transition is fully handled by `docs/specs/client-management.md` §10 Retainer kickoff transition (Brand DNA gate → bartender-led kickoff, F4.b).

**Detection.** Trial-shoot graduate = a row exists in `intro_funnel_submissions` for this contact's company. Direct/referral = no such row. The first render of `/portal/[token]` after `deals.stage = 'won'` evaluates this at render time:

- **Trial-shoot graduate:** redirect directly to the retainer portal in `/portal/[token]` chat-home surface. F4.b's Brand DNA gate + bartender kickoff fire as specified in Client Management §10.
- **Direct/referral:** render §8.1 welcome screen below.

Both paths converge on Brand DNA as the first active client task. Both respect the same §10 Brand DNA portal gate (pre-assessment lock). The branch is a surface difference only, not a data-model or state-machine difference.

**URL (direct/referral path):** `/portal/[token]` (first visit, before Brand DNA).

**Content:**
1. Client's name — large, prominent.
2. One dry SuperBad-voice line — Claude-generated via `generateInVoice('onboarding_welcome_retainer', context)`. Admin-roommate register. Not a pitch, not a celebration — a greeting.
3. **"What we already know about you"** — Claude-generated summary paragraph from deal notes, quote context, outreach research (if any). Warm, observant, specific. Not a data dump. Generated via Opus with SuperBad Brand DNA + client context as inputs. Reads the client doc source hierarchy: client-supplied docs > direct answers > owned web > scrapes > LLM inference. The summary prompt reads from direct/referral context sources only — trial-shoot artefacts (shoot-day notes, six-week plan, reflection) are not in scope for this prompt because trial-shoot graduates never reach this surface.
4. **Step preview:**
   - "First: getting to know you properly. This is the good part. (~30 minutes)"
   - "Then: a bit of practical admin you can do whenever. (~10 minutes)"
5. Single CTA button: "Let's get started" → Brand DNA Assessment.

**One-shot.** New column `contacts.onboarding_welcome_seen_at timestamp nullable` — set on first render, used to prevent the welcome screen re-appearing on later logins (subsequent direct/referral logins go straight to chat-home / Brand DNA gate per normal retainer flow).

**Design:** premium feel consistent with Brand DNA's visual language. This is the gateway to the flagship experience — it must match that bar. Full-bleed, minimal UI, name and text as the hero elements.

### 8.2 SaaS welcome screen

**URL:** `/portal/[token]` (first visit, before Brand DNA).

**Content:**
1. Customer's name — large, prominent.
2. Dry welcome line — Claude-generated via `generateInVoice('onboarding_welcome_saas', context)`.
3. **Step preview:**
   - "First: getting to know you properly. (~30 minutes)"
   - "Then: five quick questions about where your business is. (~2 minutes)"
   - "Then: setting up [Product Name]. (~[estimatedConfigTime])"
4. Single CTA button: "Let's get started" → Brand DNA Assessment.

**No pre-populated summary.** Cold signups don't have enough context depth. A thin summary ("you signed up for ContentEngine") is worse than none.

**Design:** same premium feel as retainer welcome screen. The Subscriber's first impression of SuperBad should not feel like a downgrade from the retainer experience.

---

## 9. Data model

### 9.1 New columns on `companies`

Revenue Segmentation fields (SaaS-only, nullable for retainer companies):
- `revenue_range` — enum: `under_250k` | `250k_500k` | `500k_1m` | `1m_3m` | `3m_plus`
- `team_size` — enum: `solo` | `2_5` | `6_15` | `16_50` | `50_plus`
- `biggest_constraint` — enum: `not_enough_right_customers` | `no_time_marketing` | `dont_know_whats_working` | `brand_doesnt_reflect` | `burned_before` | `growing_not_kept_up`
- `twelve_month_goal` — enum: `steady` | `grow` | `scale` | `launch_new` | `figure_out`
- `industry_vertical` — enum: `health_wellness` | `professional_services` | `trades_construction` | `hospitality_food` | `education` | `retail` | `creative_media` | `other`
- `industry_vertical_other` — text, nullable. Free-text qualifier when `industry_vertical = 'other'`.
- `location` — text. Captured at SaaS signup or from the pipeline for retainer clients. Used as geography gate for upsell targeting.
- `revenue_segmentation_completed_at` — timestamp, nullable. When the customer finished Revenue Segmentation.

**New column on `contacts`** (added per F4.c, 2026-04-13 Phase 3.5 Step 11 Stage 4):
- `onboarding_welcome_seen_at` — timestamp, nullable. Set on first render of the direct/referral retainer welcome screen §8.1. Null for trial-shoot graduates (they bypass that surface entirely) and for contacts who haven't yet logged in post-Won. Used to one-shot the welcome surface.

### 9.2 No new tables

Onboarding progress is derived from existing primitives:
- Brand DNA status: `brand_dna_profiles.status` (from Brand DNA Assessment spec)
- Revenue Segmentation: `companies.revenue_segmentation_completed_at` is not null
- Practical setup steps: setup wizard step completion state (from Setup Wizards spec)
- Product config: product-specific done flag (per product spec)
- Credential creation: user record exists with confirmed email

### 9.3 Company auto-creation for SaaS

When a Subscriber completes payment, the system auto-creates:
1. A `contacts` record (from signup form: name, email)
2. A `companies` record (from signup form: business name, location)
3. Links the contact to the company

Solo operators who don't provide a business name: use their full name as the company name. The record exists for data model consistency — Revenue Segmentation and location always live on `companies`.

---

## 10. Onboarding orchestrator

### 10.1 Architecture

The onboarding orchestrator is a thin composition layer. It does not own state — it reads from the primitives it composes and routes the client/customer to the next incomplete step.

```
function getOnboardingState(companyId, audience): OnboardingState {
  // Reads:
  // - brand_dna_profiles.status for this company's primary contact
  // - companies.revenue_segmentation_completed_at (SaaS only)
  // - setup wizard step states (retainer only)
  // - product config done flag (SaaS only)
  // - user credential exists
  //
  // Returns: { currentStep, completedSteps, totalSteps, audience }
}
```

### 10.2 Routing logic

**Retainer sequence:**
1. Welcome screen (show once, on first portal visit)
2. Brand DNA Assessment (if `brand_dna_profiles.status != 'completed'`)
3. Practical setup — return-when-ready (3 independent steps, any order)
4. Credential creation (if no user record with confirmed email)

**SaaS sequence:**
1. Welcome screen (show once, on first portal visit)
2. Brand DNA Assessment (if `brand_dna_profiles.status != 'completed'`)
3. Revenue Segmentation (if `companies.revenue_segmentation_completed_at` is null)
4. Product config (if product's config done flag is false)
5. Credential creation (if no user record with confirmed email)
6. Product unlocked → `firstRunView`

### 10.3 Resume behaviour

If a client/customer returns mid-onboarding, the orchestrator routes them to the next incomplete step. No re-showing completed steps. The resume screen (for Brand DNA) is handled by the Brand DNA spec — the orchestrator just routes to it.

---

## 11. Brand DNA retake nudge

### 11.1 Purpose shift

Brand DNA is mandatory at onboarding. The dashboard nudge surface's purpose is now **retake prompting** — encouraging existing clients/customers to refresh their profile periodically.

### 11.2 Trigger

Time-based: "It's been [N months] since you completed your Brand DNA. Has anything changed?" Threshold: 12 months since last completion. Surfaces as a prominent but dismissable card on the client/customer portal dashboard.

### 11.3 Retake value

A retake generates a side-by-side comparison with Claude-highlighted shifts (per Brand DNA Assessment spec). The retake card frames this value: "See how you've evolved."

### 11.4 Engagement signal

A voluntary retake surfaces on the cockpit as qualitative intelligence: "[Company name] just retook their Brand DNA assessment." Not factored into Warm/Hot thresholds in v1.

---

## 12. Voice & delight treatment

### 12.1 Ambient voice

- **Welcome screen "what we already know" paragraph** — Claude-generated via Opus with full Brand DNA (SuperBad's own profile) + client context. Admin-roommate register. This is the ambient voice moment for the onboarding feature.
- **Welcome email first line** — claimed from sprinkle bank §3. Claude-drafted, drift-checked, personal. The first programmatic sentence a new client reads from SuperBad.
- **Client portal footer** — claimed from sprinkle bank §7. Shows liveness + humanness from the first portal visit through the ongoing relationship.
- **Step preview copy** — the plain-English descriptions of what's coming next. Written in SuperBad voice, not SaaS voice. "This is the good part" not "Complete your profile."
- **Revenue Segmentation frame** — "Five quick questions about where your business is right now. Takes about two minutes." Casual, not clinical.

### 12.2 Hidden egg suppression

**Full suppression on all onboarding surfaces.** No hidden eggs fire during:
- Welcome screen
- Brand DNA Assessment (already locked in Brand DNA spec)
- Revenue Segmentation
- Product config
- Practical setup wizard steps
- Credential creation

First-session suppression from the S&D spec covers this, but stated explicitly here for build-session clarity.

### 12.3 Browser tab titles

Client-facing, so "SuperBad" not "SuperBad Lite":
- Welcome screen: "SuperBad — welcome, [First Name]"
- Revenue Segmentation: "SuperBad — almost there"
- Product config: "SuperBad — setting up [Product Name]"
- Practical setup: "SuperBad — a few quick things"

Brand DNA has its own tab title treatments (claimed in its spec).

---

## 13. Cross-spec flags

### 13.1 Brand DNA Assessment (LOCKED)

- Composes directly. Onboarding routes to Brand DNA as a step. No changes to the Brand DNA spec required — it already handles save/resume, the reveal, and retake independently.

### 13.2 Quote Builder (LOCKED)

- Quote acceptance is the retainer onboarding trigger. The `handleQuoteAccepted` event must fire the onboarding sequence (welcome email + portal token generation).

### 13.3 Sales Pipeline (LOCKED)

- `companies.location` is a new column used for upsell targeting. Pipeline should capture location during deal creation for retainer clients.
- Upsell filter ("Warm" and "Hot" Subscribers) surfaces as a standing filter on the pipeline board.

### 13.4 Client Context Engine (#7)

- Welcome email reads Client Context Engine summary as a prompt input. If Context Engine spec is not locked yet, the welcome email degrades to deal notes only.

### 13.5 Daily Cockpit (#12)

- Consumes: new Hot upsell candidate alerts, stalled onboarding counts (retainer + SaaS), incomplete practical setup flags.
- Brand DNA retake notifications surface here.

### 13.6 Client Management (#8)

- Client profile shows onboarding completion status (derived — see §10).
- Client portal includes the Brand DNA retake nudge card (§11).

### 13.7 Setup Wizards (#13)

- Practical setup steps (contact details, ad account access, content archive) are setup wizard instances. This spec defines what the steps are; the Setup Wizards spec defines the wizard primitive.

### 13.8 SaaS Subscription Billing (#9)

- SaaS payment triggers onboarding. This spec needs the payment success event from whatever billing flow the SaaS spec defines.

### 13.9 Foundations

- Welcome emails and nudge emails all route through `sendEmail()` with `classification: 'transactional'` (§11.2 gate).
- All Claude-generated client-facing copy passes through the brand-voice drift check (§11.5).

### 13.10 `activity_log.kind`

Gains ~8 values:
- `onboarding_started`
- `onboarding_welcome_email_sent`
- `onboarding_brand_dna_started` (may overlap with Brand DNA spec's own logging)
- `onboarding_revenue_seg_completed`
- `onboarding_product_config_completed`
- `onboarding_practical_setup_step_completed`
- `onboarding_credentials_created`
- `onboarding_completed`

---

## 14. Content mini-session scope

Minimal content needs — most copy is Claude-generated at runtime. Content session covers:

- Welcome screen step preview copy (retainer + SaaS variants)
- Revenue Segmentation frame copy and question presentation copy
- Resume screen copy
- Practical setup step instructions (3 steps × short instruction each)
- Nudge email templates (non-start + practical setup reminders — the static frame around Claude-generated personalisation)
- Brand DNA retake nudge card copy

Can fold into another spec's content mini-session — not large enough to justify its own.

---

## 15. Open questions

### 15.1 Engagement tracking granularity

"Used 3+ distinct features in last 7 days" requires defining what counts as a "feature" for each SaaS product. Each product spec should declare its trackable features as part of its metadata. Not blocking for this spec — resolved per product.

### 15.2 Location granularity

v1 stores location as free text. If filtering becomes unreliable (typos, inconsistent naming), consider migrating to a structured state/territory enum. Not blocking — monitor after launch.

### 15.3 Retake cadence tuning

12-month retake nudge threshold is a starting guess. May need tuning based on real usage — some industries evolve faster. Configurable in admin settings if needed.

### 15.4 Brand DNA gate must check for existing profiles (cross-spec gap)

A contact who completed Brand DNA during a trial shoot (or via tokenised invite) and later converts to retainer or SaaS must not be forced to redo the assessment. The onboarding hard gate must check `brand_dna_profiles.is_current = true AND completed_at IS NOT NULL` for the contact — not whether the assessment was completed *during this onboarding flow*. If a current completed profile exists, the gate passes and onboarding skips to the next step. The retake path remains available if the client wants to redo it voluntarily. Raised 2026-04-12.

---

## 16. Risks

1. **Brand DNA as a 30-minute gate will hurt SaaS conversion.** Mitigation: this is a deliberate quality decision, not an oversight. The product is better because of it. Monitor signup-to-completion rates and adjust the assessment experience if abandonment is too high — but don't remove the gate.

2. **Welcome email Claude drafting at scale.** Every signup triggers an Opus call for the welcome email. At high SaaS volume, this is real API cost. Mitigation: welcome email generation is a single Opus call per signup, not per session. Cost is proportional to signups, which is proportional to revenue. Acceptable.

3. **Token-based portal access security.** Tokens in email links are a phishing vector. Mitigation: tokens are single-use for initial session, scoped to one client, expire after 30 days. Standard magic-link security model — same risk profile as Auth.js magic links themselves.

4. **Derived onboarding state complexity.** Reading completion from 4–5 different primitives could produce edge cases (e.g. Brand DNA marked complete but profile generation failed). Mitigation: the orchestrator checks for actual completion conditions, not just status flags. Brand DNA "complete" means profile exists, not just that the last question was answered.

---

## 17. Reality check

**What's the hardest part?** The welcome screen's "what we already know about you" paragraph. It reads deal notes, quote context, and outreach research — all unstructured data — and synthesises a warm, specific, observant paragraph that makes the client feel known. If this paragraph is generic or wrong, the welcome screen fails. The Claude prompt for this synthesis is the highest-leverage creative task in this spec.

**What could go wrong?** Brand DNA as a hard SaaS gate is the biggest bet. If 60% of paying Subscribers abandon during the assessment, that's a real problem. The mitigation is that Brand DNA is designed to be engaging, not boring — but it's still 30 minutes before product access. Monitor closely post-launch.

**Is this actually doable?** Yes. The spec is primarily a composition layer — it orchestrates primitives that are defined in their own specs (Brand DNA, setup wizards, product config). The new logic is: welcome screen, Revenue Segmentation questionnaire, onboarding orchestrator routing, upsell targeting filter, and email generation. None of these are architecturally complex. Phase 5 sizing: 2 sessions.

**IMPORTANT BUILD NOTE:** Brand DNA is a hard portal lock for both Clients and Subscribers. Optional for trial shoot only. Do not confuse these rules during implementation. The welcome email, welcome screen, and orchestrator all assume Brand DNA completion is required — there is no "skip" path for retainer or SaaS.

---

## 18. Phase 5 sizing

2 sessions:

- **Session A:** Data model (company columns, auto-creation) + onboarding orchestrator + welcome screen + welcome email generation + token-based portal auth + credential creation flow.
- **Session B:** Revenue Segmentation UI + practical setup steps + upsell targeting layer (Warm/Hot logic, cockpit alerts, pipeline filter) + nudge emails + retake nudge.

Session A must land before any SaaS product spec's build session. Session B can run in parallel with product builds.
