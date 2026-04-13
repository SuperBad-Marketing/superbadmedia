# Phase 3 — Daily Cockpit — Handoff Note

**Date:** 2026-04-13
**Phase:** 3 (Feature Specs)
**Session type:** Spec brainstorm → locked spec file
**Spec file:** `docs/specs/daily-cockpit.md`
**Status:** Locked, 9 questions resolved.

---

## 1. What was built

A complete Phase 3 feature spec for the Daily Cockpit — the operator's morning surface at `/lite`. The keystone aggregation spec that ties 14 locked specs together. Mostly a read-through surface; only one new table (`cockpit_briefs`) and one new Opus prompt. The design discipline this session most exercised: resisting the temptation to invent new primitives when contracts on locked specs would do the job.

One significant mid-brainstorm expansion from Andy that reshaped the voice surface:

1. **Q5 — Brief generation timing.** I proposed a single morning brief regenerated on material events. Andy expanded to **three briefs per day**: morning (06:00), midday check-in (~12:00), and evening wrap (~18:30) with tomorrow preview. This turned a single-prompt voice surface into a chained narrative arc across the day. Led directly to the chained-continuity-with-event-trail architecture (Q6 picked option C) and to three prompt templates rather than one.

---

## 2. Key decisions summary

### Layout (desktop)

Top-to-bottom, single column:

1. Signed-in admin greeting line (small grey, rotation pool)
2. Narrative brief (2–3 sentences, SuperBad voice, time-of-day-slot-aware)
3. Attention rail (horizontal, up to 6 chips, `+N more` overflow to `/lite/waiting`)
4. Banner strip (conditional — only renders when ≥1 banner firing, max 2 visible, overflow to `/lite/health`)
5. Calendar preview band (today's events)
6. Planning view (kanban default, list toggle)

No right-hand sidebar. No tile grid. No "briefing notes" column. Read-only info tiles explicitly rejected (per SCOPE).

### Layout (mobile PWA)

Vertical stack, horizontal-scroll rail, tabbed kanban (Must Do / Should Do / If Time with counts), house-spring swipe motion between tabs, list toggle icon. Cockpit is the default PWA route post-install.

### Three daily briefs

- **Morning** 06:00 — orientation
- **Midday** 12:00 — progress check
- **Evening** 18:30 — wrap + tomorrow preview ("big shoot day tomorrow" / "looks quiet")

Cached per (user, slot, brief_date) in `cockpit_briefs`. Cockpit renders the most recent successful brief for the current time-of-day slot. Slot rollover has no loading state — previous slot's brief stays visible until new slot's cron fires.

### Chained continuity with event trail (Q6 option C)

- Morning prompt reads: current aggregate signals + SuperBad's own Brand DNA + today's calendar + time-sensitive items
- Midday prompt reads: morning brief prose + compact event log since 06:00 + current signals
- Evening prompt reads: morning + midday prose + expanded event log + tomorrow's calendar + tomorrow's scheduled_tasks + anything due tomorrow

Event trail comes from `activity_log` filtered through an **allow-list** (`lib/cockpit/andy-facing-activity.ts`). Drift protection baked into each prompt: "reference earlier briefs if useful, but don't invent continuity — if nothing meaningful happened since, say so."

### Material-event regen

- New `scheduled_tasks` type: `cockpit_brief_regenerate`
- Denylist of ~10 material event keys in `lib/cockpit/brief-triggers.ts`
- 10-minute debounce per slot (prevents fire-day thrash)
- Chain-anchored to the *original* morning brief, not previous in-slot regen (prevents hallucination chains)

### Quiet-slot skip

Precondition check *before* calling Opus. Three conditions all required:
- Zero items in `getWaitingItems()` union
- Zero material events since last slot
- Zero system-health banners firing

On skip: render a curated fallback line from the rotation pool (~20 pre-written lines, content mini-session). Cheap; consistent voice; lower drift.

### Attention rail

- Contract: every locked spec exposes `getWaitingItems(userId): Promise<WaitingItem[]>`
- 11 source specs contribute chips
- Sort: time-sensitive first by deadline asc, then age-of-wait by wait-start asc
- Cap 6 + `+N more` → `/lite/waiting` flat list view
- Fleet-scoped chips fold into same rail with `[Fleet]` tag; no dedicated fleet band
- No dismissal, no snooze — rail is purely derived; resolution at source spec is the only clearing mechanism

### Banner strip

- Contract: every banner-contributing spec exposes `getHealthBanners(userId): Promise<HealthBanner[]>`
- 4 source specs: Unified Inbox, Content Engine, Finance Dashboard (pending), SaaS Subscription Billing
- Conditional render — only visible when ≥1 banner firing
- Max 2 visible, overflow collapses to `+N more issues` → `/lite/health`
- Graceful degradation if a source spec is not yet built (empty array, cockpit continues)

### Calendar preview

- Reads from native Lite calendar (Andy's only calendar per `project_client_shoot_bookings`)
- Today's events, time-ordered
- Tap-through to `/lite/calendar`
- Tomorrow's calendar lives in the evening brief prose, not the band

### Planning view

- Pure read-through of Task Manager's locked kanban column rules (Must Do / Should Do / If Time)
- Cockpit does **not** re-derive column rules
- No create / edit / drag affordances on the cockpit — clicking a task opens the Task Manager drawer

### Voice & delight

- Two sprinkle claims: browser tab title on `/lite`, signed-in admin greeting line
- One new ambient category **proposed** for S&D closed list (6 → 7): quiet-slot fallback lines — pending sprinkle-promotion brainstorm gate
- Hidden eggs on cockpit are expected; egg suppression during banner alerts and in-progress brief regen

---

## 3. No new memories

No new principles surfaced. The spec applied existing memories extensively:

- `project_llm_model_registry` — Opus call routed via registry under job key `cockpit-brief`
- `project_two_perpetual_contexts` — SuperBad's own Brand DNA injected as system context (Andy's company, not a client)
- `feedback_motion_is_universal` — house-spring motion on kanban tab switching, brief slot transitions, chip reveals
- `project_client_shoot_bookings` — native Lite calendar as single source for calendar preview
- `feedback_no_content_authoring` — brief prose is generated; Andy never authors cockpit copy directly
- `feedback_surprise_and_delight_philosophy` — cockpit as the admin-roommate surface; quiet-morning fallback reinforces the 80% ambient voice
- `feedback_pre_populated_trial_experience` — not directly applied (cockpit is admin), but the same "never empty shell" discipline informed the quiet-slot fallback design

Material-event regen denylist discipline (`lib/cockpit/brief-triggers.ts` as single source of truth) emerged but is a spec-local discipline, not a platform principle.

---

## 4. Sprinkle bank updates

Claimed for later content mini-session (§Voice & delight of spec):

- Browser tab title on `/lite` — `Lite — 3 waiting` / `Lite — all quiet` / `Lite — maybe sit down` / all-quiet-weekend variant
- Signed-in admin greeting line above narrative brief — rotation pool of ~15–25 short lines

New ambient category proposed for S&D closed list (6 → 7):

- Quiet-slot fallback lines — curated rotation pool of ~20 lines, may stratify by slot (quiet-morning vs quiet-evening vibe differs). **Requires brainstorm gate** per the cross-cutting constraint — added to the sprinkle-promotion brainstorm already owed.

---

## 5. Cross-spec flags (consolidated)

### 5.1 `getWaitingItems()` contract owed (11 specs — Phase 3.5 patch)

Each of these specs adds a `getWaitingItems(userId)` function matching the contract:

- Quote Builder (LOCKED)
- Branded Invoicing (LOCKED)
- SaaS Subscription Billing (LOCKED)
- Unified Inbox (LOCKED)
- Task Manager (LOCKED)
- Client Management (LOCKED)
- Lead Generation (LOCKED)
- Intro Funnel (LOCKED)
- Brand DNA Assessment (LOCKED)
- Content Engine (LOCKED)
- Client Context Engine (LOCKED)

Small patch to each spec's "Cross-spec impacts" section. No structural change.

### 5.2 `maybeRegenerateBrief()` callsite wiring (8 specs — Phase 3.5 patch)

Source specs that fire material events must call `maybeRegenerateBrief(eventKey, payload)` at the state-change site:

- SaaS Subscription Billing — `subscription_payment_failed`, `subscription_cancelled`
- Sales Pipeline — `deal_won`, `deal_lost`
- Branded Invoicing — `invoice_paid_large` (>$1000 AUD, tunable)
- Intro Funnel — `intro_funnel_booking_confirmed`
- Lead Generation — `outreach_reply_positive`
- Content Engine — `content_engine_domain_verification_failed`
- Unified Inbox — `graph_api_subscription_lapsed`
- Finance Dashboard / Cost & Usage Observatory — `cost_anomaly_detected`

### 5.3 `getHealthBanners()` contract owed (4 specs — Phase 3.5 patch)

- Unified Inbox (Graph API lapsed, SendAs revoked, import stuck)
- Content Engine (fleet domain failures, Remotion outage, OpenAI rate-limit regression)
- Finance Dashboard / Cost & Usage Observatory (cost anomalies, subscriber-cost-exceeding-revenue warnings)
- SaaS Subscription Billing (Stripe webhook backlog)

### 5.4 Unified Inbox (LOCKED)

- `getWeeklySocialDigestSignal(userId, weekStart)` — consumed by Monday morning brief prompt
- `getWeeklyInboxHygieneSignal(userId, weekStart)` — consumed by Monday morning brief prompt
- Graph API lapsed banner source

### 5.5 Task Manager (LOCKED)

- `getTasksForCockpitKanban(userId)` — exports the kanban column rule result
- Cockpit calls this helper; does not re-derive column rules

### 5.6 Client Context Engine (LOCKED)

- `getSignalsForAllContacts()` exists but is **not** injected into briefs (cockpit is Andy's view, not per-client)
- Available for cross-linking in rail chips when useful (e.g. entity avatars)

### 5.7 Surprise & Delight (PRE-WRITTEN)

- Sprinkle claims listed in §4
- New ambient category proposal (quiet-slot fallback) requires sprinkle-promotion brainstorm gate
- Hidden-egg suppression rules: no egg during banner alert or during in-progress brief regen
- Cockpit is an expected admin-egg surface; admin-egg expansion brainstorm will produce specifics

### 5.8 Cost & Usage Observatory (pending — next recommended spec)

- Contract `getHealthBanners()` will emit `cost_anomaly` banners
- Wire `maybeRegenerateBrief('cost_anomaly_detected')` callsite
- External-call observability applies to `cockpit-brief` call site: log `{job: 'cockpit-brief', actor_type: 'internal', actor_id: null, units: tokens_used, estimated_cost_aud, timestamp}`

### 5.9 Foundations — no new patches owed

All shared primitives needed by cockpit are already locked or already flagged:

- `formatTimestamp()` — §11.3 (used for chip labels, calendar, banners)
- `logActivity()` — §11.1 (used for 8 new `activity_log.kind` values)
- `generateInVoice()` / brand-voice drift check — §11.5 (used for brief output)
- `scheduled_tasks` + single cron worker — shared primitive from Quote Builder
- LLM model registry — one new job key `cockpit-brief`
- External-call observability — pending Foundations §11 patch (not blocking cockpit Session A; logs nothing if primitive not yet in place)

No new Foundations patches created by this spec.

---

## 6. New data

### 6.1 New tables: 1

- `cockpit_briefs` — one row per (user_id, slot, brief_date); regen overwrites with activity_log audit trail

### 6.2 No new columns on existing tables

Cockpit reads through contracts. Source specs own their data.

### 6.3 `activity_log.kind` gains ~8 values

- `cockpit_brief_generated`
- `cockpit_brief_regenerated`
- `cockpit_brief_skipped_quiet`
- `cockpit_waiting_opened`
- `cockpit_health_opened`
- `cockpit_chip_tapped`
- `cockpit_banner_dismissed` (future-proofed, not used in v1)
- `cockpit_slot_rolled_over`

### 6.4 `scheduled_tasks.task_type` gains 1 value

- `cockpit_brief_regenerate` — payload `{ user_id, slot, trigger_event, material_event_payload }`

### 6.5 No new `scheduled_tasks` for cron scheduling

The three daily slot cron entries (06:00, 12:00, 18:30 Melbourne) hit `generateBriefForSlot(slot)` directly — they are **not** enqueued through `scheduled_tasks`. Only event-triggered regen goes through `scheduled_tasks`.

---

## 7. No new integrations

Cockpit reads from locked specs. No external API dependencies introduced.

---

## 8. Claude prompts (1)

### `cockpit-brief` (Opus)

- Job key in registry: `cockpit-brief`
- Three prompt templates at `lib/cockpit/prompts/{morning,midday,evening}.ts`
- Slot passed as prompt parameter
- Brand-voice drift check on output (per Foundations §11.5)
- Content mini-session writes the templates

Quiet-slot fallback and signed-in admin greeting are **not** Opus calls — they are rotation pools from the content mini-session, selected pseudo-randomly with no-repeat guarantees.

---

## 9. New build-time disciplines (9: 65–73)

65. Cockpit has no data of its own beyond briefs. Attention rail + banner strip are pure read-throughs.
66. Brief regen runs through `scheduled_tasks` with 10-min debounce per slot. Never call `generateBriefForSlot()` directly from a source spec.
67. Mid-slot regen chains off the *original* morning brief, not the previous in-slot regen.
68. Quiet-slot skip is a precondition check, not a post-hoc filter.
69. `getAndyFacingActivitySince()` uses an allow-list, not a deny-list. New `activity_log.kind` values default to not-Andy-facing.
70. Rail sort is deterministic. No LLM triage, no learned weights.
71. Source spec contracts are graceful. Cockpit returns a rendered page even when one source fails.
72. No brief can reference data not in its input signals. Drift check enforces.
73. Model version is pinned in `cockpit_briefs.model_version` for audit.

---

## 10. Content mini-session scope

**Small-medium.** Dedicated creative session with `superbad-brand-voice` + `superbad-visual-identity` + `superbad-business-context` skills loaded.

Produces:

- Three brief prompt templates (morning / midday / evening) — slot-specific voice direction, chaining behaviour, drift-guard language, Brand DNA injection contract, input signal bundle structure
- Quiet-slot fallback rotation pool (~20 lines, may stratify by slot)
- Signed-in admin greeting rotation pool (~15–25 lines)
- Browser tab title voice treatments (quiet / normal / busy / fire-day / all-quiet-weekend)
- Calendar preview empty-state copy
- `/lite/waiting` empty-state and full-fire-day copy
- `/lite/health` banner copy per condition
- Rail chip label conventions per `source_spec`

Must run before Phase 5 Sessions A + B. Sessions C–E can ship with placeholder copy and the mini-session backfills.

---

## 11. Phase 5 sizing

5 sessions:

- **A. Briefs — data + morning slot + cron.** `cockpit_briefs` table, 06:00 cron, `generateBriefForSlot('morning')` pipeline end-to-end, signals snapshot capture, drift check integration. Ships a working morning brief. Medium.
- **B. Briefs — midday + evening + event trail + chaining + regen.** `getAndyFacingActivitySince()` helper, midday + evening prompt templates, `maybeRegenerateBrief()` with debounce, `cockpit_brief_regenerate` scheduled task, quiet-slot skip, fallback + greeting rotation pools. Large.
- **C. Attention rail + `/lite/waiting`.** Rail UI, `getWaitingItems()` merge + sort, chip components per source_spec, `+N more` overflow, flat list view. Stubs for any unbuilt source. Medium.
- **D. Banner strip + calendar preview + `/lite/health`.** `getHealthBanners()` merge, conditional render, overflow collapse, calendar band, health detail screen. Small-medium.
- **E. Mobile PWA layout.** Responsive stack, horizontal-scroll rail, tabbed kanban with house motion, list toggle, PWA default-route wiring. Medium.

**Sequencing note:** A + B are voice-critical and require the content mini-session to have run. Sessions C–E can land before the mini-session with placeholder copy; mini-session backfills.

**Dependency note:** Cockpit is a Phase 5 *middle* build, not late. Ship the skeleton early (A + stubbed C) so downstream specs can wire their contracts as they land, rather than retrofitting at the end.

---

## 12. What the next session should know

### 12.1 Next recommended spec: Cost & Usage Observatory (#18)

Operator-only cost-attribution surface. Cockpit's cost-anomaly banner source depends on Observatory's primitives existing, and Observatory's own sequencing note places it immediately after Cockpit and before Setup Wizards. Locking it next closes a dependency loop for Cockpit and establishes the external-call observability primitive in time for the Phase 4 build plan.

Key brainstorm territory:

- `external_call_log` schema — one row per external call with job + actor attribution + units + cost estimate
- Job taxonomy — named jobs matching the LLM model registry + analogous keys for non-LLM APIs (Stripe, Resend, Meta/Google Ads, SerpAPI, Pixieset, Graph API, OpenAI Images, Twilio)
- Actor-attribution rule — internal (SuperBad ops) vs external (attributable to a specific client or subscriber); the splitting convention
- Anomaly detection logic — fixed thresholds? learned bands? both? per-job or per-actor?
- Cockpit banner contract — severity thresholds, dedupe rules, how the banner phrases "runaway background task" vs "subscriber exceeding tier revenue"
- Admin dashboard surface structure — three-level zoom (aggregate → per-job → per-actor) already hinted in SaaS Billing
- Retention policy — how long before old call log rows are aggregated or purged
- Foundations §11 patch shape — where the patch amendment lives, what callsites it mandates

Must resolve before Phase 4. BUILD_PLAN.md needs the logging requirement listed as a first-Phase-5-session foundation task.

### 12.2 Things easily missed

- **Three briefs, not one.** Morning / midday / evening. Each caches separately. Slot boundaries determine which is rendered. Mid-slot regen updates the current slot's cached brief — does not create a new slot row.
- **Chain anchoring.** Mid-slot regen chains off the *original* morning brief for the same day, not the previous in-slot regen. If this is wrong, drift compounds across a single slot.
- **Allow-list for Andy-facing activity.** Adding a new `activity_log.kind` does not automatically make it appear in brief event trails. The allow-list at `lib/cockpit/andy-facing-activity.ts` is the single source of truth. This is discipline 69 — important to test in Session B.
- **Rail sort is deterministic.** No LLM involvement. If a chip feels wrong, the fix is in the *source spec's* `getWaitingItems()` urgency classification, not in the cockpit's merge.
- **No chip dismissal, no chip snooze.** The rail is derived. A chip clears when the underlying source state no longer returns it. Resist adding snooze — Andy's own feedback on Q2 (option B — "waiting on Andy") made this a design principle.
- **Fleet chips fold into the main rail with a `[Fleet]` tag.** They do not get their own band. At scale (hundreds of subscribers, multiple fleet fires), the rail cap + sort handles overflow. Re-visit rail-sort weighting only if real-world usage shows fleet chips drowning Andy's own work.
- **System-health banner strip is conditional.** On a healthy day, it does not render at all — not even an "all systems healthy" placeholder. Read-only info tiles were explicitly rejected by SCOPE.
- **Calendar preview shows today only on both desktop and mobile.** Tomorrow's calendar lives in the evening brief prose.
- **Quiet-slot skip is pre-check, not post-hoc.** Do not generate a brief and discard it. Check the three conditions before calling Opus.
- **The content mini-session is voice-critical.** Without tuned prompts, the brief becomes "Good morning, you have 3 items waiting." and the feature loses its signature. Mini-session must run before Sessions A + B.
- **Brand DNA is SuperBad's own, not a client's.** The cockpit is Andy's view of his own business. SuperBad's Brand DNA profile is injected as the "company" Brand DNA context. Client Context Engine reads are *not* injected into briefs.
- **Observability contract for cockpit-brief calls.** Every `cockpit-brief` Opus call logs `{job: 'cockpit-brief', actor_type: 'internal', actor_id: null, units: tokens_used, estimated_cost_aud, timestamp}` per the Foundations §11 patch owed. Before the patch lands, logs nothing; not blocking.
- **No cockpit-originated push notifications.** The shared notification dispatcher handles interrupts at the event source (locked in Unified Inbox spec). The cockpit is the ambient state.
- **Early skeleton beats late polish.** Ship Sessions A + stubbed C early in Phase 5 so the `getWaitingItems()` + `getHealthBanners()` + `maybeRegenerateBrief()` contracts are live when downstream specs land. Retrofitting these contracts after everything is built is far more expensive.

---

## 13. Backlog state

**Phase 3 spec backlog: 18 total, 15 locked + 1 pre-written, 3 remaining.**

Locked: Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel, Quote Builder, Branded Invoicing, Surprise & Delight (pre-written), Task Manager, Brand DNA Assessment, Onboarding + Segmentation, Client Context Engine, Client Management, SaaS Subscription Billing, Content Engine, Unified Inbox, **Daily Cockpit** (this session).

Remaining: Setup Wizards (#13), Hiring Pipeline (#14), Finance Dashboard (#17), Cost & Usage Observatory (#18).

Next recommended: **Cost & Usage Observatory (#18)** — closes Daily Cockpit's cost-anomaly banner dependency and establishes external-call observability primitive before Phase 4.

---

**End of handoff.**
