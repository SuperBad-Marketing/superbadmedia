# Spec — Client Monthly Plan

**Phase 3 backlog spec. Locked 2026-04-18. 8 questions resolved.**

A client-facing monthly deliverables view that shows retainer clients what SuperBad is delivering for them this calendar month, and the admin workflow behind it: Claude-suggested plans, chat-based editing, batch approval, and a graduated handoff from Andy-driven to Claude-drafted over the first 2–3 months per client.

This is a v1.1 feature. It depends on v1.0 data being live: `client_deliverable` tasks in Task Manager, Brand DNA profiles, Client Context Engine summaries, and the six-week plan (for trial-shoot converts). It does not ship in Phase 5.

Governing memories: `feedback_individual_feel.md`, `feedback_setup_is_hand_held.md`, `project_two_perpetual_contexts.md`, `project_brand_dna_as_perpetual_context.md`, `project_six_week_plan_is_the_retainer_plan.md`, `feedback_no_lite_on_client_facing.md`, `feedback_motion_is_universal.md`.

**All client-facing surfaces say "SuperBad", never "SuperBad Lite."**

---

## 1. The 8 locks (quick-reference table)

| # | Decision | Lock |
|---|----------|------|
| Q1 | Plan generation source | Claude-suggested from Brand DNA + Client Context + last month's actuals, with manual add/remove override. Graduated autonomy: Andy provides real substance for months 1–3, Claude drafts from that pattern from month 4+. |
| Q2 | Generation timing | Fixed date: 25th of the prior month. Approval batched across 2–3 days (25th–27th) via cockpit. All plans use calendar months. |
| Q3 | Client view before approval | Previous month stays visible until the new plan is approved. No "coming soon" teaser. 90-day rolling history of past plans accessible to the client. Auto-archived after 90 days. |
| Q4 | Client-facing statuses | Four statuses: Planned / In Progress / Ready for You / Done. Internal Task Manager statuses mapped to these four. |
| Q5 | Delay communication | Bartender acknowledges delay in next opening line + subtle "updated" indicator on the plan item with original date on tap. |
| Q6 | Client role in planning | View + request via bartender. Bartender understands plan-related requests and routes them to Andy as structured plan-change requests. No direct edit UI for the client. |
| Q7 | Admin interaction surface | Client profile Plan tab as primary surface + temporary cockpit batch review during approval window (25th–27th). Batch review disappears when all plans are approved. |
| Q8 | Six-week plan relationship | Six-week plan slices into the first ~1.5 monthly plans. Each slice reviewed and amended by Andy before going live. From month 2–3 onward, Claude drafts with Andy's heavy input. Month 4+, Claude drafts from accumulated pattern. |

---

## 2. End-to-end journey

### 2.1 Plan generation (25th of each month)

A `monthly_plan_generate` scheduled task fires on the 25th for every company with an active retainer deal (`deals.stage = 'won' AND won_outcome = 'retainer'`).

**Generation prompt inputs (per client):**
- SuperBad's Brand DNA profile (voice)
- Client's Brand DNA profile (personalisation + brand context)
- Client Context Engine `assembleContext()` summary
- Last month's plan: what was approved, what delivered, what delayed, what the client requested via bartender
- Last month's `client_deliverable` task outcomes (status, approval feedback, rejection notes)
- Retainer package definition from the accepted quote (scope, value, deliverable types)
- Andy's historical plan edits for this client (the "learning signal" — what Andy added, removed, or rewrote in previous months)
- Six-week plan content (if within the first 1.5 months of the retainer)

**Output:** A `monthly_plans` row with status `draft`, containing structured deliverables (title, description, suggested due date, suggested status mapping) as JSON.

**Graduated autonomy model:**

| Client month | Generation behaviour | Andy's role |
|---|---|---|
| 1–1.5 (six-week plan converts) | Claude slices the six-week plan into calendar-month chunks | Review, amend each slice |
| 1 (direct/referral, no six-week plan) | Claude generates a thin skeleton from Brand DNA + retainer package | Heavy input — Andy builds the real plan via chat |
| 2–3 | Claude drafts from Brand DNA + Client Context + last month's actuals + Andy's prior edits | Andy provides substance via chat, Claude structures it |
| 4+ | Claude drafts a full plan from accumulated context + pattern of Andy's approvals | Andy tweaks ~20%, approves |

The prompt explicitly tells Claude its confidence level: "This is month 2 for this client. Andy has approved one prior plan. Weight Andy's prior edits heavily — replicate their shape, not just their content."

### 2.2 Admin review (25th–27th)

**Cockpit integration:**
- On the 25th, a waiting-item chip appears on the attention rail: "5 monthly plans to review". Links to the batch review surface.
- Morning brief narrative references it: "Monthly plans are ready — 5 clients to review."

**Batch review surface** (temporary route at `/lite/plans/review`):
- Renders only when at least one `monthly_plans` row has status `draft` or `in_review`.
- Card-per-client layout. Each card shows: client name, Claude's draft as a list of proposed deliverables, suggested dates.
- **Chat box at the bottom of each card.** Andy types what he wants in plain language: "Two reels, a GBP update, and let's start her email sequence. Reels by the 10th, rest mid-month." Claude restructures into deliverables with dates. Andy approves or chats again.
- Three actions per card: **Approve** (plan goes to `approved`), **Edit** (opens chat interaction), **Skip** (come back later).
- Card count badge: "3 of 8 approved" — progress visible.
- When all plans approved, the batch review surface auto-redirects to cockpit.

**Client profile Plan tab** (persistent):
- Shows the current month's plan (draft or approved) with the same chat-based editing interface.
- Historical plans (last 90 days) in a collapsible section below.
- Available year-round, not just during the review window.

### 2.3 Chat-based plan editing

The chat input on the plan review card and the client profile Plan tab connects to a dedicated Claude job.

**Flow:**
1. Andy types natural language: "Two reels, a GBP update, and let's start her email sequence. Reels by the 10th, rest mid-month."
2. Claude reads: current draft + Brand DNA + Client Context + Andy's calendar/workload + retainer package scope.
3. Claude responds with structured deliverables: title, description, suggested due date, linked to the client.
4. Andy sees the restructured plan inline. Can chat again ("swap the GBP for a third reel actually") or approve.
5. Each chat exchange is logged as plan edit history (the "learning signal" for future months).

**Prompt instruction:** "Structure Andy's input into client deliverables. Use the retainer package scope to validate feasibility. Suggest dates based on Andy's existing task load for this month. If Andy's request exceeds the retainer scope, note it neutrally — don't refuse, just flag: 'That's 6 deliverables against a 4-deliverable retainer. All good?' Andy decides."

### 2.4 Plan goes live (1st of the month)

On approval, the plan's deliverables are written as `client_deliverable` tasks in the Task Manager with:
- `kind = 'client_deliverable'`
- `entity_type = 'company'`, `entity_id` = client's company ID
- `due_at` = the date Andy approved or Claude suggested
- `status = 'todo'` (maps to client-facing "Planned")
- `source_monthly_plan_id` = FK to the `monthly_plans` row

The plan becomes visible to the client on their portal on the 1st of the month (or immediately if approved after the 1st). The previous month's plan moves to history.

If Andy hasn't approved by the 1st, the previous month's plan stays visible to the client. No auto-publish of unapproved drafts.

### 2.5 Through the month

As Andy works on deliverables, Task Manager status changes flow through to the client's monthly plan view:

| Task Manager status | Client-facing status | Trigger |
|---|---|---|
| `todo` | **Planned** | Default on plan publish |
| `in_progress`, `blocked`, `in_review` | **In Progress** | Andy moves task to any active status |
| `awaiting_approval` | **Ready for You** | Andy sends for client approval |
| `delivered`, `done` | **Done** | Client approves or Andy marks complete |

**Delay handling:** When a `client_deliverable` task's `due_at` is updated to a later date, the system:
1. Records the original date on the `monthly_plan_items` row (`original_due_at`).
2. Sets `date_updated_at` timestamp.
3. Flags the bartender's next opening line prompt with: "The [deliverable title] due date moved from [original] to [new]. Acknowledge naturally."
4. The plan item shows a subtle "updated" indicator next to the new date. Tapping it shows: "Originally [date]".

### 2.6 Client portal view

**Location:** New "Your Month" section accessible via the portal menu overlay, between Deliverables and Invoices.

**Layout:** Calendar-month header (e.g. "May 2026") with deliverables laid out in a clean timeline — not a literal calendar grid, but a vertical list grouped by week, with dates on the left and deliverable cards on the right. Each card shows title, client-facing status badge, and due date.

**Status badges:**
- **Planned** — neutral/muted style
- **In Progress** — brand pink accent
- **Ready for You** — brand red accent + subtle pulse (this one needs their attention)
- **Done** — check icon, muted

**Month navigation:** Left/right arrows to browse the 90-day history. Forward arrow disabled (no future months visible until approved). Current month is the default view.

**Empty state:** If no plan exists for the current month yet (Andy hasn't approved), the client sees: "We're putting together your plan for [Month]. It'll be here soon." — bartender voice, not clinical.

**Bartender awareness:** The bartender chat reads the current monthly plan. Clients can ask: "What's left this month?", "When's the newsletter due?", "Can we add a reel?" — the bartender answers from plan data or escalates change requests per Q6.

### 2.7 Six-week plan slicing (first 1.5 months)

When a trial-shoot client converts to a retainer, the six-week plan exists as a narrative document in `six_week_plans`. The first monthly plan generation reads it directly.

**Month 1 generation:** Claude slices weeks 1–4 of the six-week plan into deliverables with dates. The prompt reads the full plan narrative + Brand DNA + Client Context and decomposes prose into discrete, datable tasks.

**Month 2 generation:** Claude slices weeks 5–6 into the first ~2 weeks, then fills the remaining 2 weeks with new suggestions based on Brand DNA + Client Context + month 1 actuals.

Both slices go through Andy's review/amend flow. He can rewrite entirely — the six-week plan is a starting point, not a constraint.

**Direct/referral clients (no six-week plan):** Month 1 gets a thin skeleton generated from Brand DNA + retainer package. Andy builds the real plan via chat. System stores what Andy approved as the baseline for month 2+.

---

## 3. Data model

### 3.1 New table: `monthly_plans`

```
id                      text primary key (ulid)
company_id              text not null (FK → companies.id)
deal_id                 text not null (FK → deals.id)
month_year              text not null (e.g. '2026-05')
status                  text not null ('draft' | 'in_review' | 'approved' | 'archived')
generated_at            timestamp not null
approved_at             timestamp nullable
approved_by             text nullable (FK → users.id)
generation_context      json not null (snapshot of inputs: Brand DNA version, context hash, prior plan id)
generation_model        text not null (resolved model id)
generation_prompt_hash  text not null
client_month_number     integer not null (1 = first retainer month; used for graduated autonomy)
source_six_week_plan_id text nullable (FK �� six_week_plans.id, non-null for months 1–2 of converts)
archived_at             timestamp nullable
created_at              timestamp not null default now()
updated_at              timestamp not null default now()

unique (company_id, month_year)
```

### 3.2 New table: `monthly_plan_items`

```
id                      text primary key (ulid)
monthly_plan_id         text not null (FK → monthly_plans.id)
task_id                 text nullable (FK → tasks.id, set on plan approval when tasks are created)
title                   text not null
description             text nullable
suggested_due_at        timestamp not null
original_due_at         timestamp nullable (set when due_at is updated post-approval)
date_updated_at         timestamp nullable
sort_order              integer not null
created_at              timestamp not null default now()
updated_at              timestamp not null default now()
```

### 3.3 New table: `monthly_plan_edits`

Captures Andy's chat-based editing history as the learning signal for future plan generation.

```
id                      text primary key (ulid)
monthly_plan_id         text not null (FK → monthly_plans.id)
edit_type               text not null ('chat_input' | 'add_item' | 'remove_item' | 'modify_item' | 'approve')
raw_input               text nullable (Andy's natural language input for chat_input type)
structured_output       json nullable (Claude's structured response)
model_version           text nullable
created_at              timestamp not null default now()
```

### 3.4 No new columns on existing tables

Monthly plans reference existing tables via FKs. Task Manager tasks gain a `source_monthly_plan_id` column:

- `tasks.source_monthly_plan_id` — text nullable, FK → `monthly_plans.id`. Set when a `client_deliverable` task is created from an approved monthly plan. Null for tasks created outside the monthly plan flow.

### 3.5 90-day archive

A `monthly_plan_archive` scheduled task runs on the 1st of each month. Plans where `month_year` is older than 90 days transition to `status = 'archived'`. Archived plans are excluded from the client portal month navigation. Tasks created from archived plans are unaffected — they persist in Task Manager independently.

---

## 4. Client portal surface

### 4.1 Menu addition

New entry in the portal menu overlay (§10.6 of client-management.md): **Your Month**, positioned between Chat and Deliverables.

### 4.2 Layout

**Desktop (>768px):**
- Month header: "May 2026" in Black Han Sans, left-aligned.
- Month navigation: subtle left/right arrows beside the header. Right arrow disabled on current month if no future plan exists.
- Week groups: "Week 1 (May 1–7)" as a Righteous label, then deliverable cards below.
- Deliverable card: title (DM Sans 600), status badge, due date. Tap opens a detail view with description + approval action (if status = Ready for You).

**Mobile (<768px):**
- Same vertical layout, full-width cards.
- Month navigation via swipe (with arrow fallback).

**Motion:** Cards stagger in on month load (house spring, ≤ spring ceiling). Status badge transitions animate on real-time push updates. Month-to-month navigation slides left/right.

### 4.3 Status badge styles

| Status | Background | Text | Accent |
|---|---|---|---|
| Planned | `neutral-700` | `neutral-400` | — |
| In Progress | `rgba(244, 160, 176, 0.1)` | `brand-pink` | — |
| Ready for You | `rgba(178, 40, 72, 0.12)` | `brand-red` | subtle pulse animation |
| Done | `neutral-700` | `neutral-500` | check icon |

### 4.4 Empty states

- **No plan yet:** "We're putting together your plan for [Month]. It'll be here soon." (bartender voice)
- **All items done:** "Everything's delivered. Not bad for a [Month]." (bartender voice)
- **History month with no items:** should not occur (archived plans retain their items for display)

### 4.5 Browser tab title

"SuperBad — your month" (claimed from sprinkle bank).

---

## 5. Admin surface

### 5.1 Client profile Plan tab

New tab on the client profile at `/lite/clients/[id]`, alongside Overview, Tasks, Comms, etc.

**Layout:**
- Current month's plan at the top: list of deliverable items with internal statuses (full Task Manager status, not the client-facing mapping).
- Chat input at the bottom for plan editing (same interface as batch review).
- "Approve" button when plan is in `draft` or `in_review` status.
- Historical plans below in a collapsible accordion (last 90 days).
- Plan metadata: generated date, client month number, generation source (six-week plan / Claude draft / Andy-built).

### 5.2 Batch review surface

**Route:** `/lite/plans/review`

**Visibility:** only renders when `monthly_plans` rows with status `draft` or `in_review` exist. Otherwise redirects to cockpit.

**Layout:**
- Progress bar: "3 of 8 plans approved"
- Card stack: one card per client with unapproved plan.
- Each card: client name (linked to profile), company name, client month number badge ("Month 2"), Claude's proposed deliverables list.
- Chat input per card.
- Three buttons: Approve / Edit (focuses chat input) / Skip (next card).
- Keyboard: Enter to send chat, Tab to skip to next card (mouse-first, keyboard as bonus).

**Cockpit integration:**
- Waiting-item chip: "N monthly plans to review" — links to `/lite/plans/review`.
- Morning brief: "Monthly plans are ready — N clients to review" (25th–27th).
- Health banner: none (unapproved plans are attention, not system health).

---

## 6. Claude primitives

### 6.1 New LLM jobs

| Job key | Model | Purpose |
|---|---|---|
| `monthly-plan-generate` | Opus | Generate monthly plan draft from Brand DNA + Client Context + prior plan history |
| `monthly-plan-restructure` | Opus | Restructure Andy's natural-language chat input into deliverables with dates |
| `monthly-plan-slice-six-week` | Opus | Decompose six-week plan narrative into calendar-month deliverable chunks |

All three jobs read both perpetual contexts (Brand DNA + Client Context) per `project_two_perpetual_contexts.md`.

### 6.2 Prompt files

- `lib/ai/prompts/monthly-plan-generate.ts`
- `lib/ai/prompts/monthly-plan-restructure.ts`
- `lib/ai/prompts/monthly-plan-slice-six-week.ts`

### 6.3 Bartender integration

Portal bartender (Prompt 2 in client-management.md §10.4) gains a new context input: current monthly plan data. The bartender can:
- Answer questions about the plan ("What's left this month?", "When's the newsletter due?")
- Route change requests as structured plan-change escalations to Andy
- Acknowledge delays naturally when `date_updated_at` is set on a plan item

Prompt update owed on `lib/ai/prompts/portal-bartender-chat.ts`.

---

## 7. Scheduled tasks

| Task type | Fires | Handler |
|---|---|---|
| `monthly_plan_generate` | 25th of each month, 06:00 AEST | Generates draft plans for all active retainer companies. One `monthly_plans` row per company. |
| `monthly_plan_review_nudge` | 27th of each month, 08:00 AEST | If unapproved plans remain, cockpit attention chip escalates: "2 plans still need review." |
| `monthly_plan_archive` | 1st of each month, 02:00 AEST | Archives plans older than 90 days. |

---

## 8. Activity log additions

| Kind | Fires when |
|---|---|
| `monthly_plan_generated` | Draft plan created by scheduled task |
| `monthly_plan_edited` | Andy edits via chat or manual add/remove |
| `monthly_plan_approved` | Andy approves a plan |
| `monthly_plan_published` | Approved plan becomes visible to client (1st of month or on approval if after 1st) |
| `monthly_plan_change_requested` | Client requests a change via bartender |
| `monthly_plan_archived` | Plan archived after 90 days |

---

## 9. Settings keys

| Key | Default | Type | Description |
|---|---|---|---|
| `monthly_plan.generation_day` | `25` | int | Day of month to generate draft plans |
| `monthly_plan.review_nudge_day` | `27` | int | Day of month to nudge Andy about unapproved plans |
| `monthly_plan.archive_days` | `90` | int | Days after which completed plans are archived from client view |
| `monthly_plan.graduated_autonomy_threshold` | `3` | int | Number of Andy-approved plans before Claude drafts with full autonomy |

---

## 10. Voice & delight treatment

### 10.1 Sprinkle claim

**Browser tab title** on client portal plan view: "SuperBad — your month". Marked `[CLAIMED by client-monthly-plan]` in `docs/candidates/sprinkle-bank.md`.

### 10.2 Ambient voice surfaces

- Empty-state copy on the client portal plan view (bartender register).
- All-done state copy (bartender register, dry).
- Batch review surface empty state when all plans are approved ("All done. Go do something else.").

### 10.3 Hidden eggs

**None claimed.** Onboarding-adjacent surfaces suppress hidden eggs per established convention.

### 10.4 Motion

- Plan item cards stagger in on month load (house spring, Tier-2 candidate).
- Status badge transitions animate on real-time updates.
- Month-to-month navigation slides with house spring.
- "Ready for You" badge has a subtle pulse (shared with existing approval pulse pattern).

---

## 11. Cross-spec contracts

### 11.1 Patches owed

- **`client-management.md` §10.6** — add "Your Month" to portal menu overlay, between Chat and Deliverables.
- **`client-management.md` §10.4 Prompt 2** — bartender chat gains monthly plan context input.
- **`task-manager.md` §4** — add `source_monthly_plan_id` column to tasks table.
- **`daily-cockpit.md` `getWaitingItems()`** — add `monthly_plan_review` waiting-item kind.
- **`cost-usage-observatory.md` §4.2** — register 3 new LLM jobs.
- **`docs/settings-registry.md`** — add 4 new keys from §9.
- **`six-week-plan-generator.md`** — note that monthly plan consumes six-week plan data for first 1.5 months on retainer conversion.

### 11.2 Dependencies (must be live before this feature)

- Task Manager with `client_deliverable` kind
- Brand DNA Assessment (profiles exist)
- Client Context Engine (`assembleContext()` operational)
- Client portal with bartender chat
- Six-Week Plan Generator (for trial-shoot converts)
- Daily Cockpit with `getWaitingItems()` contract

---

## 12. Content mini-session owed

Small creative session producing:
- Empty-state copy variants for client portal plan view (~6, bartender register)
- All-done state copy variants (~6, bartender register, dry)
- Batch review surface admin copy (terse)
- Delay acknowledgement templates for bartender opening line (~8 variants)
- Plan-change-request structured escalation format

---

## 13. Scope boundaries

### In scope
- Monthly deliverables plan for retainer clients
- Claude-suggested generation with graduated autonomy
- Chat-based admin editing
- Client portal "Your Month" view with 90-day history
- Six-week plan slicing for trial-shoot converts
- Delay communication via bartender + visual indicator
- Plan change requests via bartender

### Out of scope
- SaaS subscriber monthly plans (retainer clients only in v1.1)
- Recurring auto-generation without any approval (Andy always approves)
- Client direct-edit of plans
- Integration with Strategic Planning feature (separate v1.1+ feature)
- Budget/cost tracking per plan item
- Multi-month forward planning ("Q3 plan")
