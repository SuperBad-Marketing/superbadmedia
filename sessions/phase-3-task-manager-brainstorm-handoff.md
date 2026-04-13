# Phase 3 — Task Manager (+ Braindump) brainstorm + spec (handoff)

**Date:** 2026-04-12
**Type:** Mini-brainstorm #4 + full spec
**Trigger:** Andy asked for "the ability to add tasks, with all the great features you'd expect of a task manager, as well as the ability to quickly braindump thoughts and last minute tasks, that get interpreted by Claude and organised properly."
**Outcome:** Task Manager added to SCOPE.md as feature #14 (operational-spine). `docs/specs/task-manager.md` written to full depth. Client Management and Daily Cockpit backlog entries flagged with load-bearing dependencies. Foundations §11.2 patch flagged. Backlog grows 15 → 16.

---

## What was brainstormed and locked (Q1–Q10)

- **Q1 — Feature shape:** Standalone Task Manager module + cross-cutting Braindump primitive. Two surfaces, one data model. Andy added mid-question that client/lead/prospect-related tasks should surface on the linked entity's dashboard AND that **deliverables are tasks**. This second point is the load-bearing architectural decision of the whole feature — Client Management now references this spec for deliverables rather than defining its own data model.

- **Q2 — Single universal task model:** One `tasks` table, closed `kind` enum (5 values: `personal` / `admin` / `prospect_followup` / `client_deliverable` / `client_task`), nullable optional fields, polymorphic-by-convention entity linking via `(entity_type, entity_id)` pair following the `activity_log` pattern. Additions to the `kind` enum require a brainstorm gate.

- **Q3 — Status model:** Single universal `status` enum, closed list of 7 values (`todo` / `in_progress` / `blocked` / `awaiting_approval` / `delivered` / `done` / `cancelled`). Kind-aware UI — `awaiting_approval` and `delivered` only valid for `client_deliverable`. State machine validation lives in `lib/tasks/transitions.ts`. Nullable `approval_requested_at` + `approval_viewed_at` timestamps on the row. Invalid transitions throw at the data-layer boundary.

- **Q4 — Braindump primitive:** Global floating bottom-right button + `Cmd+Shift+D` shortcut on admin surfaces only. Modal with in-place Claude review (parse → proto-task cards → edit → commit). Never mounted on customer-facing surfaces — the shell layer decides via a context prop, not URL-based checks. New `braindumps` table. New `parseBraindump(rawText, surfaceContext?)` primitive (Haiku-tier). Nullable `source_braindump_id` FK on `tasks` for audit and future re-parsing.

- **Q5 — Entity ambiguity resolution:** Confident parser + `⇄` swap affordance on ambiguous entity cards. Parser output includes an `entity_candidates: [{id, name, confidence}]` array so the review modal can show the top N candidates for low-confidence matches. Andy picks via click; the swap is a one-step chooser, not a popup chain.

- **Q6 — Checklists:** Optional inline checklists stored as a nullable JSON column on `tasks`. Parser emits checklist items for countable phrasings ("4 instagram posts for Belle's"). Per-task `checklist_auto_complete` boolean (default true) auto-transitions the task to `delivered` (for `client_deliverable`) or `done` (for everything else) when the final box is ticked. A visible Tier 2 undo toast (10s window) makes the transition reversible. Checklist items are plain strings; Claude writes them during parse but subsequent edits are manual, not Claude-edited.

- **Q7 — Recurrence:** Simple preset recurrence — closed `recurrence` enum (`daily`/`weekly`/`biweekly`/`monthly`/`quarterly`/`yearly`) + `recurrence_day` integer (day-of-week for weekly/biweekly; day-of-month for monthly+). Auto-spawn on completion via `markTaskDone()`, not via calendar cron. New task's `parent_recurrence_id` points at the template. First-Thursday-of-month and other irregular patterns → handled manually in v1. Task templates are flagged as a v1.1 concept, explicitly out of scope for v1.

- **Q8 — Approval workflow:** Option C chosen — dual entry points (tokenised magic-link deep-link from email + direct portal visit). Single `approveDeliverable(taskId, decision, feedback?)` primitive in `lib/tasks/approve.ts` — the **only** code path for deliverable approval; forking is a code-review reject. Five new nullable columns added to `tasks`: `approved_at`, `approved_by_contact_id`, `rejected_at`, `rejection_feedback`, `approval_token`. Rejection feedback fires as an inbound message in the comms inbox with new `source='task_rejection'`. Approval token is hashed at rest, bound to `contact_id` + `task_id`, one-time-use, ~14d expiry. The approval page shows the client's own name at the top to reduce wrong-person confusion (soft-security model, acceptable because this is deliverable sign-off, not payment authorisation).

- **Q9 — Cockpit integration:** Tasks are one of many data sources feeding the Daily Cockpit's existing Kanban columns, honouring SCOPE.md § 5's attention-curator principle. No new cockpit UI. Locked column rules:
  - **Must Do** = overdue OR (due-today AND priority=high)
  - **Should Do** = due today AND priority != high
  - **If Time** = due within 7 days AND priority=high
  - `awaiting_approval` and `blocked` tasks stay **off** Must Do / Should Do / If Time (attention is external, not Andy's) and surface as passive counts in the narrative morning brief.
  - Cockpit is read-only against tasks — no edit, no drag, no create. Clicking opens the Task Manager drawer.
  - Client portal visibility is mechanical, derived from kind alone: `kind IN ('client_deliverable', 'client_task')` = visible to linked client; other kinds never visible regardless of entity link.

- **Q10 — Notifications:** Option B chosen — minimal + morning digest, with tight gating:
  - Client-facing: approval request email is **transactional** (bypasses §11.4 quiet window, instant fire); 48h unacknowledged reminder **respects** the quiet window; approval outcome email to Andy is transactional.
  - Andy-facing: zero push notifications on his own tasks. Cockpit is the primary notification surface.
  - **Morning digest** at 08:00 Melbourne, gated by **two conditions, both required:**
    1. Andy has **not** signed in to `/lite` between 00:00 and 08:00 Melbourne that day (cockpit hasn't already done its job).
    2. There is something to report — ≥1 overdue task, ≥1 due-today task, OR ≥1 new approval outcome since yesterday's digest.
  - Zero-state mornings → no email. Cockpit-already-read mornings → no email. Digest is a genuine safety net, not background noise.
  - Subject line via `generateInVoice('task_digest_subject', context)` — cached per-day. Static dry fallback pre-Brand-DNA.
  - Body: terse bucketed list (Overdue / Today / Approval news), each line clickable. No prose.
  - Unsubscribe via Settings → Display → "Morning digest" toggle. Default on. No per-bucket toggles (violates `feedback_curated_customisation`).
  - Braindump ingestion is silent — the review modal IS the notification.

---

## Scope additions surfaced inside the brainstorm

Two material additions came in mid-brainstorm and reshaped the feature:

1. **Entity-linked tasks on profile pages.** Q1 answer added "client, lead & prospect-related tasks should appear in their dashboard when I click into them." This turned the feature from "standalone task manager" to "task manager with a cross-cutting entity-linking contract" and is why polymorphic-by-convention linking via `(entity_type, entity_id)` became the data model from Q2 onward.

2. **Deliverables are tasks.** Also in Q1: "This feature will also be used to track client deliverables." This is the load-bearing architectural decision. Client Management (backlog #8) no longer defines a separate deliverables data model — it references this spec and filters `tasks` by `kind='client_deliverable' AND entity_type='client'`. The approval workflow is the one defined here via `approveDeliverable()`. Five downstream specs (Client Management, Daily Cockpit, Comms Inbox, Client Portal, and indirectly Intro Funnel's post-shoot follow-ups) now depend on Task Manager as a load-bearing primitive.

This means Task Manager should be built **early** in Phase 5 — it has no un-shipped prerequisite and five downstream specs consume it.

---

## Single-function-behind-multiple-surfaces pattern (reused)

The approval workflow uses the same architectural pattern as S&D's riddle resolver: one pure primitive, multiple surface bindings.

- **`approveDeliverable(taskId, decision, feedback?)`** is called identically from:
  - The tokenised email magic-link handler at `/portal/approve/:token`
  - The client portal Approve / Reject buttons (session-bound)
  - Any future surface (e.g. a future mobile app) that needs to act on a deliverable
- Idempotent on repeat calls with same decision + same caller.
- All state transitions, activity logging, cockpit signals, and inbox message creation flow through this single function.
- Forking is a **code-review reject** — call it out in review comments and block the merge.

Same discipline applies to `parseBraindump()` (only path for braindump ingestion) and `getTasksForClientPortal()` (only path for client portal task queries — authorisation is data-layer, not caller-layer).

---

## Technical footprint

**New tables:**
- `tasks` — see spec for full column list (16 columns including approval workflow columns)
- `braindumps` — raw text, surface context, parse/commit timestamps, task count denorm

**New Claude primitives:**
- `parseBraindump(rawText, surfaceContext?)` — Haiku-tier. Reads Brand DNA profile, today's date, Andy's timezone, recent contacts/clients (90d + all active clients) for entity matching. Returns typed `ParsedBraindump` with per-field confidence scores and entity candidate arrays.
- `approveDeliverable(taskId, decision, feedback?)` — validates session/token binding, transitions status via state machine, fires cockpit signal + inbox message on rejection, idempotent on repeat calls.
- `generateInVoice('task_digest_subject' | 'task_empty_state' | ...)` — reused from S&D, with static dry fallback pre-Brand-DNA.

**New helpers:**
- `lib/tasks/transitions.ts` — state machine validator. All status changes go through this.
- `lib/tasks/queries.ts` — `getTasksForClientPortal(clientId, sessionContactId)` is the **only** path for portal queries. Authorisation is data-layer.
- `lib/tasks/notifications.ts` — thin module: two client-facing sends + cockpit signal wiring + digest cron handler.
- `lib/tasks/digest.ts` — Cloudflare cron at 08:00 Melbourne. Applies the two gate conditions. Generates + sends digest.

**Cost architecture:**
- Haiku-tier: `parseBraindump()` (one call per braindump commit), `generateInVoice()` (cached aggressively — empty states cached at build time, digest subjects cached per-day, placeholders cached at build time).
- No Opus-tier calls in Task Manager.
- Estimated monthly Claude spend for this feature specifically: sub-$2.

**Trigger evaluators:** no hidden eggs proposed by this spec, so no new trigger evaluators. Task Manager does not add to the S&D closed list.

---

## New build-time disciplines added

Task Manager adds disciplines 24–29 to the Foundations §11 build-time list. Move into `FOUNDATIONS.md` during Phase 5 build of this feature:

- **24.** Task state transitions go through `lib/tasks/transitions.ts`. Bypassing the state machine is a code-review reject.
- **25.** Deliverable approval goes through `approveDeliverable()` only. One function, many surface bindings.
- **26.** Braindump ingestion goes through `parseBraindump()` only. No second parser for a subset.
- **27.** Braindump is never rendered on customer-facing surfaces. Shell-level mount decision, not URL-based.
- **28.** Client portal task visibility goes through `getTasksForClientPortal()` only. Authorisation is data-layer.
- **29.** Every task-related email send declares `classification: 'transactional' | 'outreach'` at the send gate call site.

---

## Foundations §11 patch owed (Phase 5)

The `sendEmail()` gate in §11.2 needs a required `classification: 'transactional' | 'outreach'` parameter. This formalises the rule:
- **Transactional** — receipts, approval requests, password reset, magic-link auth. Bypasses §11.4 outreach quiet window. Fires instantly regardless of time of day.
- **Outreach** — lead gen, reminders to action, follow-ups, nudges. Respects §11.4 outreach quiet window (08:00–18:00 Melbourne Mon–Fri).

Missing classification at the call site is a runtime error, not a silent default. Discipline #29 enforces this.

**Land this patch alongside the Task Manager build in Phase 5**, not now. Leaving Foundations unchanged until then keeps the spec documents the source of truth until build time.

---

## Cross-spec flags

- **`docs/specs/client-management.md` (#8)** — deliverables are tasks. Do not define a separate `deliverables` table. Client profile page renders a Tasks tab filtered by `entity_type='client' AND entity_id=:client_id`; the deliverables section is a further filter on `kind='client_deliverable'`. Approval workflow is the one defined in Task Manager via `approveDeliverable()`. Flag added to the backlog entry in the tracker.
- **`docs/specs/daily-cockpit.md` (#12)** — Task Manager is a data source. Locked column rules above are the contract. Cockpit consumes, does not re-derive. Flag added to the backlog entry in the tracker.
- **`docs/specs/comms-inbox.md` (#11)** — gains a nullable `linked_task_id` column and a new `source='task_rejection'` value. Render treatment for that source flagged for the comms-inbox spec when it's written.
- **`docs/specs/client-portal.md`** (currently rolled into Client Management) — renders portal-visible tasks as read-only except for the Approve / Reject action on `awaiting_approval` rows. Never shows `personal`, `admin`, or `prospect_followup` kinds regardless of entity link.
- **`docs/specs/intro-funnel.md` (LOCKED)** — potential retrofit flag for post-shoot reflection follow-up actions to become auto-generated `client_task` / `client_deliverable` rows. Out of scope for this spec; flagged for a future retrofit session, do not modify Intro Funnel now.
- **`docs/specs/sales-pipeline.md` (LOCKED)** — potential Deal card task-count badge via `WHERE entity_type='deal' AND entity_id=:deal_id`. Out of scope now; flagged for Phase 5 build integration.

Already-locked specs (Design System Baseline, Sales Pipeline, Lead Generation, Intro Funnel) do **not** need retrofit; the cross-spec flags are forward-looking, to be honoured by the next iteration of those specs when they happen.

---

## Voice & delight treatment

Per the cross-cutting rule from `docs/specs/surprise-and-delight.md`, this spec's "Voice & delight treatment" heading locks:

**Ambient surface categories applied:**
- Empty states (`/lite/tasks` empty state, filter empty states)
- Loading copy (braindump parse shimmer, task list skeleton)
- Placeholder text (braindump textarea, search bar, due-date picker)
- Morning brief narrative (passive task counts from the cockpit → digest integration)
- Success toasts (only on checklist-auto-complete undo window — everywhere else is silent)

**No new hidden eggs proposed.** The braindump modal is deliberately a calm utilitarian surface, not a site for admin-roommate theatrics.

**Sprinkle claimed from `docs/candidates/sprinkle-bank.md`:**
- **§2 Structural character text — browser tab titles** (scoped to the Task Manager surface). `/lite/tasks` receives dynamic voice treatment: `"SuperBad Lite — 4 overdue"` vs `"SuperBad Lite — nothing's on fire"`. Marked `[CLAIMED by task-manager]` in the bank. Other surfaces may still claim the pattern for their own pages — the claim is scoped to `/lite/tasks`, not the whole pattern.

**No new ambient surface categories or new hidden eggs proposed** — no brainstorm gate triggered.

---

## Reality check (per brainstorm rule 6)

### Hardest parts

1. **Braindump parser calibration.** The highest-leverage surface in this feature and the one most likely to feel broken if it fumbles. Cannot be validated without real usage. Mitigation: the in-place review modal means Andy sees and edits before commit — no silent misfiling. Phase 5 should build a fixture suite of ~30 realistic braindump examples + expected outputs before live use, and treat parse quality as a **Phase 5 calibration pass**, not a spec-level decision.
2. **State machine edge cases around recurrence + approval.** A weekly recurring deliverable that goes `awaiting_approval` → rejected → `in_progress` → re-submitted → approved — when does the next instance spawn? Locked answer: on the **final** transition to `done` (or `delivered` with no uploaded follow-up), not on intermediate states. Needs explicit test fixtures in `lib/tasks/transitions.test.ts`.
3. **Client portal visibility under entity-link errors.** Braindump guesses "Belle's" means Belle Bakery but it meant a different Belle. The task shows up in the wrong client's portal. Mitigation: braindump-created draft proto-tasks never persist to the `tasks` table until Andy hits Commit in the review modal. The review modal is the implicit "published to portal" gate — not a separate column, just the persistence boundary. Flag in the spec's security section.
4. **Approval token security.** Magic-link approval means someone forwarding the email can click approve. Locked: one-time-use, hashed at rest, ~14d expiry, bound to `contact_id` + `task_id`, approval page shows client's own name. Still a soft-security model — acceptable because this is deliverable sign-off, not payment authorisation.

### What could go wrong

- **Braindump becomes a graveyard.** 200 tasks dumped in week one, 180 never actioned, task list becomes unusable. No mitigation in v1 — if it happens, add archive/bulk-delete tooling in v1.1 based on real usage, not speculation. Explicitly not a design decision to pre-empt.
- **Digest email fatigue.** Even with the two gate conditions, subject-line voice rotation via `generateInVoice()` helps but doesn't solve fundamental email-blindness. Mitigation: one-click unsub in every digest + toggle in Settings.
- **Cross-spec couple creep.** Task Manager is load-bearing for 5 downstream specs. If this spec ships broken, downstream ships get blocked. Mitigation: this is a sequencing constraint, not a design problem — Task Manager moves up the Phase 5 build order to reflect its load-bearing role.
- **Checklist auto-complete surprise.** Ticking the last box transitions the task *without* Andy explicitly marking it done. Mitigation: the transition is shown via a visible Tier 2 toast with a 10s undo window so Andy sees it happen and can roll back if surprised.

### Doable?

Yes, green light. The feature is architecturally clean and reuses existing patterns:
- Polymorphic entity linking from `activity_log`
- Closed enums (same discipline as Tier 2 motion, sound registry, ambient surface categories)
- State machine validation at a data-layer helper
- Single-function-behind-multiple-surfaces (pattern established by S&D's riddle resolver)

The only net-new piece is the braindump parser, which is a bounded Claude call with in-place human review before commit — fail-soft by design. Estimated monthly Claude cost for Task Manager specifically: sub-$2 (all Haiku-tier, aggressively cached).

**The load-bearing risk is braindump parser quality**, which cannot be validated pre-launch. Flagged as a **Phase 5 calibration pass**, not a pre-launch gate.

---

## Files touched by this session

- **Created:** `docs/specs/task-manager.md` — the full spec
- **Created:** `sessions/phase-3-task-manager-brainstorm-handoff.md` — this file
- **Patched:** `SCOPE.md` — header line updated (three → four mini-brainstorms), new section "Additional v1 features (added 2026-04-12 mini-brainstorm #4)" inserted after the mini-brainstorm #3 section, before "Explicit non-goals for v1". Feature #14 Task Manager.
- **Patched:** `SESSION_TRACKER.md` — Next Action phase count updated (15 → 16, 4 → 5 locked), new handoff note added to "Read before starting" list, backlog header updated, backlog entry #8 Client Management gets deliverables flag, backlog entry #12 Daily Cockpit gets tasks-as-data-source flag, backlog entry #16 Task Manager added, new session log row added AFTER the S&D row (chronologically correct).
- **Patched:** `docs/candidates/sprinkle-bank.md` — §2 browser tab titles item marked `[CLAIMED by task-manager]` (scoped to `/lite/tasks`, not the whole pattern — other surfaces may still claim).

Nothing committed. Andy to commit only if/when he asks.

---

## What did NOT happen

- **No new memories written.** This session didn't surface a new user feedback or project fact that warrants a durable memory entry. The single-function-behind-multiple-surfaces pattern is already a design practice visible in the S&D spec (via `resolveRiddleAnswer()`) and doesn't need a second home. The closed-enum discipline is already captured by `feedback_curated_customisation`.
- **No FOUNDATIONS.md patch.** The `classification` parameter addition to §11.2 is flagged for Phase 5 build time, not patched now. Leaving Foundations unchanged until Phase 5 keeps specs the source of truth until build.
- **No new specs spawned.** Task Manager is the only new feature added by this session. No splits, no sub-features broken out.

---

## Next session

Phase 3 continues at **Quote Builder** (`docs/specs/quote-builder.md`) — unchanged recommendation. The next session should:

1. Read this handoff + the Task Manager spec + the S&D spec + the sprinkle bank + the `feedback_surprise_and_delight_philosophy` memory before starting.
2. When writing the Quote Builder spec, include the **"Voice & delight treatment"** heading referencing `surprise-and-delight.md` and checking `docs/candidates/sprinkle-bank.md` for 1–2 claimable items on quote surfaces.
3. When specifying post-acceptance actions, remember that **follow-up tasks and deliverables live in Task Manager** — the Quote Builder spec should say "on quote acceptance, create a `client_deliverable` task linked to the Deal's client" and route through `tasks`, not define its own follow-up model.
4. Honour the existing cross-cutting Foundations §11 constraints as before, and the new `classification` parameter pattern when specifying outbound emails (mark quote acceptance emails as `transactional`, quote follow-up nudges as `outreach`).
5. If the Quote Builder spec surfaces any new voice-texture candidates that don't fit the current closed list of 6 ambient surface categories, add them to the sprinkle bank rather than silently promoting them — the discipline is the point.
