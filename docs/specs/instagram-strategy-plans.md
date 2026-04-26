# Instagram Strategy Plans

> Locked: 2026-04-26. Owner: Andy Robinson.

Weekly content plans auto-generated from the Instagram strategy engine. Every Sunday evening, each connected Instagram account gets a plan card with 3–5 suggested posts. Andy reviews, tweaks inline, and approves — approved slots become tasks in the Task Manager and surface in the cockpit. Approved tasks link to Content Studio for visual creation.

---

## §1 What This Is

The Instagram spec (`docs/specs/instagram-channel.md` §6) already defines a strategy engine that produces weekly digests with content ideas. This spec adds the layer that turns those ideas into an actionable weekly plan — a card per account per week with post slots Andy reviews and approves before they become tasks.

The loop: strategy digest → content plan → approved tasks → Content Studio → Instagram post → metrics → next digest.

---

## §2 Generation Trigger

### §2.1 Weekly Cadence
Every Sunday at 18:00 Melbourne time (AEST/AEDT), a scheduled task runs for each connected Instagram account with status `"active"`:

1. Generate the weekly strategy digest (existing `instagram-strategy-digest` flow from §6.1 of instagram-channel.md)
2. From the digest's `content_ideas_json`, generate the weekly content plan
3. Store the plan as an `instagram_content_plans` row

### §2.2 Per-Account Plans
One plan per connected account per week. SuperBad's own account reads the self-assessment Brand DNA. Client accounts read their company's Brand DNA + Client Context.

### §2.3 Nudge on Non-Review
If a plan hasn't been reviewed by Tuesday 09:00 Melbourne time, the system adds an attention rail chip to the cockpit: "Instagram plan awaiting review — {account username}". The chip links to the Instagram page with the plan card expanded.

---

## §3 Surfaces

### §3.1 Instagram Dashboard — Plan Card
The weekly plan appears as a card at the top of the Instagram dashboard (`/lite/content/instagram`), above the metrics sections. One card per account if multiple accounts are connected.

**Card structure:**
- **Header:** "This week's plan" + account username + week range (e.g. "Apr 28 – May 4")
- **Status badge:** "Awaiting review" (amber) | "Partially approved" (blue) | "All approved" (green) | "Expired" (grey)
- **Theme/focus line:** one sentence summarising the week's content direction (from the digest's recommendations)
- **Post slots:** 3–5 rows, each containing:
  - Suggested date (day of week + date)
  - Content type badge: carousel / single / reel / story
  - Topic — one-line description of what to post
  - Caption direction — 1–2 sentence hint for the caption
  - Checkbox — checked = approved for task creation
  - Inline edit affordance on topic and caption direction (pencil icon → editable text)
- **Action bar:**
  - "Approve selected" button — creates tasks for all checked slots
  - "Approve all" shortcut — checks all slots then creates tasks

### §3.2 Cockpit Integration
- Attention rail chip when a plan is awaiting review (see §2.3)
- Monday morning cockpit brief can reference the plan: "5 Instagram posts planned this week — review when ready"
- Approved tasks appear in the cockpit planning view like any other task

### §3.3 Task Manager
Approved post slots create tasks with:
- **Title:** "Instagram: {topic}" (e.g. "Instagram: Behind-the-scenes studio tour")
- **Body:** full caption direction + content type + account username
- **Kind:** `admin` (SuperBad's own account) or `client_task` (client accounts)
- **Status:** `todo`
- **Priority:** `normal`
- **Due date:** the suggested post date from the plan slot
- **Entity:** company_id from the instagram_account (if client account)
- **Meta link:** `source_plan_id` and `source_slot_index` stored in the task body for traceability

### §3.4 Task Detail — "Create in Studio" Button
Tasks created from approved plan slots include a "Create in Studio" button. Clicking opens Content Studio (`/lite/content/studio`) with:
- `content_type` pre-selected based on the slot's content type
- Brief text pre-filled with the slot's topic + caption direction
- Source tracking back to the plan

---

## §4 Plan Slot Schema

Each slot in a plan is a JSON object:
```json
{
  "index": 0,
  "suggested_date": "2026-04-28",
  "day_of_week": "Monday",
  "content_type": "carousel",
  "topic": "Behind-the-scenes studio tour — the gear wall and the mess behind it",
  "caption_direction": "Dry observation about the gap between the polished output and the chaos that produces it. Let the image do the heavy lifting.",
  "approved": false,
  "task_id": null
}
```

Content types: `carousel` | `single` | `reel` | `story`

Once approved, `approved` flips to `true` and `task_id` is populated with the created task's ID.

---

## §5 Data Model

### §5.1 `instagram_content_plans` Table
```
id                  TEXT PK
account_id          TEXT FK → instagram_accounts.id NOT NULL
strategy_report_id  TEXT FK → instagram_strategy_reports.id (nullable — links to the digest that seeded this plan)
week_start_date     TEXT NOT NULL (YYYY-MM-DD, Monday of the plan week)
week_end_date       TEXT NOT NULL (YYYY-MM-DD, Sunday of the plan week)
theme_summary       TEXT NOT NULL (one-line week focus from the digest)
slots_json          TEXT NOT NULL (JSON array of slot objects, see §4)
status              TEXT NOT NULL DEFAULT "awaiting_review"
                    -- "awaiting_review" | "partially_approved" | "all_approved" | "expired"
nudge_sent          INTEGER NOT NULL DEFAULT 0 (boolean — 1 if Tuesday nudge fired)
reviewed_at_ms      INTEGER (nullable — first approval timestamp)
created_at_ms       INTEGER NOT NULL
updated_at_ms       INTEGER NOT NULL
```

Unique constraint on `(account_id, week_start_date)` — one plan per account per week.

### §5.2 Expiry
Plans older than 7 days past their `week_end_date` with status `"awaiting_review"` auto-transition to `"expired"`. No tasks are created. A cleanup job runs alongside the Sunday generation.

---

## §6 Approval Flow

1. Andy opens the Instagram dashboard, sees the plan card
2. Reviews post slots — edits topic or caption direction inline if needed
3. Checks slots to approve (or "Approve all")
4. Clicks "Approve selected"
5. Server action:
   a. For each checked slot: create a task (see §3.3), store `task_id` on the slot
   b. Update `slots_json` with `approved: true` and `task_id` values
   c. Update plan status: all approved → `"all_approved"`, some → `"partially_approved"`
   d. Set `reviewed_at_ms` if first approval
   e. Log activity: `"instagram_plan_approved"`
6. Plan card updates to reflect approved status
7. Tasks appear in cockpit planning view

Slots can be approved incrementally — approve 2 on Monday, 3 more on Wednesday.

---

## §7 Content Studio Bridge

### §7.1 "Create in Studio" Button
On task detail for Instagram plan tasks, a button opens Content Studio with pre-filled fields:

```
/lite/content/studio?prefill_type={content_type}&prefill_brief={encoded_topic_and_caption}
```

Content Studio reads these URL parameters (same pattern as lead-gen's "Today's picks" prefill) and populates the creation form.

### §7.2 Content Type Mapping
| Plan slot type | Content Studio content_type |
|---|---|
| carousel | any (user picks template) |
| single | any (user picks template) |
| reel | motion-enabled |
| story | motion-enabled, story aspect ratio |

### §7.3 Post-Creation Link
After creating and posting the Content Studio output to Instagram, the `instagram_media` row's `source_post_id` links back to the Content Studio post. The strategy engine reads this to close the metrics → content loop.

---

## §8 LLM Integration

### §8.1 Plan Generation
The weekly content plan is derived from the strategy digest's `content_ideas_json`. The digest generation (existing `instagram-strategy-digest` slug, Sonnet) already produces content ideas with:
- Content type recommendation
- Topic
- Brief text
- Template suggestion

This spec adds a lightweight post-processing step that assigns suggested dates (spread across the week based on audience active-hours data from `instagram_audience_snapshots`) and formats the caption direction. No additional LLM call needed — the digest does the creative heavy lifting.

### §8.2 Date Assignment Logic
Post dates spread across the week to maximise reach:
1. Read audience `online_hours_json` from the most recent audience snapshot
2. Identify the top 3–5 posting windows (day + hour combinations with highest activity)
3. Assign one slot to each window, distributing evenly across the week
4. Fallback if no audience data: Tuesday, Wednesday, Thursday, Friday (10:00 AEST)

---

## §9 Settings Keys

```
instagram.strategy.plan_generation_day          = "sunday"
instagram.strategy.plan_generation_hour_local   = 18
instagram.strategy.plan_nudge_day               = "tuesday"
instagram.strategy.plan_nudge_hour_local        = 9
instagram.strategy.plan_slots_count             = 5
instagram.strategy.plan_expiry_days_after_end   = 7
```

---

## §10 Activity Log Kinds

Add to `ACTIVITY_LOG_KINDS`:
```
"instagram_plan_generated"
"instagram_plan_approved"
"instagram_plan_expired"
"instagram_plan_nudge_sent"
```

---

## §11 Cockpit Attention Rail Contract

Add to the cockpit's `getWaitingItems()` union:

```typescript
{
  source: "instagram_plan",
  label: "Instagram plan awaiting review — @{username}",
  href: "/lite/content/instagram",
  urgency_ms: plan.created_at_ms,  // age of wait
  deadline_ms: null,               // no hard deadline, but nudge fires Tuesday
}
```

Fires when: at least one `instagram_content_plans` row has status `"awaiting_review"` and `created_at_ms` is before Tuesday 09:00.

Clears when: plan status transitions to `"all_approved"`, `"partially_approved"`, or `"expired"`.

---

## §12 Cross-Spec Impacts

- **`docs/specs/instagram-channel.md`** — extends §6 strategy engine with plan generation step after digest. Adds `instagram_content_plans` table to §5 data model.
- **`docs/specs/daily-cockpit.md`** — new attention rail source (`instagram_plan`). Monday morning brief references pending plan.
- **`docs/specs/task-manager.md`** — Instagram plan tasks use existing `admin` and `client_task` kinds. No schema changes.
- **`lib/ai/models.ts`** — no new model registry entries (reuses existing `instagram-strategy-digest`).
- **`lib/db/schema/activity-log.ts`** — four new activity log kinds.
- **Content Studio** — reads `prefill_type` and `prefill_brief` URL parameters (same pattern as lead-gen prefill).

---

## §13 Success Criteria

1. Every Sunday at 18:00, each active Instagram account gets a new content plan
2. Plan card shows on the Instagram dashboard with 3–5 post slots
3. Slots are editable inline (topic, caption direction)
4. Approving a slot creates a correctly-typed task with the right due date
5. Tasks appear in cockpit planning view
6. "Create in Studio" button pre-fills Content Studio with the slot's content brief
7. Tuesday nudge fires if plan is still awaiting review
8. Expired plans auto-transition after 7 days past week end
9. Client account plans read the client's Brand DNA for context
10. Multiple accounts each get their own independent plan card

---

## §14 Non-Goals

- Auto-posting without human review (every post goes through Content Studio + manual "Post to Instagram")
- AI-generated images on approval (Content Studio is the creation surface; plan slots are text briefs)
- Per-slot LLM calls for caption generation (captions are drafted in Content Studio's posting flow, not the plan)
- Calendar drag-and-drop (post dates are suggested, edited inline if needed)
- Multi-week planning (one week at a time; strategy evolves weekly based on metrics)
- Plan rollover (unapproved slots from last week don't carry into the new plan; the new digest reassesses)

---

## §15 Build Order

1. Schema: `instagram_content_plans` table + migration
2. Activity log: add four kinds
3. Plan generation logic: `lib/channels/instagram/generate-plan.ts`
4. Date assignment logic: audience-hours-based scheduling
5. Sunday scheduled task: digest → plan generation
6. Tuesday nudge: scheduled check + cockpit attention rail item
7. Plan expiry: cleanup job alongside Sunday generation
8. Instagram dashboard UI: plan card with slots, inline editing, approve action
9. Approval server action: create tasks, update plan status
10. Content Studio prefill: read URL params for type + brief (extend existing prefill pattern)
11. Task detail: "Create in Studio" button for Instagram plan tasks

---

## §16 Files This Spec References

- `docs/specs/instagram-channel.md`
- `docs/specs/daily-cockpit.md`
- `docs/specs/task-manager.md`
- `lib/db/schema/instagram.ts`
- `lib/db/schema/tasks.ts`
- `lib/db/schema/activity-log.ts`
- `lib/ai/models.ts`
