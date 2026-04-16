---
spec: docs/specs/unified-inbox.md
status: populated
populated-by: UI-2 (router — DONE), UI-3 (notifier — DONE), UI-4 (signal/noise — DONE)
---

# Unified Inbox prompts

All three are Haiku. Run in parallel for every inbound message (cost negligible, latency sub-2-second). Classifications stored on the message row; corrections feed back as learning signal.

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
