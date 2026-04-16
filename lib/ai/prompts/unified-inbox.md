---
spec: docs/specs/unified-inbox.md
status: populated
populated-by: UI-2 (router — DONE), UI-3 (notifier — DONE), UI-4 (signal/noise — DONE), UI-5 (draft-reply — DONE)
---

# Unified Inbox prompts

Three Haiku classifiers run in parallel for every inbound message (cost negligible, latency sub-2-second). Classifications stored on the message row; corrections feed back as learning signal. A fourth prompt — `inbox-draft-reply` — is Opus and runs **asynchronously** via a scheduled task, only for client-facing inbound routed to signal/push/urgent, and only writes a cached draft to the thread row.

## `inbox-classify-inbound-route`
**Intent:** contact resolution + sender-type classification (known / new-lead / non-client / spam).
**Spec:** §7.1 (Q5).
**Implementation:** `lib/graph/router-prompt.ts` (prompt builder) + `lib/graph/router.ts` (classifier + effects).
**Model:** Haiku via `modelFor("inbox-classify-inbound-route")`.
**Input context:** message body/subject/from, existing contacts list, Brand DNA summary, recent `classification_corrections` where `classifier = 'router'` (up to 10 most recent).
**Output:** JSON `{ classification, contact_id, new_contact_fields, detected_alt_email, reason }` parsed via `RouterOutputSchema` (Zod).
**Fallback:** on LLM/parse failure, defaults to `new_lead` with no contact creation — ensures no inbound is silently dropped.

## `inbox-classify-notification-priority`
**Intent:** interruption priority (urgent / push / silent).
**Spec:** §7.2 (Q10).
**Implementation:** `lib/graph/notifier-prompt.ts` (prompt builder + thread-context loader) + `lib/graph/notifier.ts` (classifier + persistence).
**Model:** Haiku via `modelFor("inbox-classify-notification-priority")`.
**Input context:** message body/subject/from, thread context (relationship_type / is_client / ticket_status / waiting_on_andy / contact.notification_weight), recent `classification_corrections` where `classifier = 'notifier'` (up to 10 most recent).
**Output:** JSON `{ priority, reason }` parsed via `NotifierOutputSchema` (Zod).
**Effects:** writes `messages.notification_priority` + inserts a `notifications` row. `fired_transport = "none"` for silent; `NULL` for push/urgent (dispatcher fills when UI-E lands). Logs `inbox_notification_fired` in `activity_log`.
**Fallback:** on LLM/parse failure, defaults to `silent` — missed urgency is recoverable via morning digest, a spurious urgent push erodes trust faster.

## `inbox-classify-signal-noise`
**Intent:** content priority (signal / noise / spam) with noise sub-classification (transactional / marketing / automated / update / other).
**Spec:** §7.3 (Q12).
**Implementation:** `lib/graph/signal-noise-prompt.ts` (prompt builder + context loader) + `lib/graph/signal-noise.ts` (classifier + persistence + thread-MAX recompute).
**Model:** Haiku via `modelFor("inbox-classify-signal-noise")`.
**Input context:** message body/subject/from, sender/thread context (relationship_type / is_client / contact.always_keep_noise / sender_looks_automated heuristic), recent `classification_corrections` where `classifier = 'signal_noise'` (up to 10 most recent).
**Output:** JSON `{ priority_class, noise_subclass, reason }` parsed via `SignalNoiseOutputSchema` (Zod). `noise_subclass` forced to `null` when `priority_class !== 'noise'`.
**Effects:** writes `messages.priority_class`, `messages.noise_subclass`, `messages.keep_until_ms` (spec §9.1 — signal=NULL, noise+transactional=180d, other noise=30d, spam=7d; keep_pinned or always_keep_noise override to NULL); recomputes `threads.keep_until_ms` as MAX across live messages (discipline #56); updates `threads.priority_class` to inherit the latest inbound (spec §5.1).
**Fallback:** on LLM/parse failure, defaults to `signal` with `keep_until_ms = NULL`. A false signal in Focus is correctable; a false noise auto-deleted after 30 days is a broken relationship.
**Auto-delete sweep:** daily `inbox_hygiene_purge` scheduled task at 23:00 Melbourne (spec §9.3) — see `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts`.

## `inbox-draft-reply`
**Intent:** pre-generate a cached reply draft for every new client-facing inbound so Andy opens the thread to a draft, not a blinking cursor. Flags low-confidence areas explicitly so Andy can correct rather than be misled.
**Spec:** §7.4 (Q14, Q15) + §6.2 (cached draft lifecycle).
**Implementation:** `lib/graph/draft-reply-prompt.ts` (prompt builder + context loader with CCE-1 stub) + `lib/graph/draft-reply.ts` (generator + persistence) + `lib/scheduled-tasks/handlers/inbox-draft-generate.ts` (async handler).
**Model:** Opus via `modelFor("inbox-draft-reply")`.
**Fired from:** `inbox_draft_generate` scheduled task enqueued by `lib/graph/sync.ts` after classifiers settle, gated on (a) `direction === 'inbound'`, (b) contact `relationship_type in (client, past_client, lead)`, (c) router classification not `spam`, (d) signal/noise not `spam`, (e) both kill switches on. Debounced 60s via idempotency key `inbox-draft-generate:{thread_id}:{floor(run_at_ms / 60000)}`.
**Input context:** latest inbound message (body trimmed to 2000 chars), up to 20 prior messages on the thread, Brand DNA profile (SuperBad-self — **system context, never user-voiced**), Client Context Engine snapshot (stubbed until Wave 16: falls back to `relationship_type` + last 10 activity-log rows for the contact), up to 10 most-recent few-shot examples (Andy's outbound edits) via `lib/ai/few-shot.ts` (stubbed to `[]` in UI-5 — Wave 11 populates).
**Two-perpetual-contexts:** Brand DNA goes in the *system* block; Client Context Engine goes in the *user* block's "who they are / where you are" section. Missing either = regression.
**Output:** JSON `{ draft_body, low_confidence_flags }` parsed via `DraftReplyOutputSchema` (Zod). `low_confidence_flags` is an array of `{ span, reason }` pairs the UI will underline when the drafter wasn't sure (e.g. "guessed at price", "wasn't sure which event Andy means").
**Effects:** writes `threads.cached_draft_body`, `threads.cached_draft_generated_at_ms`, `threads.has_cached_draft = true`, `threads.cached_draft_stale = false`, `threads.cached_draft_low_confidence_flags` (JSON). Logs `inbox_draft_generated` in `activity_log`.
**Invalidation:** on any new inbound on the same thread, `lib/graph/sync.ts` flips `threads.cached_draft_stale = true` *before* enqueuing the next debounced `inbox_draft_generate`. Stale drafts stay visible (better than nothing) but get a "refreshing…" badge until regenerated.
**Fallback asymmetry (discipline #63):** on LLM/parse failure the handler logs the error and **does nothing** — no write to the thread row. Rationale: a missing draft is an inconvenience Andy can absorb; a subtly-wrong cached draft that Andy trusts and sends is a burned client. The prior cached draft (if any) remains until the next inbound retriggers.
**Kill switches:** skipped (no enqueue, no generation) unless both `inbox_sync_enabled` and `llm_calls_enabled` are on.
**CCE-1 stub:** Wave 16 delivers the real Client Context Engine. Until then, `loadClientContextOrStub(contactId)` dynamically imports the future module via try/catch and falls back to a minimal shape. When Wave 16 lands, the stub path becomes unreachable and can be deleted cleanly.
