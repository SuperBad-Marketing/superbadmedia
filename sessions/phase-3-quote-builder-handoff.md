# Phase 3 — Quote Builder — Handoff Note

**Date:** 2026-04-12
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/quote-builder.md`
**Status:** Locked, 21 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for Quote Builder — the surface Andy uses to quote clients, take payment, and manage commitment lifecycles from acceptance through cancel. 21 multi-choice questions asked, all locked. One multi-session conversation with mid-brainstorm pushbacks that reshaped the original options on 3 questions (Q6 GST, Q14 PDF shape, Q21 cancel flow). Spec is the longest Phase 3 spec so far and unblocks 5 downstream specs.

**Spec structure (15 sections):**
1. Purpose and shape
2. The 21 locks (quick-reference table)
3. End-to-end journey (Andy side + client side + long tail)
4. Surfaces and UI (draft editor, send modal, client web page, PDF, Settings → Templates, Settings → Products/Catalogue, Client Portal cancel flow)
5. Data model (5 new tables, column additions to Pipeline)
6. Claude prompts (7 prompts, Opus + Haiku tiered)
7. Stripe integration shape (Payment Intent, Subscription, Billing Portal config, webhooks)
8. Scheduled-tasks primitive (shared infrastructure introduced here)
9. Q21 cancel flow mechanics (pre-term and post-term branches)
10. Voice & delight treatment (sprinkle claim + sound addition)
11. Cross-spec flags (consolidated)
12. Content mini-session scope (deferred)
13. Open questions
14. Risks
15. Reality check

---

## 2. Key decisions (the 21 locks)

Short form — see `docs/specs/quote-builder.md` §2 for the reference table.

| # | Topic | Lock |
|---|---|---|
| Q1 | Quote structure | Stage-gated proposal with 5 named sections (scroll-snap panels on web page) |
| Q2 | Mixed structure | `structure` enum `retainer | project | mixed`; mixed uses Stripe `add_invoice_items` |
| Q3 | Drafting mode | Three modes: Claude draft-from-context (default Opus) / template load / blank |
| Q4 | Term length | Per-quote picker (3/6/12/custom), no global default |
| Q5 | Billing mode | Respects Pipeline `companies.billing_mode`; manual-billed schedules monthly PDF auto-send |
| Q6 | GST | **GST-inclusive canonical storage.** Andy pushed back on my B2B ex-GST convention recommendation. Principle surfaced: *felt experience wins unless compliance forces the convention.* Flagged for memory promotion. |
| Q7 | State machine | 7 states (`draft`/`sent`/`viewed`/`accepted`/`superseded`/`withdrawn`/`expired`); view-tracking via token-URL first-fetch |
| Q8 | Expiry | Per-quote picker, default 14 days; swept by `scheduled_tasks` |
| Q9 | Catalogue content deferral | Structural shape in spec, content in follow-up mini-session |
| Q10 | Catalogue shape | Structured table with `category` + `unit` enum + `tier_rank`; snapshot-on-add into quotes for audit |
| Q11 | Web page layout | Scroll-snap vertical with sticky right-side stepper; 5 sections; `scroll-snap-type: y proximity` |
| Q12 | Draft editor | Two-pane 40/60 split with debounced 300ms live preview |
| Q13 | Send email | Claude-drafted per-quote, drift-checked, Andy reviews in send modal; link-only (no PDF attachment) |
| Q14 | PDF shape | Deliberate second artefact (invoice-style one-pager), not a web-page compression; Puppeteer-rendered |
| Q15 | Accept → Pay transition | **Same-page reveal via Framer `layoutId` inheriting Intro Funnel's Tier-2 slot.** Zero new motion slots spent. Mount-on-tickbox, step-back affordance, inline error recovery. |
| Q16 | Confirmation screen | Shared shell, billing-mode-specific content; both variants get Playfair italic dry line + "Andy's got it from here." |
| Q17 | Intro paragraph | **Pyramid synthesis** Opus prompt reading all sources with explicit rank weighting; rank-4-only produces empty-state placeholder not robo-paragraph |
| Q18 | Scheduled-jobs primitive | **New shared infrastructure:** `scheduled_tasks` table + single Node cron worker on Coolify; polymorphic `task_type` with handler map; idempotency keys; stale-row reclaim; inherited by every future spec |
| Q19 | Sound registry | **+1 slot:** `sound:quote_accepted`, admin-cockpit-only, visibility-gated, idempotent per quote. Customer-facing audio explicitly withdrawn. |
| Q20 | Edit after send | **Supersede via new row** with `supersedes_quote_id` FK; hash-based `accepted_content_hash` computed at Send and invariant after; old URL renders gentle redirect card |
| Q21 | Commitment + cancel | **Custom Lite-UX-layer cancel flow at `/lite/portal/subscription`** (Billing Portal cancel disabled). Pre-term retainer: *Let's chat* / pay remainder / 50% buyout. Pre-term SaaS: pay remainder / 1-month pause / continue. Post-term (both): retention page with upgrade/downgrade/"here's what you'd lose"/cancel-through. No discounts ever. |

---

## 3. Mid-brainstorm pushbacks — things to carry forward

Three places where I was wrong or incomplete and Andy reshaped the answer. Worth knowing because the same patterns will likely recur.

### 3.1 Q6 — GST pushback (my error)

I recommended ex-GST display on the quote with GST as a separate line, citing "B2B Australian convention". Andy pushed back:

> *"When I receive a quote, and then there's GST on top, it doesn't leave me with a great feeling. I feel like including GST in the pricing will be one of those little touch points that slowly build client relationships and trust."*

I steelmanned the convention argument, then conceded cleanly. The right answer was to store `base_price_cents_inc_gst` as canonical and derive ex-GST only when downstream tax-invoice compliance requires it (Stripe receipts / Branded Invoicing PDFs).

The **principle this surfaced** — which applies beyond this spec — is proposed for memory promotion (§6 below): *when convention and felt experience conflict, felt experience wins unless compliance forces the convention.*

### 3.2 Q14 — PDF shape (minor refinement)

Not a pushback, but an important reframing. The spec locks the PDF as a **deliberate second artefact**, not a compressed version of the web page. Two artefacts, each optimised for its job:
- **Web page:** fully cinematic editorial experience
- **PDF:** clean invoice-style one-pager the client's champion can forward internally to their CFO

Rationale anchored in the `project_client_size_diversity` memory: SuperBad clients are multi-stakeholder, the champion needs a document their boss can read in 30 seconds.

### 3.3 Q21 — cancel flow (significant expansion)

My original 3 options (A hard enforcement / B soft with cockpit surfacing / C no tracking) were all wrong — Andy picked "A with significant refinements" which turned out to be a hybrid:

- **Hard UX enforcement** at the Lite layer (Billing Portal cancel disabled, custom cancel page intercepts everything)
- **Soft escape options** via paid exits (pay remainder, 50% buyout) so the client is never *trapped*, just forced through a human-dignity-preserving decision point
- **Retention layer** for post-term cancels (upgrade/downgrade/"here's what you'd lose") that I hadn't offered as an option at all

I flagged an Australian consumer-law concern (the ACCC's unfair-contract-terms rules), proposed a 48h auto-resolve fallback as de-risking. Andy's second answer made the 48h mechanism unnecessary by providing genuine paid exit options — the client is never actually blocked, they just have to choose how to leave.

**Key shape additions from Andy's second answer:**
- 50% buyout pattern (standard in agency retainer contracts)
- 1-month pause for SaaS (Stripe native `pause_collection` + commitment-date extension, one per commitment)
- Post-term retention **explicitly not via discounts** ("why wasn't I paying this from the start") — only via upgrade/downgrade/sunk-cost messaging
- Tier pricing flag for the SaaS spec (longer commitment = cheaper monthly rate, with loophole closure)

**Subtle load-bearing detail:** I originally recommended Stripe Subscription Phases for hard enforcement. After thinking it through, the spec locks **plain rolling subscriptions** instead, because Phases would auto-charge remainders (wrong — we want Andy to decide bilaterally on *Let's chat*) and we're enforcing at the Lite UX layer anyway. Phases buys nothing; skip it.

---

## 4. All cross-spec flags (consolidated — READ BEFORE STARTING ANY DOWNSTREAM SPEC)

This is the biggest cross-spec flag list from any Phase 3 spec so far. Future spec sessions that build on Quote Builder must honour every line.

### 4.1 Pipeline (`docs/specs/sales-pipeline.md`)

**New column on `deals`:**
- `committed_until_date` date nullable
- `subscription_state` enum: `active | paused | pending_early_exit | cancelled_paid_remainder | cancelled_buyout | cancelled_post_term | ended_gracefully`
- `pause_used_this_commitment` boolean default false
- `stripe_subscription_id` text nullable (denormalised)
- `stripe_customer_id` text nullable (denormalised)

**New column on `companies`:**
- `gst_applicable` boolean default true

**`deals.won_outcome` enum:** add `'project'` value (currently `retainer | saas`).

**`activity_log.kind` enum additions** (18 new values):
- `quote_draft_started`
- `quote_sent`
- `quote_viewed`
- `quote_accepted`
- `quote_settled`
- `quote_superseded`
- `quote_expired`
- `quote_withdrawn`
- `scheduled_task_dispatched`
- `subscription_cancel_intercepted_preterm`
- `subscription_early_cancel_paid_remainder`
- `subscription_early_cancel_buyout_50pct`
- `subscription_paused`
- `subscription_pause_ended`
- `subscription_upgrade_intent`
- `subscription_downgrade_intent`
- `subscription_cancelled_post_term`
- `subscription_ended_gracefully` *(possibly redundant if post-term cancel always routes through retention page — resolve in Phase 5 build)*

### 4.2 Branded Invoicing (`docs/specs/branded-invoicing.md`) — **NEXT SESSION**

- Must expose an invoice-generation primitive callable by `handleManualInvoiceSend` in Quote Builder's scheduled-tasks worker. Signature TBD by that spec.
- Must render ATO-compliant tax invoices: itemised GST line, ABN, "Tax invoice" in the document title
- Must derive ex-GST from Quote Builder's stored `total_cents_inc_gst` (canonical GST-inclusive storage)
- Must support recurring monthly auto-send via `task_type = manual_invoice_send` handler pattern
- Handler signature from Quote Builder §8.3:
  ```
  handleManualInvoiceSend({ deal_id, cycle_index, cycle_start, cycle_end })
  → on success: enqueue next cycle
  → on failure: retry 3×, then escalate to cockpit
  ```
- The handler itself lives in `lib/scheduled-tasks/handlers/` but the invoice generation logic it calls lives under Branded Invoicing
- Branded Invoicing inherits Quote Builder's supersede pattern as a template for any in-period invoice edit concerns
- Sprinkle candidate: §3 Invoice PDF footer (*"paid in full. pleasure doing business."*) — natural claim for this spec

### 4.3 Client Management (`docs/specs/client-management.md`)

- Must surface a "my invoices" page for manual-billed clients accessible from the Q16 manual-billed confirmation screen footer link
- Must surface subscription state on client profile: `active`/`paused`/`pending_early_exit`/committed-until date
- Profile tabs must include a billing tab showing current subscription + commitment + history

### 4.4 Client Portal (currently rolled into Client Management until split)

- Owes `/lite/portal/subscription` with pre-term + post-term cancel branches
- Owes pause-status page for currently-paused subscriptions
- Owes confirmation screens for each paid-exit outcome (remainder / buyout / cancel-post-term / pause)
- Owes the upgrade/downgrade "option cards" UI pulling retainer-category items by `tier_rank` from catalogue
- Must render the "here's what you'd be losing" list from the accepted quote's `content_json`
- Content mini-session owes all copy for these surfaces

### 4.5 SaaS Subscription Billing (`docs/specs/saas-subscription-billing.md`)

- **Tier pricing:** longer commitment = cheaper monthly rate. 3/6/12-month tiers with progressive discounts.
- **Loophole closure:** early-cancel "remainder" calculation must use the client's locked-in committed rate, not the rate they'd pay under a shorter tier. Closes "cancel 12-month, resubscribe 3-month" gaming.
- **SaaS-specific early-cancel flow:** pause + pay-remainder + continue (different from retainer's three options)
- **Consider whether SaaS signup uses Quote Builder at all** — likely a direct public signup flow, not a quote flow. Most of Quote Builder's draft-review-send machinery doesn't apply to SaaS activation. Resolve in that spec's Q1.

### 4.6 Design System Baseline (`docs/specs/design-system-baseline.md`) — revisit

- No new Tier-2 motion slots claimed by Quote Builder (Payment Element reveal inherits Intro Funnel's slot)
- **One new sound registry slot:** `sound:quote_accepted`. Registry count grows 7 → 8 (plus Intro Funnel's pending additions). Characterisation: warm, short (<400ms), single-note ~330-440Hz, dry not celebratory, not a ding/chime/bell. Admin-cockpit-only, idempotent per quote.
- Revisit must validate both the Intro Funnel additions AND this new entry in one pass.

### 4.7 Surprise & Delight (`docs/specs/surprise-and-delight.md`)

- No new ambient-layer surface categories added by Quote Builder
- **One sprinkle claimed:** §3 Quote PDF cover line from `docs/candidates/sprinkle-bank.md`. Marked `[CLAIMED by quote-builder]` in the bank file. Sprinkle promotion brainstorm can ignore this item (already claimed).
- No new hidden eggs proposed
- Quote Builder surfaces are context-aware-suppressed for the hidden layer (mid-payment, mid-decision, errors) — nothing rare should fire during a quote flow

### 4.8 Daily Cockpit (`docs/specs/daily-cockpit.md`)

- Must subscribe to real-time admin event stream for: `quote_viewed` (subtle deal-card badge), `quote_accepted` (fires `sound:quote_accepted`), `subscription_cancel_intercepted_preterm` (high-priority attention card), `subscription_upgrade_intent` / `subscription_downgrade_intent` (attention cards)
- Must render a "scheduled tasks" pane showing `SELECT * FROM scheduled_tasks WHERE status='pending' AND run_at <= now() + interval '7 days'`
- Must render a failed-task queue showing `status='failed'`
- Must render a red worker-heartbeat banner if `worker_heartbeats.last_tick_at < now() - 5 minutes`
- Cocktail pattern: scheduled tasks surface is read-only and auditable, like the activity log

### 4.9 Comms Inbox (`docs/specs/unified-inbox.md`)

- Quote-related emails (send, reminder, settle, expire, cancel-intercept, post-term retention emails) must thread correctly with the deal's contact thread via `In-Reply-To` / `References` headers
- The `thread_message_id` column on `quotes` stores the original Message-ID for thread continuation

### 4.10 Foundations (`FOUNDATIONS.md`)

- **§11.2 `sendEmail()` gate patch** (already owed from Task Manager): add required `classification: 'transactional' | 'outreach'` parameter. Quote Builder uses `transactional` for every outbound it triggers (send, reminder, settle, expiry, cancel-intercept, pause-ending, paid-exit confirmations). Transactional bypasses §11.4 quiet window by default but offers one-click override. Build this in Phase 5 before Quote Builder build sessions C + D.
- **New shared primitive introduced:** the `scheduled_tasks` table + worker process. Treat as §11-tier cross-cutting infrastructure. Any future spec that needs scheduled work uses this pattern; do not introduce a second scheduling mechanism. Document in FOUNDATIONS §11 when the Build Plan runs in Phase 4.

---

## 5. New tables introduced

- **`quotes`** — full schema in spec §5.1
- **`catalogue_items`** — spec §5.2
- **`quote_templates`** — spec §5.3
- **`scheduled_tasks`** — spec §5.4 (shared primitive)
- **`worker_heartbeats`** — spec §5.5 (thin observability for the cron worker)

All schema is additive. No drops. No breaking changes to existing Pipeline tables.

---

## 6. Memory promotion flagged

**`feedback_felt_experience_wins.md`** — propose this new memory next session start (before Branded Invoicing Q1). Suggested body:

```markdown
---
name: Felt experience wins unless compliance forces the convention
description: When convention and felt experience conflict on customer-facing decisions, default to felt experience; only honour the convention when compliance requires it.
type: feedback
---

When a customer-facing design decision pits industry convention against how it *feels* to the person receiving it, default to the felt-experience answer. Only honour the convention when there's a compliance reason that forces it.

**Why:** Surfaced twice in the Quote Builder brainstorm (2026-04-12). Q6: I recommended ex-GST quote display citing B2B Australian convention; Andy pushed back — receiving a quote with GST-on-top leaves him with a poor feeling, and quotes are a trust-building surface. Conceded: store GST-inclusive as canonical, derive ex-GST only for downstream tax invoices where ATO compliance *forces* the split. Q21: the same principle drove the cancel-flow shape — "trap the client in a Stripe Phase until the commitment expires" is convention; "intercept warmly and offer paid exits" is felt experience. Same answer both times.

**How to apply:** When facing a decision between "what a SaaS platform is supposed to do" and "what feels right to the person on the other side", start from felt-experience and challenge me to produce a compliance reason before flipping to convention. Store values in the format the client should feel them; derive convention-compliant versions downstream at the compliance boundary (tax invoices, legal terms, regulatory filings). For UX decisions, start from "how does this land on a human" and work backwards.
```

Write the memory file + add to MEMORY.md index after Andy signs off on the body.

---

## 7. Content mini-session scope (deferred — owed before Phase 5 build)

A dedicated creative session with `superbad-business-context` + `superbad-brand-voice` + `superbad-visual-identity` skills loaded. Must run before Phase 5 build sessions C and D of Quote Builder. Scope:

**Catalogue:**
- Category taxonomy (ads management, creative, photography, video, social, content, etc. — real shape TBD)
- Unit choices per category
- Seeded item set (~20–40 items covering common retainer + project scope)
- Retainer tier naming + `tier_rank` ordering
- Starter templates (`quote_templates` rows) for common retainer shapes

**Client-facing copy slots:**
- 5 scroll-snap section headings (refine defaults)
- Terms tickbox label + Accept button copy
- Fine-print around Payment Element
- Empty-state placeholders (intro paragraph, no catalogue, no context)
- Loading-state copy for the 2–4s draft generation wait
- Low-confidence warning wording on intro paragraph review
- Rank-provenance hint copy ("drafted from: rank-1 + rank-3")
- Superseded URL card copy
- Withdrawn URL card copy
- Expired URL card copy

**Emails (~13 templates + prompts):**
- Send, reminder 3-day, settle Stripe-billed, settle manual-billed, expiry, supersede ("this replaces..."), withdrawal (if any), cancel-intercept, upgrade-intent, downgrade-intent, pause-ending heads-up, first-invoice (manual-billed), footer convention, sign-off convention

**PDF cover line:** decide between per-quote Claude generation (drift-checked) vs rotation from a hand-written pool (~20 lines minimum). If rotation: author the pool.

**Cancel flow copy:**
- Pre-term retainer page header + "Let's chat" intercept
- Pre-term SaaS page header
- Post-term retention page header
- "Here's what you'd be losing" presentation rules
- Pause-confirmation screen
- Paid-exit confirmation screens (remainder + buyout)

**Terms page:**
- Full honour-based commitment terms with exit options clearly disclosed
- Plain-English framing
- **Short solicitor review before launch** (not blocking — general hygiene around unfair contract terms)

---

## 8. What the next session should know

### 8.1 Next recommended spec: Branded Invoicing

Branded Invoicing is **directly downstream** of Quote Builder. The handler `handleManualInvoiceSend` in Quote Builder's scheduled-tasks worker is the main integration point — Branded Invoicing must expose an invoice-generation primitive with a signature that handler can call. Key points:

- Read `docs/specs/quote-builder.md` §8.3 before starting the Branded Invoicing brainstorm — it locks the handler signature and expected behaviour
- Quote Builder's GST-inclusive canonical storage means Branded Invoicing must handle the ex-GST derivation for ATO compliance
- Use the supersede pattern (Quote Builder §5.1 `supersedes_quote_id`) as a template for invoice-edit concerns if they arise
- Sprinkle candidate flagged for this spec: §3 Invoice PDF footer — natural claim
- Cross-spec: `activity_log.kind` will need `invoice_generated`, `invoice_sent`, `invoice_marked_paid` (at least) — add to the running list when locked

### 8.2 First MC question for Branded Invoicing

Likely: **invoice-number format and per-client sequencing** — global `SB-INV-0042` pattern (parallel to Quote Builder's `SB-2026-0042` quote numbers), per-client sequence, or per-year sequence. Trade-off is ATO tax-invoice compliance (globally unique required) vs. operational legibility.

### 8.3 Phase 5 sizing for Quote Builder

Expect **3–4 build sessions minimum**:
1. **Session A — Data + Stripe.** Tables, state machine, Payment Intent + Subscription creation, webhook handlers, Billing Portal config. Stripe CLI forwarding setup. Verify via DB queries only. No UI. No Claude.
2. **Session B — Scheduled-tasks primitive.** Worker process, handler map, stale reclaim, heartbeat, all 5 Quote Builder handlers. Unit tests per handler.
3. **Session C — Draft editor + send flow.** Two-pane editor, all Claude prompts wired, template load, send modal, email dispatch. Static preview pane (no scroll-snap yet).
4. **Session D — Client web page + confirmation + cancel flow.** Scroll-snap, Payment Element cinematic reveal, confirmation screens, full `/lite/portal/subscription` flow, supersede/withdraw/expired card states.

Sessions A and B are independent and can run in parallel if two Phase 5 slots are available. C and D depend on both.

**Hardest piece to spike early:** the Framer Motion `layoutId` transform + Stripe Elements mount lifecycle (Q15 cinematic Payment Element reveal). Prototype this in a dedicated spike session *before* Session D, with a feature-flag fallback to a modal (Q15 Option B) if the transform proves fragile.

### 8.4 Things easily missed

- **The `classification` parameter on `sendEmail()`.** Already owed from Task Manager, but Quote Builder *relies* on it for ~13 outbound emails. Land this in Foundations §11.2 before Quote Builder Phase 5 sessions C/D, or Quote Builder's email handlers will have no clean way to bypass §11.4 quiet window for transactional sends.
- **Denormalised columns on `deals`** (`committed_until_date`, `subscription_state`, `stripe_subscription_id`, `stripe_customer_id`) are populated at accept time and read by webhook handlers for fast lookup. Don't forget to keep them in sync with the source of truth (`quotes` for commitment, Stripe API for subscription state via webhooks).
- **The `won_outcome = 'project'` enum value.** Don't just extend `retainer | saas` to `retainer | saas | project`. In Phase 5, update the Pipeline spec file to reflect the new enum and make sure any pipeline-reading code accepts all three values.
- **Quote numbering format.** Spec uses `SB-2026-0042` (year + zero-padded counter). Resolve global vs per-year in build — lock current direction in the spec is per-year.
- **`scheduled_tasks.idempotency_key` uniqueness.** Not optional — every row must have a key, and the key must be deterministic enough that re-running the enqueue logic produces the same key. Without this, worker retries can double-fire.
- **The "is `subscription_ended_gracefully` ever reached?" open question.** Current post-term cancel flow routes through the retention page, which always logs one of the three post-term outcomes. The `ended_gracefully` value might never fire. Resolve during build — either delete the value or find the case that hits it.

---

## 9. Reality check summary

Quote Builder is the most load-bearing spec in Phase 3 by a meaningful margin. Reasons:

- **First feature where money actually moves.** Every bug is a real money bug.
- **Biggest Stripe surface area in Lite.** Payment Intents + Subscriptions + Billing Portal + webhooks + `add_invoice_items` + one-off paid exits + pause/resume + Customer objects.
- **First shared worker process.** The `scheduled_tasks` cron worker is new infrastructure — first Lite feature with a heartbeat, first with a second Coolify service.
- **Hardest motion moment in the spec.** Framer `layoutId` ⟷ Stripe Elements mount is uncharted territory.
- **Seven Claude prompts.** Each is a drift-check surface, a cost line item, and a retry loop.
- **Largest cross-spec flag list yet.** 18 new activity log values, 5 new deals columns, 5 downstream specs with implementation obligations.

None of the individual pieces are novel. The risk is aggregate complexity. Phase 5 planning should:

1. Budget 3–4 sessions minimum
2. Run Sessions A and B in parallel if possible
3. Spike the Payment Element cinematic reveal early
4. Have the content mini-session done before Session C
5. Read this handoff at the start of **every** downstream spec session to honour the cross-spec flags

---

## 10. No new specs spawned

Quote Builder did not add any new backlog items. The cross-spec flags are obligations on existing backlog items (Branded Invoicing, Client Management, Client Portal via Client Management, SaaS Subscription Billing, Daily Cockpit, Comms Inbox, Design System Baseline revisit).

**Backlog count unchanged:** 16 total, 6 locked, 10 remaining.

---

**End of handoff.**
