# Spec — Daily Cockpit

**Phase 3 spec. Locked 2026-04-13.**

> **Prompt files:** `lib/ai/prompts/daily-cockpit.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

The operator's morning surface. The page Andy sees when he opens `/lite`. Mostly an aggregation layer over every locked spec — no new primitives unless the job genuinely calls for one. The cockpit's job is to tell Andy what's waiting, narrate the state of the business in SuperBad's voice, and keep the planning board one click away.

Locked column rules for Must Do / Should Do / If Time live in `docs/specs/task-manager.md`. Cockpit inherits and does not re-derive. `getSignalsForAllContacts()` lives in `docs/specs/client-context-engine.md`. Inbox aggregates come from `docs/specs/unified-inbox.md`. Cockpit composes; it does not duplicate.

---

## Purpose

Andy opens Lite in the morning and needs three things in the first 30 seconds:

1. **A clear picture of the state of the business**, written for today, in a voice that sounds like him.
2. **A list of things waiting on him** — tactile, tap-to-act, sorted by urgency.
3. **A path into the day's planning work** (tasks kanban / list) without mandatory planning gestures if he just wants to crack on.

The cockpit is also the mid-day check-in and end-of-day wrap surface — three briefs a day, chained, so SuperBad's voice watches the day unfold with him.

---

## Scope boundaries (locked)

**In scope:**
- Three daily narrative briefs (morning / midday / evening) with chained continuity and event trail
- Material-event-triggered brief regeneration (debounced)
- Attention rail: up to 6 chips of "waiting on Andy" work, derived live from every locked spec's `getWaitingItems()` contract; overflow via `+N more` chip → `/lite/waiting` screen
- Fleet-scoped chips folded into the same rail with a small `[Fleet]` tag when firing; no dedicated Fleet band
- Conditional system-health banner strip (≤2 banners, overflow to `/lite/health`)
- Calendar preview band (today's events; tomorrow's handled in the evening brief prose)
- Kanban / list switchable view below, inheriting Task Manager's locked column rules
- Mobile PWA layout: vertical stack, horizontal-scroll rail, tabbed kanban (Must Do / Should Do / If Time), list toggle
- `/lite/waiting` overflow screen (flat list view of the same `getWaitingItems()` union)
- `/lite/health` system-health detail screen (banner deep-dives)
- Voice & delight surfaces: browser tab title, signed-in admin greeting line, quiet-morning fallback lines

**Out of scope for v1:**
- Per-user cockpit layout customisation (single operator, single canonical layout)
- Attention rail chip dismissal or snooze (rail is purely derived; resolving the underlying state is the only way to clear a chip)
- Cockpit-originated push notifications (the shared notification dispatcher handles interrupts at the event source; cockpit is the ambient state)
- A "fleet dashboard" rolled into the cockpit (fleet operations live on `/lite/fleet`, locked under Content Engine / SaaS Billing surfaces)
- Read-only informational tiles (revenue totals, pipeline value, subscriber count grids) — these belong on their home screens; cockpit surfaces what's *actionable* or *narrative*
- Daily / weekly / monthly toggles (the cockpit is a *today* surface; history is elsewhere)
- User-editable brief (Andy can't edit generated prose; regen it or don't read it)
- Manual trigger for brief regeneration in v1 (event-triggered + cron only; a "regenerate" button is a v1.1 affordance if the need emerges)

---

## Layout (desktop)

Top to bottom, single column, fixed max width (matches Lite's design-system baseline container):

1. **Signed-in admin greeting line** — small grey line above the brief. Rotation pool (content mini-session). Examples: "Morning. Here's what's going." / "You're back. Okay." / "Afternoon."
2. **Narrative brief** — 2–3 sentences, SuperBad voice, reflects the current time-of-day slot (morning / midday / evening). Linked entities inside the prose are clickable (e.g. "Acme's invoice is five days past due" links to the invoice).
3. **Attention rail** — horizontal row of up to 6 chips. Each chip: an entity-typed label (e.g. "Quote for Acme expires today", "Intro Funnel reply — Riley", "Subscription failed — Belle Bakery") and a tap target. Sort order: time-sensitive first by deadline ascending, then non-deadline by age-of-wait descending. Fleet-scoped chips carry a `[Fleet]` tag. A final `+N more` chip appears when the union exceeds 6, linking to `/lite/waiting`.
4. **Banner strip** — conditional, only renders when at least one banner is firing. Up to 2 visible; overflow collapses to `+N more issues` → `/lite/health`. Banner sources: Graph API subscription lapsed, domain verification failed at fleet level, cost anomaly detected by Finance Dashboard, external-call observability anomalies. Each banner is a single-line summary + tap-through.
5. **Calendar preview** — single row showing today's events (shoots, meetings, material bookings) in time order. Empty state is a short dry line from the content mini-session. Tap-through to the full calendar at `/lite/calendar`.
6. **Planning view** — kanban (Must Do / Should Do / If Time) by default; list view toggle at top-right of this region. Kanban rules locked in `task-manager.md §3`. This spec does not re-derive column rules.

No right-hand sidebar. No "briefing notes" column. No tile grid of revenue / pipeline / subscriber counts.

## Layout (mobile / PWA)

Vertical stack, single column, 375px+ responsive. Same zones in the same order:

1. Greeting line
2. Narrative brief (larger body type than chrome)
3. Attention rail (horizontal swipe; same cap 6 + `+N more` rule)
4. Banner strip (stacks vertically if multiple fire)
5. Calendar preview (today only; no tomorrow strip)
6. Planning area: kanban with a three-tab selector across the top (Must Do `4` / Should Do `7` / If Time `2`, counts visible). One column visible at a time. Swipe between tabs with the house motion spring. List toggle is a small icon at the top-right of the kanban area.

PWA cockpit is the default route post-install. Home-screen install prompt appears on the cockpit's first visit after a user accepts Web Push permission on the Inbox setup wizard.

---

## Three daily briefs

### Slots

| Slot | Fires at (Melbourne) | Purpose |
|---|---|---|
| `morning` | 06:00 | Orientation — state of the business, what today looks like |
| `midday` | 12:00 | Progress check — what's moved, what's stuck |
| `evening` | 18:30 | Wrap + tomorrow preview — how the day closed, what tomorrow holds |

Each slot caches one brief per day in `cockpit_briefs`. The cockpit reads *the most recent successful brief for the current time-of-day slot*. Slot boundaries (12:00, 18:30, 06:00 next day) determine which row the cockpit renders. If a new slot's cron hasn't run yet (e.g. Andy opens Lite at 12:01), the previous slot's brief stays rendered until the new one lands — no loading state.

### Chained continuity with event trail

Each brief's prompt is chained off the prior same-day briefs:

- **Morning** prompt reads: current aggregate signals + Brand DNA (Andy's company) + today's calendar events + anything time-sensitive today.
- **Midday** prompt reads: morning brief prose + compact event log since 06:00 + current aggregate signals.
- **Evening** prompt reads: morning brief prose + midday brief prose + expanded event log since 06:00 + tomorrow's calendar + tomorrow's scheduled_tasks + anything due tomorrow.

Each prompt explicitly instructs: *reference earlier briefs if useful, but don't invent continuity. If nothing meaningful happened since the last brief, say so.* Voice integrity over narrative pressure.

### Event trail

`getAndyFacingActivitySince(timestamp)` returns a compact, deduped, human-readable event log filtered to Andy-facing `activity_log.kind` values. Structured `{type, entity, time}` format. Budget: ~500 tokens for midday, ~1000 for evening. Allow-list of `activity_log.kind` values that qualify as Andy-facing (tasks completed, quotes accepted, invoices paid, subscription state changes, outreach replies, intro funnel bookings, etc.) lives at `lib/cockpit/andy-facing-activity.ts`.

### Material-event regen

A small denylist of "material" events triggers mid-slot brief regeneration through the `scheduled_tasks` primitive (new task type: `cockpit_brief_regenerate`). Regen reads the current slot and replaces its cached brief.

Denylist lives in one place: `lib/cockpit/brief-triggers.ts`. Source specs call `maybeRegenerateBrief(eventKey, payload)`; helper decides whether to enqueue. Initial denylist:

- `subscription_payment_failed`
- `subscription_cancelled`
- `deal_won`
- `deal_lost`
- `invoice_paid_large` (>$1000 AUD threshold; tunable)
- `intro_funnel_booking_confirmed`
- `outreach_reply_positive`
- `content_engine_domain_verification_failed`
- `graph_api_subscription_lapsed`
- `cost_anomaly_detected`

**Debounce:** 10 minutes per slot. If two material events fire within 10 minutes, one regen runs (takes the most recent event's context). Prevents fire-day thrash.

**Chain anchoring:** a mid-slot regen still chains off the *original* morning brief, not the previous in-slot regen. Prevents runaway hallucination chains.

### Quiet-slot skip rule

Each slot's cron checks whether anything is worth saying *before* calling Opus. Quiet-slot rules (all required for skip):

- Zero items in `getWaitingItems()` union
- Zero material events in the event trail since the last slot
- Zero system-health banners firing

On skip, no brief is generated. The cockpit renders a quiet-morning fallback line from the rotation pool (see §Voice & delight treatment). Saves cost; reinforces the voice.

### Fire-day behaviour

No ceiling on brief length from the prompt — voice stays 2–3 sentences even when 20 things are on fire. The brief *names* what matters most and *defers detail to the rail*. Example fire-day evening: "You held the line today. Three subs cancelled, but Belle signed; the shoot on Thursday is still on. Tomorrow's a ride." The rail carries the tactile chips; the brief carries the narrative.

### Model + job key

- **Model:** Opus, routed via the LLM model registry (per `project_llm_model_registry`) under job key `cockpit-brief`. Slot is passed as a prompt parameter.
- **Prompt templates:** three, per slot. Live at `lib/cockpit/prompts/`. Content mini-session writes them.
- **Perpetual contexts injected:** SuperBad's own Brand DNA profile (treated as the "client" profile for the cockpit's own business). Client Context Engine reads are not injected (the cockpit is Andy's view, not a per-client view).

---

## Attention rail

### Contract

Each locked spec exposes a function returning waiting items:

```
getWaitingItems(userId: string): Promise<WaitingItem[]>

type WaitingItem = {
  id: string                // stable id per source spec
  label: string             // rendered as the chip label
  href: string              // tap-through destination
  urgency: {
    kind: 'time_sensitive' | 'age_of_wait'
    value: number           // deadline timestamp (time_sensitive) or wait-start timestamp (age_of_wait)
  }
  scope: 'own' | 'fleet'
  entity_ref?: {            // optional; enables entity avatar / icon in chip
    type: 'contact' | 'company' | 'deal' | 'subscriber' | 'ticket'
    id: string
  }
  source_spec: string       // e.g. 'quote-builder', 'content-engine'
}
```

Cockpit calls every source's `getWaitingItems()` in parallel on load, merges, sorts, renders top 6 chips + optional `+N more`.

### Source specs contributing chips

Every spec that has items that can be "waiting on Andy":

- **Quote Builder** — quotes awaiting send, expiring within 48h
- **Branded Invoicing** — overdue invoices, invoice generation requiring Andy review
- **SaaS Subscription Billing** — payment failures, card-expiring warnings, upgrade/downgrade queue
- **Unified Inbox** — threads waiting-on-Andy-reply >24h, open support tickets >48h
- **Task Manager** — overdue tasks, approval requests arriving on Andy's review queue
- **Client Management** — portal escalations, deliverable approvals awaiting Andy sign-off
- **Lead Generation** — outreach approval queue items
- **Intro Funnel** — confirmed bookings that still need Andy prep within 24h of shoot, questionnaire submissions awaiting review
- **Brand DNA Assessment** — assessments in-progress where a client is stuck (rare; high-value)
- **Content Engine** — own-company drafts awaiting Andy review; fleet drafts stalled >48h with `scope: 'fleet'`
- **Client Context Engine** — critical relationship signals surfaced by the engine that Andy hasn't acknowledged (rare; high-value — e.g. a decade-long client hasn't been contacted in 90 days)
- **Setup Wizards** (added 2026-04-13 Phase 3.5) — `wizard_completion` chip kind `{ wizardKey, completedBy, subjectName }` surfaced when any of the 5 curated client-facing wizards complete (Brand DNA finished, SaaS onboarding finished, Intro Funnel questionnaire, retainer first portal sign-in, any wizard emitting a human-reply-owed outcome). Chip disappears when Andy acknowledges via tap-through
- **Hiring Pipeline** (added 2026-04-13 Phase 3.5) — seven new source kinds: candidate sourced awaiting approval, invite drafted awaiting send, apply form submission awaiting review, follow-up question reply awaiting review, trial task delivery awaiting review, bench onboarding incomplete, archived Bench member needing rate renegotiation
- **Finance Dashboard** — Finance narrative regeneration pending, tax provisioning alerts (when relevant)

All chips merged into one rail. Sort:

1. Time-sensitive items first, by deadline ascending (soonest deadline first).
2. Age-of-wait items next, by wait-start ascending (longest wait first).
3. Stable tiebreak on `id`.

### Cap + overflow

Rail renders top 6 by the sort above. If union > 6, the final slot becomes a `+N more` chip linking to `/lite/waiting`.

`/lite/waiting` is a flat list view of the full union, same sort order, with the same tap-through behaviour per chip. Minor build cost; ships alongside the rail.

### No dismissal, no snooze

Chips are derived. A chip disappears when the underlying source spec's state no longer returns it from `getWaitingItems()`. Resolution happens at the source (mark a task done, send a quote, reply to a thread). The cockpit does not carry per-chip user state.

Rationale: "waiting on Andy" is an honest state. Hiding a chip without resolving it breaks the trust contract — the cockpit pretends nothing is wrong while something still blocks. If an item feels wrong on the rail (e.g. Andy is actually waiting on the client), the fix is at the source spec level (e.g. mark the quote as "client reviewing" which filters it out of the `getWaitingItems()` return).

---

## System-health banner strip

### Contract

```
getHealthBanners(userId: string): Promise<HealthBanner[]>

type HealthBanner = {
  id: string
  severity: 'warning' | 'critical'
  summary: string           // one line
  href: string              // tap-through to the relevant admin surface
  source: string            // e.g. 'graph_api', 'cost_anomaly'
  first_fired_at: timestamp
}
```

### Source specs contributing banners

- **Unified Inbox** — Graph API subscription lapsed, SendAs permission revoked, import stuck
- **Content Engine** — fleet-wide domain verification failures, Remotion Lambda outage, OpenAI Images rate-limit regression
- **Finance Dashboard / external-call observability** — cost anomaly detected (per-job or per-actor), a subscriber's running cost exceeding their tier revenue
- **SaaS Subscription Billing** — Stripe webhook backlog growing (delivery issues), processor-side critical events
- **Setup Wizards** (added 2026-04-13 Phase 3.5) — `in_flight_admin_wizard` kind `{ wizardKey, lastActiveAt, resumeUrl }` emitted when any admin wizard has been idle ≥ 7 days in `wizard_progress` without completion or abandonment. Resume click-through lands at `resumeUrl`. Threshold lives in settings key `wizards.admin_idle_banner_days` (default 7)
- **Finance Dashboard** (added 2026-04-13 Phase 3.5) — three banner kinds: `finance_bas_due` (BAS filing window approaching), `finance_eofy_due` (EOFY approaching), `finance_invoice_overdue` (one or more client invoices past due). Click-through lands in Finance Dashboard or filtered `/lite/invoices?filter=overdue`
- **Hiring Pipeline** (added 2026-04-13 Phase 3.5) — three banner kinds: `hiring_discovery_cost_anomaly`, `hiring_trial_task_overdue`, `hiring_bench_empty_for_open_role`. Click-through lands at the relevant Hiring Pipeline surface

### Render rule

Renders only when at least one banner is returned. Up to 2 visible; overflow becomes `+N more issues` linking to `/lite/health` (a list of all active banners with deeper summaries).

### Graceful degradation

Before Finance Dashboard ships, `getHealthBanners()` from that source returns an empty array. The strip still works with the remaining sources. Cockpit never crashes on an unimplemented source.

---

## Calendar preview

Reads from the native Lite calendar — locked as Andy's only calendar per `project_client_shoot_bookings`. Returns today's events in time order: shoots, client meetings, material shootings/bookings, any admin events Andy has manually added.

- Desktop: single row, inline icons per event type, compact.
- Mobile: single row under the banner strip, today only.

Tap-through to `/lite/calendar` (full month / week views, handled by the calendar feature — not this spec).

Tomorrow's calendar lives in the evening brief prose ("big shoot day tomorrow" / "looks quiet"). Not on the today-surface.

Empty-state copy: content mini-session.

---

## Planning view (kanban + list)

Pure read-through of Task Manager's locked column rules.

- **Kanban** — three columns: Must Do / Should Do / If Time. Column assignment is determined by Task Manager's column-rule logic; cockpit does not re-derive.
- **List** — flat list of the same tasks, sorted by due date ascending, tiebreak priority descending.
- **Toggle** — top-right of the planning region. Persists per-user via localStorage.

No create-task affordance on the cockpit — Andy uses the global Braindump button (locked in Task Manager §Surface 2) or navigates to `/lite/tasks`.

No task state-change affordances on the cockpit kanban in v1 — clicking a task card takes Andy to the task detail drawer on `/lite/tasks`. Avoids coupling the cockpit to task state mutation.

---

## Data model

### New table: `cockpit_briefs`

```
id                text primary key (ulid)
user_id           text not null (FK → users.id — single-operator v1, scaffolded for multi-tenant)
slot              text not null ('morning' | 'midday' | 'evening')
brief_date        date not null (Melbourne local date the brief belongs to; morning 2026-04-13 = 06:00 AEST on 13th)
generated_at      timestamp not null default now()
trigger           text not null ('cron' | 'material_event')
trigger_event     text nullable (event key from the denylist if trigger='material_event')
prose             text not null (the 2–3 sentence brief)
signals_snapshot  json not null (the input signals the brief saw — for regen diffing + debugging)
model_version     text not null (resolved model id at time of generation, for audit)
created_at        timestamp not null default now()

unique (user_id, slot, brief_date)
```

The `unique (user_id, slot, brief_date)` constraint means a mid-slot regen *updates* the row for that (user, slot, date) — it does not append a new row. Regen overwrites, but `signals_snapshot` and the previous `prose` are captured in the `activity_log` entry so history is recoverable for debugging.

Indexes: `(user_id, brief_date DESC)` for cockpit reads.

### No new columns on existing tables

Cockpit reads through contracts (`getWaitingItems()`, `getHealthBanners()`). Source specs own their data.

### `activity_log.kind` additions (~8)

- `cockpit_brief_generated` — one per slot per day, includes slot + trigger
- `cockpit_brief_regenerated` — regen event; previous prose captured in payload
- `cockpit_brief_skipped_quiet` — quiet-slot skip, includes reason
- `cockpit_waiting_opened` — Andy opened `/lite/waiting` (ambient engagement signal)
- `cockpit_health_opened` — Andy opened `/lite/health`
- `cockpit_chip_tapped` — which chip was tapped (source_spec + entity_ref + chip position in rail); feeds corrections for sort-weight tuning later if needed
- `cockpit_banner_dismissed` — if we ever add a "dismiss" affordance on banners (out of scope for v1 but logged for future)
- `cockpit_slot_rolled_over` — slot boundary crossing, logged once per slot per day for debugging

### `scheduled_tasks.task_type` additions (1)

- `cockpit_brief_regenerate` — payload `{ user_id, slot, trigger_event, material_event_payload }`. Runs through the single Node cron worker (shared primitive from Quote Builder spec). Debounced at enqueue time (10-minute window per slot).

Cron-scheduled brief generation is a separate cron trigger (not via `scheduled_tasks`) — three cron entries (06:00, 12:00, 18:30 Melbourne) hit `generateBriefForSlot(slot)` directly. Scheduled tasks handle the event-driven path only.

---

## Claude primitives (1)

### `cockpit.brief` (Opus)

```
generateBriefForSlot(slot: Slot, opts?: { trigger?: 'cron' | 'material_event', triggerEvent?: string }): Promise<{ prose: string, signalsSnapshot: JSON }>
```

Routed via LLM model registry under job key `cockpit-brief`. Slot passed as prompt parameter. Reads:

- SuperBad's own Brand DNA profile (perpetual context, system-role)
- Current signals (aggregate from `getWaitingItems()` + `getHealthBanners()` + today's calendar + current pipeline state + current subscriber count)
- Slot-specific context:
  - Morning: none (fresh start of day)
  - Midday: today's morning brief prose + compact event log since 06:00
  - Evening: today's morning + midday prose + expanded event log since 06:00 + tomorrow's calendar + tomorrow's scheduled_tasks + anything due tomorrow
- Brand-voice drift check per Foundations §11.5 on output (required for all client-facing or voice-heavy LLM outputs; cockpit brief qualifies as voice-heavy)

Returns the prose + signals snapshot. Caller persists to `cockpit_briefs`.

Three prompt templates live at `lib/cockpit/prompts/{morning,midday,evening}.ts`. Content mini-session writes them.

### Not a separate prompt: quiet-slot fallback

Quiet-slot fallback is *not* an Opus call. It's a rotation pool of ~20 pre-written lines from the content mini-session, selected pseudo-randomly per slot per day with a rolling 14-day no-repeat guarantee per slot. Cheap, consistent voice, lower drift risk.

### Not a separate prompt: signed-in admin greeting

Same as quiet-slot fallback — rotation pool of short lines, selected pseudo-randomly per page load per day with a rolling 7-day no-repeat guarantee. Content mini-session writes ~15–25 lines.

---

## Cross-spec impacts

### Every locked spec — `getWaitingItems()` contract owed

Each of the following specs must expose a `getWaitingItems(userId)` function matching the contract in §Attention rail. This is a small patch to each spec's "Cross-spec impacts" section rather than a structural change.

- Quote Builder
- Branded Invoicing
- SaaS Subscription Billing
- Unified Inbox
- Task Manager
- Client Management
- Lead Generation
- Intro Funnel
- Brand DNA Assessment
- Content Engine
- Client Context Engine
- Six-Week Plan Generator (emits 4 kinds per `docs/specs/six-week-plan-generator.md` §12.2: `six_week_plan_strategy_review`, `six_week_plan_detail_review`, `six_week_plan_revision_request`, `six_week_plan_refresh_review`)

**Phase 3.5 patch owed** — add the `getWaitingItems()` contract + its expected return shape to each spec's integration surfaces. Cockpit build session can stub any source whose spec hasn't been patched in time.

### Every locked spec — `maybeRegenerateBrief(eventKey)` callsite wiring

Source specs that fire one of the material events in the denylist must call `maybeRegenerateBrief(eventKey, payload)` at the point of the state change. The helper owns the debounce logic; source specs just fire the call.

Affected specs:

- SaaS Subscription Billing — `subscription_payment_failed`, `subscription_cancelled`
- Sales Pipeline — `deal_won`, `deal_lost`
- Branded Invoicing — `invoice_paid_large`
- Intro Funnel — `intro_funnel_booking_confirmed`
- Lead Generation — `outreach_reply_positive`
- Content Engine — `content_engine_domain_verification_failed`
- Unified Inbox — `graph_api_subscription_lapsed`
- Finance Dashboard (when specced) — `cost_anomaly_detected`

### Health banner source contracts

Each banner-contributing spec exposes `getHealthBanners(userId)` matching the §System-health banner strip contract. Applies to Unified Inbox, Content Engine, Finance Dashboard, SaaS Subscription Billing, and Six-Week Plan Generator (emits `six_week_plan_retainer_payment_without_refresh_review` per `docs/specs/six-week-plan-generator.md` §12.2; banner payload carries `{ plan_id, client_id, payment_received_at, hours_since_payment, escalation_threshold_hours, severity: 'amber' | 'red' }` and escalates amber → red once `hours_since_payment > escalation_threshold_hours`, threshold sourced from `settings.get('plan.refresh_review_block_escalation_hours')` — per F4.a, 2026-04-13).

### Task Manager — column rules inherited, not re-derived

Task Manager's kanban column logic (Must Do / Should Do / If Time) is the contract. Cockpit calls `getTasksForCockpitKanban(userId)` (exported helper in Task Manager) and renders. No derivation in the cockpit module.

### Unified Inbox — digest surface relationships

The weekly social-DM activity digest (parked from Inbox Q7) lives in the Monday morning brief's prose. Inbox exposes `getWeeklySocialDigestSignal(userId, weekStart)` returning a compact summary (channel counts, high-value replies). The Monday morning brief's prompt checks day-of-week; on Mondays, the signal is included in the prompt input bundle.

The weekly inbox hygiene celebration (locked for Cockpit absorption in the Inbox handoff) works the same way — `getWeeklyInboxHygieneSignal(userId, weekStart)`, included in the Monday morning brief's input bundle, voice-tuned in the content mini-session.

### Surprise & Delight — sprinkle claims + ambient category addition

Cockpit claims from `docs/candidates/sprinkle-bank.md`:

1. Browser tab title on `/lite` (e.g. `Lite — 3 waiting` / `Lite — all quiet` / `Lite — maybe sit down`)
2. Signed-in admin greeting line above the narrative brief

Cockpit proposes a new ambient category for `docs/specs/surprise-and-delight.md`'s closed list: **quiet-slot fallback lines** (a dedicated rotation pool for quiet-brief-skip slots). Closed list grows 6 → 7. Requires a brainstorm gate at the sprinkle-promotion brainstorm already owed — this spec flags the proposal; the brainstorm decides.

Hidden eggs on cockpit: the admin-egg expansion brainstorm is already owed. Cockpit is an expected egg surface. Egg suppression rules: no egg fires during a banner-strip alert or during an in-progress brief regen.

### Foundations — no new patches owed

All shared primitives used by cockpit are already locked:

- `sendEmail()` — not used by cockpit
- `formatTimestamp()` — used extensively for calendar preview, chip labels, banner timestamps
- `logActivity()` — used for the 8 new `activity_log.kind` values
- `generateInVoice()` / brand-voice drift check — used for the brief prose
- `scheduled_tasks` + cron worker — reused for the event-triggered regen task type
- LLM model registry (`lib/ai/models.ts`) — one new job key (`cockpit-brief`)
- External-call observability — applies to the cockpit-brief call site; log `{job: 'cockpit-brief', actor_type: 'internal', actor_id: null, units: tokens_used, estimated_cost_aud, timestamp}`

---

## Voice & delight treatment

**Ambient slots active on cockpit:**

- Browser tab title on `/lite` — claimed
- Signed-in admin greeting line — claimed
- Quiet-slot fallback lines — proposed as new ambient category (closed list 6 → 7, pending sprinkle-promotion brainstorm gate)

**Hidden eggs expected:** yes — admin-egg expansion brainstorm to decide specifics. Cockpit is a primary admin-egg surface.

**Suppression rules on cockpit:**

- No egg fires during a banner-strip alert (something's actually on fire — voice defers).
- No egg fires during an in-progress brief regen (visual state is mid-transition).
- Standard admin-roommate voice applies (max once/month per egg).

**Voice character per slot:**

- Morning brief — orientation, forward-leaning, SuperBad-dry.
- Midday brief — steady, check-in voice, references morning brief if material.
- Evening brief — reflective, slight warmth on a good day, dry acknowledgement on a bad day, always includes a forward glance at tomorrow.

Content mini-session handles the prompt-level voice tuning.

---

## New build-time disciplines

65. **Cockpit has no data of its own beyond briefs.** Attention rail and banner strip are pure read-throughs of source-spec contracts. No caching of `getWaitingItems()` results in the cockpit module itself — source specs may cache internally, but the cockpit always reads current.

66. **Brief regen runs through `scheduled_tasks` with a 10-minute debounce per slot.** Never call `generateBriefForSlot()` directly from a source spec — always via `maybeRegenerateBrief(eventKey, payload)`. Direct calls bypass the debounce and risk fire-day thrash.

67. **Brief chain anchoring.** A mid-slot regen chains off the *original* morning brief, not the previous in-slot regen. Prevents runaway hallucination chains within a single slot.

68. **Quiet-slot skip is a precondition check, not a post-hoc filter.** Check the three quiet-slot conditions *before* calling Opus. Do not generate a brief and then throw it away.

69. **`getAndyFacingActivitySince()` uses an allow-list, not a deny-list.** Adding a new `activity_log.kind` does not automatically make it Andy-facing. The allow-list at `lib/cockpit/andy-facing-activity.ts` is the single source of truth. New kinds default to *not* Andy-facing until explicitly added.

70. **Rail sort is deterministic.** No LLM-triaged priority. No learned weights. If the sort feels wrong, the fix is in the source spec's `getWaitingItems()` urgency classification, not in the cockpit's merge logic.

71. **Source spec contracts are graceful.** Every cockpit read (`getWaitingItems`, `getHealthBanners`, `getWeeklyInboxHygieneSignal`, etc.) returns an empty array / object on failure. Cockpit logs the failure and continues rendering. One broken source spec never breaks the cockpit.

72. **No brief can reference data not in its input signals.** Prompt includes everything the brief can talk about; the brief cannot invent fresh facts. Drift check enforces this at the output-validation layer.

73. **Model version is pinned in `cockpit_briefs.model_version`.** If the registry bumps the model, older briefs are readable but not regenerable without recording the new version.

---

## Success criteria

1. Andy opens `/lite` in the morning, reads a brief written for today in his voice, and taps a chip within 10 seconds if action is needed. If nothing is waiting, he sees "all quiet" and closes the tab with confidence. Replicates for midday and evening.
2. The rail never lies. A chip on the rail is always *currently* waiting on Andy. A chip that disappears is a resolution, not a snooze.
3. Material events during the day update the brief within 15 minutes (10-min debounce + ≤5 min regen latency).
4. Quiet-slot skip correctly fires when the business is genuinely quiet (most weekends), saving cost and reinforcing the voice.
5. Banner strip fires promptly when a system-health issue begins; clears promptly when resolved. No stuck banners.
6. The mobile cockpit is as read-pleasant as the desktop cockpit. Andy can do a full morning glance on a phone before getting up.
7. The evening brief's "tomorrow preview" is actually forward-looking — names the shoot if there is one, flags the quote due tomorrow, says "looks quiet" if not.
8. Fleet chips surface when a fleet-level issue is genuinely blocking Andy, never as ambient fleet state.
9. Source spec contract failures degrade gracefully — the cockpit still renders with whatever sources are healthy.

---

## Non-goals (explicit)

- A pipeline overview on the cockpit. Pipeline lives at `/lite/pipeline`. Cockpit surfaces *actionable* pipeline items via the rail (waiting approvals, expiring quotes), never the full board.
- A subscribers grid on the cockpit. Subscribers live at `/lite/fleet`. Cockpit surfaces actionable fleet items via the rail, never a full grid.
- A revenue tile / MRR tile / count tile on the cockpit. These live on their home screens (Finance Dashboard, Sales Pipeline).
- A "recent activity" feed. The event trail feeds the briefs; Andy doesn't need a raw feed on the cockpit.
- Per-user cockpit layout customisation. Single canonical layout; drift is a bug.
- Chip snooze / dismiss. Resolving the underlying state is the only clearing mechanism.
- Chip re-ordering. Sort is deterministic.
- Manual brief-regenerate button. Cron + material-event regen is enough for v1.
- Reading-mode toggle (focus / dense / minimal). Not a v1 problem.
- A second cockpit tab for a "planning" view (separate from the current switch between kanban and list). Planning is the kanban/list; the current view switcher is enough.
- A cockpit-originated push notification. Notifications live at the event source.

---

## Phase 5 build sessions

5 sessions:

- **A. Briefs — data + morning slot + cron.** `cockpit_briefs` table, cron entry for 06:00 morning brief, `generateBriefForSlot('morning')` pipeline end-to-end, `signals_snapshot` capture, drift check integration. Ships: working morning brief on the default cockpit page. Medium.
- **B. Briefs — midday + evening + event trail + chained continuity + material-event regen.** `getAndyFacingActivitySince()` helper, chained prompt templates for midday + evening, `maybeRegenerateBrief()` helper with debounce, `cockpit_brief_regenerate` scheduled task type, quiet-slot skip logic, fallback rotation pool, signed-in admin greeting rotation pool. Large.
- **C. Attention rail + `/lite/waiting`.** Rail UI, `getWaitingItems()` merge logic, sort implementation, chip components per `source_spec`, `+N more` overflow chip, `/lite/waiting` flat list view. Stubs for any source spec not yet built. Medium.
- **D. Banner strip + calendar preview + `/lite/health`.** `getHealthBanners()` merge, conditional render, banner components, overflow collapse, calendar preview band, `/lite/health` detail view. Small-medium.
- **E. Mobile PWA layout.** Responsive stack, horizontal-scroll rail on mobile, tabbed kanban with house motion spring, list toggle icon, mobile banner stacking, PWA default-route wiring. Medium.

**Sequencing note:** Sessions A + B are the voice-critical sessions and require the content mini-session to have run (prompt templates + rotation pools are mini-session outputs). Sessions C–E can land before the mini-session if they stub copy with placeholders; the content session then backfills.

**Dependency note:** Cockpit is a Phase 5 *middle* build, not a late one. Ship the skeleton early so downstream specs can wire their `getWaitingItems()` / `getHealthBanners()` / `maybeRegenerateBrief()` calls as they land, rather than retrofitting at the end. Early skeleton = A + (stubbed) C.

---

## Content mini-session scope

**Small-medium.** Dedicated creative session with `superbad-brand-voice` + `superbad-visual-identity` + `superbad-business-context` skills loaded.

Produces:

- **Three brief prompt templates** — morning / midday / evening — each with slot-specific voice direction, chaining behaviour, drift-guard language, Brand DNA injection contract, input signal bundle structure.
- **Quiet-slot fallback rotation pool** — ~20 pre-written lines (may stratify by slot — quiet-morning vs quiet-evening vibe differs).
- **Signed-in admin greeting rotation pool** — ~15–25 short lines.
- **Browser tab title voice treatments** — quiet state, normal state, busy state, fire-day state, plus an "all quiet" variant for weekends.
- **Calendar preview empty-state copy** — one dry line for the no-events-today state.
- **`/lite/waiting` empty-state and full-fire-day copy** — two variants.
- **`/lite/health` banner copy per condition** — one line per banner source (Graph API lapsed, domain failed, cost anomaly, Stripe webhook backlog, etc.).
- **Rail chip label conventions** — per source_spec, a label template pattern so chips read consistently (e.g. Quote Builder: `Quote for {company} — expires {relative}`; Invoicing: `{company} invoice — {days} overdue`).

Must run before Phase 5 Sessions A + B (the brief-generating sessions). Sessions C–E can ship with placeholder copy and the mini-session backfills.

---

## Files this spec references

- `docs/specs/task-manager.md` — kanban column rules, Braindump primitive, `getTasksForCockpitKanban()`
- `docs/specs/unified-inbox.md` — messages/threads schema, `getWeeklySocialDigestSignal()`, `getWeeklyInboxHygieneSignal()`, Graph API health banner source
- `docs/specs/client-context-engine.md` — `getSignalsForAllContacts()` (not injected into briefs, but available for cross-linking in rail chips)
- `docs/specs/quote-builder.md` — scheduled_tasks primitive, cron worker, `scope: 'fleet'` conventions
- `docs/specs/branded-invoicing.md` — `maybeRegenerateBrief('invoice_paid_large')` callsite wiring
- `docs/specs/saas-subscription-billing.md` — `maybeRegenerateBrief('subscription_payment_failed')` + `'subscription_cancelled'` callsites, fleet-scoped rail chips
- `docs/specs/content-engine.md` — own-company + fleet rail chips, domain health banner source
- `docs/specs/lead-generation.md` — `maybeRegenerateBrief('outreach_reply_positive')` callsite
- `docs/specs/intro-funnel.md` — `maybeRegenerateBrief('intro_funnel_booking_confirmed')` callsite, booking-prep rail chips
- `docs/specs/brand-dna-assessment.md` — stuck-assessment rail chips (rare)
- `docs/specs/client-management.md` — portal escalation rail chips, deliverable-approval rail chips
- `docs/specs/surprise-and-delight.md` — sprinkle claims + quiet-slot fallback proposal
- `docs/candidates/sprinkle-bank.md` — claimed items

---

## Silent dependencies

- **Native Lite calendar** — the calendar preview band reads from whatever calendar primitive Lite exposes. Locked per `project_client_shoot_bookings` (Andy's only calendar lives in Lite); the calendar's own spec / build is assumed to exist before cockpit Session D ships the preview band. If calendar isn't built yet at Session D time, the band stubs with an empty state.
- **Finance Dashboard** — cost-anomaly banner source depends on Finance Dashboard spec (pending Phase 3). Before it ships, the banner source returns empty; cockpit continues working.
- **`generateInVoice()` / brand-voice drift check** — Foundations §11.5 primitive. Assumed to exist before Session A ships.
- **LLM model registry** (`lib/ai/models.ts`) — Foundations primitive. Must exist before Session A.
- **External-call observability** — Foundations primitive (pending Phase 4 patch). If not yet in place, cockpit brief calls log nothing; not blocking.

---

**End of spec.**
