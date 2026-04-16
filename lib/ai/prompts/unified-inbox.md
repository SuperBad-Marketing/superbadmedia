---
spec: docs/specs/unified-inbox.md
status: partial
populated-by: UI-2 (router — DONE), UI-3 (notifier — DONE), UI-4 (signal/noise)
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
**Intent:** content priority (signal / noise / spam) with noise sub-classification (transactional / marketing / automated / update). **Current inline location:** spec §Q12.
**Status:** stub — lands in UI-4.
