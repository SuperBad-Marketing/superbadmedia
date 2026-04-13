# Spec — Task Manager (+ Braindump)

**Phase 3 spec. Locked 2026-04-12 mini-brainstorm #4.**

> **Prompt files:** `lib/ai/prompts/task-manager.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

Cross-cutting operational feature. Task Manager is a standalone admin module at `/lite/tasks`. Braindump is a globally available primitive reachable from every admin surface. Both compose into other specs: Sales Pipeline, Daily Cockpit, Client Management, Comms Inbox, Client Portal.

This spec is load-bearing for downstream specs that reference it — Client Management treats deliverables as tasks via this spec rather than defining its own deliverables data model. Do not fork.

---

## Purpose

Give Andy two tightly-coupled capabilities:

1. **A proper task manager** with all the features a Melbourne solo founder would expect from Todoist / Things / OmniFocus — due dates, priorities, checklists, recurrence, filters, entity links — without the bloat of a PM tool. This is Andy's operational spine, including personal tasks, admin tasks, prospect follow-ups, and client deliverables.

2. **A universal braindump primitive** — a globally available capture surface where Andy can dump messy natural-language input at any time, have Claude parse it into structured tasks in-place, review and edit in the same modal, and commit. Braindump fires into Task Manager, but is architected as a primitive so future specs can compose it.

Tasks also appear on every entity profile (lead / prospect / client) filtered by entity link, so the right half of each profile shows a live to-do list for that relationship.

**Deliverables are tasks.** A `client_deliverable` task is a first-class Task with approval workflow; Client Management renders these on the client profile and the client portal by filtering the shared Tasks table. There is no separate deliverables data model.

---

## Scope boundaries (locked)

**In scope:**
- Personal / admin / prospect / client task types
- Entity-linked tasks appearing on entity profiles
- Client deliverables as tasks (including approval workflow)
- Braindump primitive with Claude parsing
- Recurrence (preset intervals), checklists, due dates, priorities, state machine
- Client portal surfacing for `client_deliverable` and `client_task` kinds
- Approval workflow via magic-link email + portal direct visit
- Minimal notifications (+ morning digest gated by two conditions)
- Cockpit integration as one of many data sources

**Out of scope for v1:**
- Task templates (flagged as v1.1 concept)
- Subtasks / nested tasks (checklist replaces this)
- Dependencies between tasks (explicit blocking chain)
- Calendar integration beyond manual due-date set
- Time tracking / estimates / actual hours
- Shared-assignee tasks (single-operator v1)
- Drag-and-drop reordering within a priority tier
- Task-level custom fields
- Bulk edit UI (bulk delete only)
- Any form of kanban-view configuration (cockpit dictates board shape)
- Per-task notification preferences
- Irregular recurrence patterns like "first Thursday of the month" (handled manually in v1)

---

## Two surfaces

### Surface 1 — Task Manager module (`/lite/tasks`)

The admin task manager. Standalone page in the main nav. Consists of:

- **List view** — filter by status, kind, entity, due date, priority. Default filter: "open" (not `done` / not `cancelled`). Sort by due date ascending, tie-break by priority descending.
- **Task detail drawer** — clicking a task slides a right-side drawer with full edit surface. Never a modal; drawer keeps the list visible for quick context switches.
- **Create task button** — top-right. Opens the same drawer with a fresh task.
- **Search** — full-text across title + body.
- **Filters** — closed list: Status, Kind, Priority, Due (today / this week / overdue / none), Entity (with autocomplete), Has-braindump-source.

Mouse-first by locked preference. No keyboard shortcuts on this page except the global `Cmd+Shift+D` braindump shortcut (see Surface 2).

### Surface 2 — Braindump primitive

Globally available on every admin surface as:

- **Floating bottom-right button** — persistent, unobtrusive, branded. Pulses once on first session per day if not yet used.
- **Global `Cmd+Shift+D` shortcut** — opens the same modal from anywhere in `/lite/*`.

Braindump is **never rendered on customer-facing surfaces** (client portal, SaaS dashboards, public marketing pages, quote pages, lead forms). The shell layer decides whether to mount the button based on the surface context. Do not rely on URL-based checks; rely on the shell context prop.

**Modal flow:**

1. User clicks button / hits shortcut → modal opens with an empty textarea and the placeholder "*dump it. we'll file it.*" (Claude-generated, cached, drift-checked).
2. User types freely — messy, natural, multi-line, multi-task input welcomed.
3. User hits **Parse** (or `Cmd+Enter`) → textarea locks, loading state shows (Tier 2 motion allowed here; reuse existing parse/synthesis shimmer already scoped for Intro Funnel).
4. Parsed output appears **in-place** as a stack of proto-task cards. Each card shows: title, kind (with colour), due date, priority, entity link (if any), checklist (if any), confidence indicator for each parsed field.
5. Ambiguous fields surface a `⇄` **swap affordance** — click opens a small chooser listing the top 3 candidates (e.g. "Belle Bakery" vs "Belle Tailors" vs "Belle Robinson"). Selecting one replaces the link.
6. User can edit any field inline, delete a card (✗), or accept all cards in a single action.
7. **Commit** button → creates tasks, closes modal, fires a quiet success state (no toast — silent per Q10 notification discipline).
8. Original braindump text persisted in a `braindumps` table with a nullable `source_braindump_id` FK on each created task for audit and future re-parsing.

**Context injection:** the modal receives a `surfaceContext` prop from wherever it was triggered. If Andy dumps from a client profile page, `surfaceContext.entityType='client', entityId=:id` is passed to `parseBraindump()` so Claude can pre-link tasks to the visible client. If triggered globally, no surface context is injected and the parser infers entity links from text alone.

---

## Data model

### Table: `tasks`

```
id                          text primary key (ulid)
title                       text not null
body                        text nullable (longer markdown description)
kind                        text not null (enum — see below)
status                      text not null default 'todo' (enum — see below)
priority                    text not null default 'normal' ('high' | 'normal' | 'low')
due_at                      timestamp nullable (UTC; rendered via formatTimestamp per §11.3)
entity_type                 text nullable ('contact' | 'company' | 'deal' | 'client')
entity_id                   text nullable (polymorphic-by-convention, see activity_log pattern)
checklist                   json nullable (array of { id, text, checked, checked_at } objects)
checklist_auto_complete     boolean not null default true
recurrence                  text nullable ('daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly')
recurrence_day              integer nullable (day-of-week 0–6 for weekly/biweekly; day-of-month 1–31 for monthly/quarterly/yearly)
parent_recurrence_id        text nullable (FK self; the template task that spawned this one)
source_braindump_id         text nullable (FK → braindumps.id)
approval_requested_at       timestamp nullable
approval_viewed_at          timestamp nullable
approved_at                 timestamp nullable
approved_by_contact_id      text nullable (FK → contacts.id)
rejected_at                 timestamp nullable
rejection_feedback          text nullable
approval_token              text nullable (hashed, one-time-use, ~14d expiry)
created_at                  timestamp not null default now()
updated_at                  timestamp not null default now()
created_by                  text not null (FK → users.id)
completed_at                timestamp nullable
```

**Indexes:**
- `(status, due_at)` — default list query
- `(entity_type, entity_id)` — entity profile queries
- `(kind, status)` — cockpit / client portal feeds
- `(approval_token)` — approval magic-link lookup
- `(parent_recurrence_id)` — recurrence spawn queries
- `(source_braindump_id)` — audit

### Table: `braindumps`

```
id                  text primary key (ulid)
raw_text            text not null
surface_context     json nullable ({ surfaceType, entityType, entityId })
parsed_at           timestamp nullable
committed_at        timestamp nullable
task_count          integer not null default 0 (denormalised count of spawned tasks)
created_by          text not null (FK → users.id)
created_at          timestamp not null default now()
```

Soft-retained; never deleted. Supports future re-parsing if the parser gets better.

### Enum: `kind`

Closed list of 5 values. Additions require the same brainstorm gate as Tier 2 motion additions.

- `personal` — Andy's life admin. Never visible to clients. Never counted in "business" reporting.
- `admin` — Lite / SuperBad operational work that isn't tied to a specific contact or deal (e.g. "rotate Resend API key").
- `prospect_followup` — tied to a lead or prospect Deal. Visible on their profile.
- `client_deliverable` — a piece of work SuperBad owes a client. Visible on client profile AND in client portal. Supports approval workflow.
- `client_task` — a task tied to a client that is **not** a deliverable (e.g. "call Jake about the invoice"). Visible on client profile AND in client portal, but no approval workflow.

### Enum: `status`

Closed list of 7 values. State machine validated in `lib/tasks/transitions.ts`. Invalid transitions throw at the data-layer boundary.

- `todo` — default initial state
- `in_progress` — Andy has started work
- `blocked` — waiting on something external (Andy notes what in the body)
- `awaiting_approval` — deliverable sent to client, waiting for their approval (only valid for `client_deliverable`)
- `delivered` — client approved, deliverable is final (only valid for `client_deliverable`)
- `done` — closed complete
- `cancelled` — closed without completion

**Legal transitions:**

```
todo          → in_progress | blocked | done | cancelled
in_progress   → blocked | awaiting_approval | done | cancelled
blocked       → todo | in_progress | cancelled
awaiting_approval → in_progress (rejection) | delivered (approval) | cancelled
delivered     → done (terminal follow-up if "uploaded" step exists) | (otherwise auto-transition to done)
done          → (terminal)
cancelled     → (terminal)
```

Kind-aware UI: non-`client_deliverable` tasks never show `awaiting_approval` / `delivered` in their status picker. `client_deliverable` tasks never show `todo` → `done` without passing through `awaiting_approval` unless Andy explicitly overrides (for deliverables that don't need approval — the override is an escape hatch, not the default).

---

## Claude primitives

### `parseBraindump(rawText, surfaceContext?) → ParsedBraindump`

Haiku-tier. Single call per braindump commit. Returns:

```ts
type ParsedBraindump = {
  tasks: ParsedTask[];
  global_confidence: number; // 0–1
};

type ParsedTask = {
  title: string;
  body: string | null;
  kind: 'personal' | 'admin' | 'prospect_followup' | 'client_deliverable' | 'client_task';
  priority: 'high' | 'normal' | 'low';
  due_at_iso: string | null;
  entity_candidates: Array<{
    entity_type: 'contact' | 'company' | 'deal' | 'client';
    entity_id: string;
    entity_name: string;
    confidence: number;
  }>;
  checklist: string[] | null;
  confidence: {
    title: number;
    kind: number;
    due_at: number;
    entity: number;
  };
};
```

Input prompt includes:
- Raw text
- `surfaceContext` if provided
- List of recent contacts / companies / clients (scoped to last 90 days + all active clients) for entity matching
- Today's date for relative date parsing ("tomorrow", "friday", "next week")
- Andy's timezone (Melbourne)
- SuperBad's Brand DNA profile (so checklist items and body text carry voice)

Output is cached on the `braindumps` row. If the user rejects the parse and asks for a re-parse, it calls again and overwrites.

**Calibration flag:** parser quality cannot be validated without real usage. Phase 5 builds a fixture suite of ~30 realistic braindump examples + expected outputs before live use. Parse quality is a Phase 5 calibration pass, not a spec-level decision.

### `approveDeliverable(taskId, decision, feedback?) → ApprovalResult`

Single pure function in `lib/tasks/approve.ts`. The **only** code path for deliverable approval — forking it in the portal or the email handler is a code-review reject. Mirrors the `resolveRiddleAnswer()` discipline from S&D.

Inputs:
- `taskId` — target task
- `decision` — `'approve' | 'reject'`
- `feedback` — required if rejecting, nullable if approving

Behaviour:
- Validates task is in `awaiting_approval` status
- Validates caller is the `approved_by_contact_id` (via session or token binding)
- On approve: transitions to `delivered` (or `done` if no uploaded-follow-up step), fires cockpit signal, logs activity
- On reject: transitions to `in_progress`, writes a new inbound message to the comms inbox with `source='task_rejection'` and feedback as body, fires cockpit signal, logs activity
- Idempotent on repeat calls with same decision + same caller (returns cached result, does not re-fire downstream)

### `generateInVoice('task_digest_subject', context) → string`

From Surprise & Delight spec. Used for morning digest subject lines. Cached per-day. Falls back to a static dry line if the Brand DNA profile is not yet available (Phase 5 sequencing gap).

---

## Feature list

### Braindump

- Global floating bottom-right button (admin surfaces only)
- Global `Cmd+Shift+D` shortcut
- Modal with in-place parse → edit → commit flow
- `⇄` swap affordance on ambiguous entity candidates
- Per-card edit of all fields
- Silent commit (no toast — review modal IS the notification)
- Context injection from triggering surface
- Raw text persisted in `braindumps` table, referenced by spawned tasks

### Task list view

- Filter by status, kind, priority, due, entity, has-braindump-source
- Default filter: "open" (status not in (done, cancelled))
- Sort by due date asc, priority desc
- Full-text search across title + body
- Bulk delete (checkbox select + trash action; no other bulk actions)
- Empty state with `generateInVoice()` copy

### Task detail drawer

- All fields editable inline
- Status picker enforces legal transitions (kind-aware)
- Due date picker with natural-language input ("friday", "next week") parsed client-side
- Entity link picker with autocomplete
- Checklist editor (add, reorder via up/down arrows — no drag in v1, single-operator, not worth it)
- Recurrence picker (preset enum)
- Rejection feedback visible as a read-only block if task was rejected
- Activity sub-log (who did what to this task) — sourced from `activity_log`

### Checklists

- Optional per-task, stored as `json`
- Each item: `{ id, text, checked, checked_at }`
- `checklist_auto_complete` (default true) means ticking the last box transitions the task to `delivered` (for `client_deliverable`) or `done` (for everything else)
- The transition shows a visible Tier 2 toast so Andy can see it happened and undo if surprised (undo window: 10s, Tier 2 motion reused from existing toast system)
- Parser emits a checklist for countable phrasings ("4 instagram posts", "three blog drafts")
- Checklist items are plain strings; Claude writes them during parse, but subsequent edits are manual. Not re-edited by Claude.

### Recurrence

- Preset enum only: `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`
- `recurrence_day` carries day-of-week or day-of-month
- **Auto-spawn on completion**, not on calendar cron. When a recurring task transitions to `done` or `delivered`, `markTaskDone()` spawns the next instance with the next due date calculated from `recurrence` + `recurrence_day` + completion timestamp.
- The new task's `parent_recurrence_id` points at the template.
- First-Thursday-of-month and similar irregular patterns → **handle manually** in v1. Out of scope.
- Task templates flagged as v1.1 concept.

### Entity linking

- `entity_type` + `entity_id` nullable pair, polymorphic-by-convention (pattern lifted from `activity_log`)
- Tasks appear on the linked entity's profile page via a simple filter query
- **Client portal visibility rule:** `kind IN ('client_deliverable', 'client_task') AND entity_type='client' AND entity_id = :portal_client_id AND approved_by_andy = true`
- Braindump-created tasks with client entity links are **not** portal-visible until Andy confirms the braindump review modal. This is the implicit "published to portal" gate — it's not a separate column, it's the fact that draft proto-tasks never persist to `tasks` until the user hits Commit.
- Entity link is editable post-creation. Changing the link removes the task from the old entity's profile and puts it on the new one.

### Approval workflow (`client_deliverable` only)

- Andy transitions a deliverable to `awaiting_approval` via the status picker
- System fires:
  - Email to client's primary contact via `approveDeliverable` email template, containing a tokenised deep-link (`/portal/approve/:token`)
  - Email classification is **`transactional`** — bypasses Foundations §11.4 outreach quiet window. Fires instantly regardless of time of day.
  - The token is stored hashed in `approval_token`, bound to `contact_id` + `task_id`, one-time-use, ~14d expiry.
- Client opens the email OR logs into the portal directly → sees the approval card on the deliverable
- Client clicks Approve or Reject → `approveDeliverable()` primitive called
- On approve: task → `delivered`. If the kind flow has an "uploaded to Pixieset" or similar follow-up step, it transitions through `delivered` and waits for Andy to mark `done`. If not, `delivered` auto-transitions to `done`.
- On reject: task → `in_progress`, rejection feedback becomes an inbound message in comms inbox, cockpit gets a signal.
- If client hasn't opened the email after 48h, a **reminder email** fires. Reminder **respects** the §11.4 outreach quiet window (one step closer to nagging; bartender voice rules apply).
- The approval page shows the client's own name at the top ("Signing in as Jake Miller — approve *Belle's newsletter draft*?") to reduce wrong-person confusion, though this is a soft-security model. Acceptable because approval is deliverable sign-off, not payment authorisation.

### Notifications (intentionally minimal)

- **Client-facing:**
  - Approval request email — transactional, instant, bypasses §11.4 quiet window
  - 48h unacknowledged reminder — respects §11.4 quiet window
  - Approval outcome email to Andy — transactional, instant
- **Andy-facing:**
  - Zero push notifications on his own tasks
  - Cockpit is the notification surface — see "Cockpit integration" below
  - **Morning digest email** at 08:00 Melbourne, gated by two conditions (both required):
    1. Andy has **not** signed in to `/lite` between 00:00 and 08:00 Melbourne that day
    2. There is something to report (≥1 overdue, ≥1 due-today, OR ≥1 new approval outcome since yesterday's digest)
  - Digest body is a terse list grouped by bucket (Overdue / Today / Approval news), each line clickable into the task. No prose, no zero-state mornings.
  - Subject line via `generateInVoice('task_digest_subject', context)` — cached per-day. Static dry fallback if Brand DNA profile not yet available.
  - Unsubscribe via Settings → Display → "Morning digest" toggle. Default on. No per-bucket toggles (violates `feedback_curated_customisation`).
- **Braindump ingestion:** silent. The review modal is the notification.

Notifications module lives at `lib/tasks/notifications.ts` — a thin module with just the two client-facing sends + the cockpit signal wiring + the digest cron handler. No scheduler beyond the Cloudflare cron for the 08:00 digest.

### Cockpit integration

Task Manager feeds the Daily Cockpit as one of many data sources, honouring SCOPE.md § 5 ("cockpit is for actionable items only" and "references them but doesn't clutter") and the locked daily-cockpit.md spec's role as an attention curator rather than a store.

**Column rules (locked):**
- **Must Do** — tasks where `(status = 'todo' OR status = 'in_progress') AND (due_at < today OR (due_at = today AND priority = 'high'))`
- **Should Do** — tasks where `status IN ('todo', 'in_progress') AND due_at = today AND priority != 'high'` (due today, normal/low priority)
- **If Time** — tasks where `status IN ('todo', 'in_progress') AND due_at BETWEEN today+1 AND today+7 AND priority = 'high'`
- **Awaiting approval** tasks do **not** appear on Must Do / Should Do / If Time — they stay off the attention surface because the attention isn't Andy's, it's the client's. They surface as a **passive count in the narrative morning brief** ("3 deliverables waiting on client feedback").
- **Blocked** tasks also stay off Must Do / Should Do / If Time — same reasoning (attention is external). Surface as passive count in narrative brief.

**What cockpit does NOT do:**
- No kanban-view editing of task state
- No drag-and-drop rescheduling
- No task creation
- Cockpit references tasks by id and renders their summary; clicking through opens the Task Manager drawer

**Cockpit signals from approval flow:**
- Deliverable enters `awaiting_approval` → passive count update in narrative brief
- Client views portal card without acting → small indicator on the task card ("viewed, no action")
- Client approves → cockpit signal + inbox message + task auto-transitions
- Client rejects → cockpit signal + inbox message with feedback as body, task returns to `in_progress`

---

## Cross-spec impacts

### `docs/specs/hiring-pipeline.md` — bench availability (added 2026-04-13 Phase 3.5)

When Task Manager routes work that could go to a Bench member (not just Andy), it consults Hiring Pipeline's `getAvailableBenchMembers()` contract:

```ts
getAvailableBenchMembers(
  role: string,                           // e.g. 'video_editor', 'copywriter'
  hours_needed: number,
  options?: {
    excludeCandidateIds?: string[],       // already assigned elsewhere
    minimum_rating?: number,              // optional quality floor
  },
): Promise<BenchMember[]>
```

Contract owned by Hiring Pipeline §3.2 — Task Manager is the first and canonical consumer. Task Manager calls this when an admin manually routes a task to a Bench member via the task-assignee picker, and may also call it headlessly for LLM-routed work types where a Bench auto-assign is appropriate. A `null` or empty return surfaces a `hiring_bench_empty_for_open_role` health banner (via Hiring Pipeline's getHealthBanners). Task Manager never queries the `candidates` table directly.

### `docs/specs/client-management.md` (backlog #8)

Client Management **references** this spec for deliverables. Do not define a separate `deliverables` table. The client profile page gets a Tasks tab that runs:

```sql
SELECT * FROM tasks
WHERE entity_type = 'client' AND entity_id = :client_id
ORDER BY status, due_at
```

Client Management's deliverables UI is a filtered view (`kind = 'client_deliverable'`) of this shared table. The approval workflow is the one defined here. No forks.

### `docs/specs/daily-cockpit.md` (backlog #12)

Cockpit adds Task Manager to its locked "data sources" list when the cockpit spec is written. Column rules above are the contract — cockpit consumes, does not re-derive. If cockpit wants a different filter, it proposes the change via a brainstorm gate, not a private query.

### `docs/specs/comms-inbox.md` (backlog #11)

Rejection feedback from the approval flow creates an inbound message with:
- `source = 'task_rejection'`
- `body = rejection_feedback`
- `linked_task_id = taskId` (new nullable column on messages — flag for the comms-inbox spec)

The comms-inbox spec will need to handle this message source and render it with a "this is a deliverable rejection" affordance. Flag when writing that spec.

### `docs/specs/client-portal.md` (not yet in backlog — may be rolled into client-management.md)

Client portal renders deliverable and `client_task` items for the signed-in client. Portal-side actions are read-only except for the approval action on `awaiting_approval` tasks. Portal never shows `personal`, `admin`, or `prospect_followup` kinds regardless of entity link.

### `docs/specs/intro-funnel.md` (LOCKED)

**Potential retrofit flag:** the Intro Funnel's post-shoot reflection + Claude synthesis produces follow-up actions. These could become auto-generated `client_task` or `client_deliverable` rows. **Out of scope for this spec** — flag for a future retrofit session, do not modify Intro Funnel now.

### `docs/specs/sales-pipeline.md` (LOCKED)

Pipeline cards for Deals can render a small task count badge (open tasks with `entity_type='deal' AND entity_id=deal_id`). **Out of scope for this spec** — flag for the Pipeline's own next-iteration session or for Phase 5 build integration. Do not retrofit Pipeline now.

### `FOUNDATIONS.md § 11`

**New column owed on the send gate (§11.2):** `classification: 'transactional' | 'outreach'`. This formalises the rule that approval request emails (and future transactional sends like receipts) bypass §11.4 outreach quiet window while outreach emails (lead gen, reminders to action, etc.) respect it.

Flag this as a Foundations patch to land alongside the Task Manager build in Phase 5, not now.

---

## Voice & delight treatment

Per the cross-cutting constraint from `docs/specs/surprise-and-delight.md`:

**Ambient surface categories applied to Task Manager surfaces:**
- **Empty states** — "no tasks. go outside." / "nothing to do. that's either a problem or a really good week." (Claude-generated via `generateInVoice('task_empty_state', context)`)
- **Loading copy** — parse modal uses a shimmer (Tier 2 motion) + one-line status
- **Success toasts** — only on destructive-undo (checklist auto-complete); every other successful action is silent per the notification discipline above
- **Placeholder text** — braindump textarea, search bar, due-date picker
- **Morning brief narrative** — the digest subject line AND the cockpit narrative brief receive passive task counts ("3 deliverables waiting on client feedback, 4 tasks carried over from yesterday")

Error pages are not specific to Task Manager — handled by global error surface rules from S&D.

**Hidden eggs expected to fire on Task Manager surfaces:** none proposed in this spec. No new eggs added to the S&D closed list by this spec. The braindump review modal is deliberately a calm utilitarian surface — not a site for admin-roommate theatrics.

**Sprinkle bank items claimed by this spec (from `docs/candidates/sprinkle-bank.md`):**
- **§2 Structural character text — browser tab title.** The Task Manager page's browser tab title receives dynamic voice treatment: `"SuperBad Lite — 4 overdue"` vs `"SuperBad Lite — nothing's on fire"`. Quiet subliminal presence. Mark `[CLAIMED by task-manager]` in the bank.

No new ambient surface categories or new hidden eggs proposed — no brainstorm gate needed.

---

## Security, privacy, audit

- **Approval tokens:** hashed at rest, one-time-use, ~14d expiry, bound to `contact_id` + `task_id`. Token leak reveals one approval decision, nothing else.
- **Client portal filtering:** enforced at the data layer in `lib/tasks/queries.ts` — never trust the caller to filter. `getTasksForClientPortal(clientId, sessionContactId)` returns only rows matching the locked visibility rule.
- **Braindump raw text persistence:** stored in plaintext, never shared with any third party beyond the Claude API call for parsing. The braindump row is deletable by Andy from the Braindump history tab (v1.1 affordance flagged in "Out of scope"); in v1, deletion is via SQL or the universal audit log.
- **Activity log entries:** every task create / update / status change / approval / rejection / delete logs via `logActivity()` per Foundations §11.1. Mandatory, not optional.
- **Deliverable feedback content:** treated as customer data. Respects the one-click client data export (from the 2026-04-12 upgrades integration) — when a client requests their data, deliverable tasks and rejection feedback are included in the export.
- **Personal tasks:** `kind = 'personal'` tasks are **never** exposed via any customer-facing surface, client portal, or audit export that leaves Andy's account. They exist only on `/lite/tasks` and the Andy cockpit.

---

## New build-time disciplines

Task Manager adds the following to the Foundations §11 build-time disciplines list. Move into `FOUNDATIONS.md` during Phase 5 build of this feature, aligning with the existing numbered list (currently 18, grew to 23 via Surprise & Delight).

- **24.** Task state transitions go through `lib/tasks/transitions.ts`. Bypassing the state machine to write raw statuses is a code-review reject.
- **25.** Deliverable approval goes through `approveDeliverable()` only. One function, multiple surface bindings (portal button, email magic-link). Forking is a code-review reject.
- **26.** Braindump ingestion goes through `parseBraindump()` only. Never write a second parser for a subset of the surface area.
- **27.** Braindump is never rendered on customer-facing surfaces. The mount decision is shell-level, not URL-based.
- **28.** Client portal task visibility goes through `getTasksForClientPortal()` only. Direct querying of the `tasks` table from the portal layer is a code-review reject. Authorisation is data-layer, not caller-layer.
- **29.** Every task-related email send declares its `classification` ('transactional' | 'outreach') at the send gate call site. Missing classification is a runtime error, not a silent default.

---

## Success criteria

- Andy can create a task by keyboard, by mouse, or by braindump — all three paths work and feel equivalent in quality.
- Braindump parses a realistic 4-task dump with ≥3 correct entity links on the first attempt (Phase 5 calibration target).
- A deliverable goes from `todo` → `awaiting_approval` → approved-by-client → `delivered` end-to-end without Andy touching the client portal directly.
- A client who opens the approval email can approve it in one click without needing to log in (token flow).
- Personal tasks never appear on any client-facing surface under any circumstances. Verified by fixture tests per §28.
- The morning digest fires on days Andy doesn't sign in early AND there's something to report, and skips otherwise. Verified by fixture tests against the two gate conditions.
- Recurring tasks spawn their next instance on completion, not on a calendar cron. Verified by fixture tests.

---

## Non-goals (explicit)

- No Gantt charts, timelines, or visual scheduling (SCOPE.md non-goal: "not a deep PM tool")
- No task templates in v1 (flagged for v1.1)
- No subtasks (checklist replaces)
- No task dependencies (blocking chains)
- No shared-assignee / team-assignment (single operator)
- No time tracking / estimates
- No per-task notification preferences
- No bulk edit UI beyond bulk delete
- No drag-and-drop reordering within priority tier
- No calendar integration beyond manual due-date set
- No irregular recurrence patterns ("first Thursday of month" handled manually)
- No kanban view configurable on the Task Manager page (cockpit dictates board shape, this page is a filter list)
- No AI task suggestions or "Claude thinks you should do this" surface — Lite responds to Andy's intent, does not generate its own agenda

---

## Open items

None that block this spec. The parser calibration pass is Phase 5 work, not spec work. The Foundations §11.2 `classification` column patch is flagged for Phase 5 alongside the build.

---

## Files this spec references

- `docs/specs/surprise-and-delight.md` — voice treatment, Claude primitives, closed-list discipline
- `docs/specs/sales-pipeline.md` — entity linking pattern (`entity_type + entity_id`)
- `docs/specs/lead-generation.md` — `logActivity()` pattern, polymorphic entity linking
- `docs/specs/intro-funnel.md` — Tier 2 motion reuse (synthesis reveal pattern for braindump parse)
- `docs/specs/design-system-baseline.md` — Tier 2 motion closed list
- `FOUNDATIONS.md § 11` — all cross-cutting primitives (audit log, send gate, timestamps, quiet window, drift check)
- `SCOPE.md § 5` — cockpit attention-curator principle
- `docs/candidates/sprinkle-bank.md` — browser tab title sprinkle claimed
- Memory: `feedback_no_content_authoring`, `feedback_curated_customisation`, `feedback_dont_undershoot_llm_capability`, `feedback_individual_feel`, `feedback_surprise_and_delight_philosophy`, `project_brand_dna_as_perpetual_context`

---

## Silent dependencies

- **`generateInVoice()`** primitive from the Surprise & Delight spec. Task Manager calls it for empty states, placeholders, and digest subject lines. Phase 5 sequencing gap: before S&D ships, Task Manager uses a static dry fallback set. Do not block Task Manager build on S&D build — they are independent.
- **Brand DNA profile** (backlog #5). `generateInVoice()` reads SuperBad's own Brand DNA profile via the drift check. Same fallback rule: static dry lines pre-Brand-DNA.
- **Cockpit (backlog #12)** is a consumer of Task Manager, not a prerequisite. Task Manager ships first and the cockpit reads from it when cockpit ships.
- **Client Portal** (currently rolled into Client Management backlog #8) is a consumer. Same pattern — Task Manager ships independently.

**Task Manager itself has no hard prerequisite on any un-shipped spec.** It can be built as soon as Phase 5 starts. This is deliberate — the task spine is load-bearing for Andy's daily operations and should not sit behind slower specs.
