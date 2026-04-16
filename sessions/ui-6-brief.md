# `ui-6` — Compose-new + "draft this for me" intent-to-draft — Brief

**Wave:** 10 (Unified Inbox 6 of 13 — outbound/compose backend)
**Type:** FEATURE
**Size:** medium
**Model tier:** `/deep` (Opus) — the intent-to-draft generator is Opus (customer-facing text, quality matters); session also wires invalidation, outbound send path, draft persistence. Opus review recommended for the prompt calibration + voice checks.
**Spec:** `docs/specs/unified-inbox.md` §§4.4 (Compose-new), 7.4 (Q9 "Draft this for me" — same Opus drafter, different input: a one-line user intent), 11 (cross-spec flags), 16 disciplines #52, #54, #63
**Precedent:** `sessions/ui-5-handoff.md` — UI-5 shipped the reply drafter (Opus, fires on inbound) + `invalidateCachedDraft` helper export + `inbox_draft_reply` task_type still reserved for the send path. UI-6 is the **compose side** of the same family: an Opus call seeded by Andy's one-line intent (plus optional thread context if replying to an existing thread), a compose draft row, and the outbound send wrapper that invalidates any cached reply draft.

---

## Scope — what lands in this session

1. **Intent-to-draft generator** — `lib/graph/compose-draft.ts` exports `generateComposeDraft({ intent, contactId?, threadId?, sendingAddress })`:
   - Loads Brand DNA + Client Context (CCE stub fallback, reusing UI-5's `loadClientContextOrStub`).
   - If `threadId` is provided (reply compose), loads thread history; if not (compose from scratch), loads recent Andy-sent messages to that contact (last 10) as few-shot.
   - Assembles prompt: system = Brand DNA + voice rules (reuse `buildDraftReplySystemPrompt`); user = **intent line** + context block + history/few-shots + output contract (same Zod schema as UI-5 — `{ draft_body, low_confidence_flags }`).
   - Calls Opus via `modelFor("inbox-compose-draft")` (**new slug** — different prompt, different entry point; reusing the reply slug would collapse two distinct prompts into one registry entry, breaking cost attribution).
   - Zod-validates, returns `{ draft_body, low_confidence_flags[] }`. Does NOT persist — compose drafts live in memory until save/send (see §3 below).
   - Kill-switch gated: `llm_calls_enabled` must be on (no `inbox_sync_enabled` dependency — compose is outbound, doesn't need Graph sync).
   - Fallback: no-write, same discipline #63 as UI-5 — return `{ draft_body: "", low_confidence_flags: [] }` + log via `reportIssue()`. UI surfaces "Drafting failed — try again" (not a silent pre-filled bad draft).

2. **Compose server action** — `app/lite/inbox/compose/actions.ts` (or equivalent path; check conventions):
   - `draftComposeIntent({ intent, contactId?, threadId?, sendingAddress })` → server action calling the generator; returns draft text + flags.
   - `sendCompose({ threadId?, contactId, to[], cc?, bcc?, subject?, bodyText, sendingAddress })` → creates a new thread if none supplied, writes the outbound `messages` row, calls `sendViaGraph` (UI-1 primitive), calls `invalidateCachedDraft(threadId)` (UI-5 export) on success.
   - Subject auto-generation: if `subject` blank, Haiku-derive from body (new slug `inbox-compose-subject` — tiny prompt, 60-char max output). Alternative considered + deferred: first-12-words heuristic. Haiku is cheaper than the drafter and the voice calibration matters here too.
   - Contact-lookup helper: `resolveRecipientContact(email)` — matches email to `contacts.email` (exact, case-insensitive); returns `{ contactId, company_id }` or `null` (walk-in recipient).

3. **`drafts` lifecycle** — scope decision to lock at G1:
   - **Option A (stateless compose)**: compose drafts live only in React state; never persisted. Save-to-drafts = not supported in UI-6; flagged for later UI surface. **Simpler — recommended default.**
   - **Option B (`compose_drafts` table)**: new table with `{ id, author_user_id, thread_id?, contact_id?, subject, body_text, sending_address, created_at_ms, updated_at_ms }`. Autosave every N seconds.
   - **Lock at G1**: default to A (stateless) unless spec §4.4 "Save to drafts" mention forces B. Spec reads: "Send / Save to drafts / Discard" as actions — this *does* imply a persistence surface, so B is likely required. If B, add migration 0036 + matching schema changes. Brief author lean: **Option B**, minimal table, no autosave in UI-6 (explicit Save button only), autosave as PATCHES_OWED to later compose-polish session.

4. **`inbox_draft_reply` task_type handler** — wire UI-5's reserved slug. This is where the outbound-send scheduled path finally gets a handler. **Scope call**: if `sendCompose` invokes `sendViaGraph` synchronously inside the server action, we don't need a handler — the send happens inline. **Lock at G1**: default inline synchronous send (simpler, observable, same pattern as `sendViaGraph` elsewhere). If spec demands deferred send (e.g. "send at quiet hours" from §11.4), then wire `inbox_draft_reply` handler to `enqueueTask` instead. Brief author lean: **inline synchronous send in UI-6**, the `inbox_draft_reply` handler remains reserved for a later "send-at" feature (e.g. schedule-send in the compose surface).

5. **Register LLM jobs**:
   - `inbox-compose-draft` → **Opus** in MODELS map; add row to INDEX; full section in `unified-inbox.md`.
   - `inbox-compose-subject` → **Haiku**; add row to INDEX; short section in `unified-inbox.md`.

6. **Activity log + observability**:
   - `inbox_draft_composed` — new activity_log kind when `generateComposeDraft` succeeds. Meta: `{ intent_length, contact_id, thread_id, flag_count }`.
   - `inbox_message_sent` — already registered? Check at G1. If not, add. Fires on `sendCompose` success with `{ thread_id, graph_message_id, to_count, has_attachments }`.

7. **Kill switches**:
   - `llm_calls_enabled` gates `generateComposeDraft` + `Haiku subject line` call.
   - `inbox_sync_enabled` gates `sendViaGraph` (already enforced at that layer).
   - **Consider new**: `inbox_send_enabled` kill switch for the outbound path specifically. Lock at G1. Default: add, since Andy might want to disable sends while debugging without disabling the sync.

8. **Tests** — three test files (~18 meaningful tests):
   - `tests/graph-compose-draft.test.ts` (~8): Zod parse (2), prompt includes intent + brand DNA + contact context (3), kill-switch skip (1), no-write on fallback (1), few-shot assembly from recent Andy-sent messages (1).
   - `tests/inbox-compose-actions.test.ts` (~6): `sendCompose` creates new thread if none supplied (1), `sendCompose` calls `sendViaGraph` + writes outbound row + calls `invalidateCachedDraft` (1), `sendCompose` resolves recipient contact by email (1), subject auto-generation when blank (1), `draftComposeIntent` returns flags (1), save-to-drafts writes to `compose_drafts` if Option B locked (1).
   - `tests/compose-drafts-schema.test.ts` (~4): table exists (1), FK to contacts nullable (1), FK to threads nullable (1), unique constraint on in-progress per user (1 — if applicable).

## Out of scope — do NOT build

- **Three-column inbox UI** — UI-8 territory.
- **Refine-chat sidecar** — UI-7 territory (instruction-based rewrite of an existing cached draft).
- **Attachments upload** — later session.
- **Calendar invite builder** — later session.
- **Schedule-send / send-at-time** — `inbox_draft_reply` task_type stays reserved for this; not wired in UI-6.
- **Mobile compose nudge sheet copy** — content mini-session.
- **Support@ sending-address auth** — may already be handled in `sendViaGraph`; verify at G1.

## Preconditions — verify before touching any code (G1)

1. `lib/graph/draft-reply.ts` exports `invalidateCachedDraft` (UI-5).
2. `lib/graph/send.ts` exports `sendViaGraph` (UI-1).
3. `lib/graph/draft-reply-prompt.ts` exports `loadClientContextOrStub` + `buildDraftReplySystemPrompt` (UI-5).
4. `lib/ai/models.ts` does NOT include `inbox-compose-draft` or `inbox-compose-subject`.
5. `lib/ai/prompts/INDEX.md` does NOT list either slug.
6. `lib/ai/prompts/unified-inbox.md` has UI-5's `## inbox-draft-reply` section; adds the two new ones alongside.
7. `SCHEDULED_TASK_TYPES` has `inbox_draft_reply` reserved + no handler registered yet (UI-5 left it).
8. `ACTIVITY_LOG_KINDS` — confirm `inbox_draft_composed` + `inbox_message_sent` status; add if missing.
9. `contacts.email` column exists and is queryable.
10. Spec §4.4 — confirm Save-to-drafts persistence requirement (drives Option A vs B).
11. Spec §11.4 — confirm outbound send timing (inline vs deferred).
12. No existing `app/lite/inbox/compose/` tree; UI-6 may introduce.
13. No existing `lib/graph/compose-draft.ts`; UI-6 creates.

## File whitelist — what UI-6 may touch

**Create (minimum):**
- `lib/graph/compose-draft.ts` — generator + subject helper.
- `lib/graph/compose-send.ts` OR server action file — outbound send wrapper. Path depends on Option A/B lock.
- `tests/graph-compose-draft.test.ts`
- `tests/inbox-compose-actions.test.ts`

**If Option B locks (compose_drafts table):**
- `lib/db/migrations/0036_ui6_compose_drafts.sql`
- `lib/db/schema/compose-drafts.ts`
- `tests/compose-drafts-schema.test.ts`

**Edit:**
- `lib/ai/models.ts` — two new slugs.
- `lib/ai/prompts/INDEX.md`
- `lib/ai/prompts/unified-inbox.md` — two new sections; update populated-by.
- `lib/db/schema/activity-log.ts` — add kinds if missing.
- `lib/db/schema/kill-switches.ts` — add `inbox_send_enabled` if locked.
- `lib/graph/index.ts` — barrel exports for compose module.
- `SESSION_TRACKER.md` — G12 Next Action → UI-7.
- `sessions/CLOSURE_LOG.md` — prepend session summary.

**Must not touch:**
- `lib/graph/router.ts`, `notifier.ts`, `signal-noise.ts`, `draft-reply.ts`, `draft-reply-prompt.ts` (UI-2/3/4/5 stable).
- `lib/graph/sync.ts` (inbound path unchanged).
- `lib/scheduled-tasks/handlers/inbox-hygiene-purge.ts` (UI-4).
- `lib/scheduled-tasks/handlers/inbox-draft-generate.ts` (UI-5).
- `app/lite/inbox/` list/detail surfaces (UI-8).

## Settings / constants

- **Subject auto-generation cap**: 60 chars (structural constant `COMPOSE_SUBJECT_MAX_LEN`). PATCHES_OWED candidate if Phase 3.5 wants it settings-driven.
- **Few-shot cap for compose-from-scratch**: 10 Andy-sent messages (reuse UI-5's `MAX_FEW_SHOTS` constant or mirror inline).
- **Intent line cap**: 500 chars validated at server action entry (Zod `z.string().min(1).max(500)`).

## Kill switches

- `llm_calls_enabled` — mandatory at `generateComposeDraft` + subject helper.
- `inbox_sync_enabled` — mandatory at `sendViaGraph` (already enforced).
- **New candidate**: `inbox_send_enabled` — gates outbound send specifically. Default: add for granularity.

## LLM jobs

- `inbox-compose-draft` → **Opus** via `modelFor()` (new slug).
- `inbox-compose-subject` → **Haiku** via `modelFor()` (new slug).

## Activity log kinds

- `inbox_draft_composed` — on successful draft generation. Meta: `{ intent_length, contact_id, thread_id, flag_count }`.
- `inbox_message_sent` — on successful send (check existing first). Meta: `{ thread_id, graph_message_id, to_count, has_attachments }`.
- `inbox_draft_discarded` — already registered; fires via UI-5's `invalidateCachedDraft` when UI-6 sends an outbound on a thread that had a cached reply.

## Scheduled task types

- `inbox_draft_reply` — stays reserved, no handler added in UI-6. Schedule-send feature owns this in a later session.

## Fallback behaviour

**Compose drafter failure** → return empty `draft_body` + empty flags + log. UI shows "Drafting failed — try again" (not a broken pre-filled body).

**Subject generator failure** → fall back to first-10-words of body; never blocking.

**Send failure** → throw up through the server action so the UI renders an error. Do NOT silently queue; the user composed this, they get to see that it didn't land. Retry is user-initiated.

## Completion contract (G7)

- Typecheck clean (`npx tsc --noEmit` 0 errors).
- `npm test` green (~18 new tests; total ≥ 958).
- `npm run build` clean.
- Lint: two new pre-existing `lite/no-direct-anthropic-import` (compose-draft + subject helper) acceptable per UI-2/3/4/5 precedent.
- If Option B: migration 0036 applied + `compose_drafts` table present.
- `inbox-compose-draft` + `inbox-compose-subject` slugs registered in MODELS + INDEX + unified-inbox.md.
- `invalidateCachedDraft` is called from `sendCompose` (test-covered).
- Kill-switches off → no LLM call, no Graph send, no writes, no exceptions.

## Rollback strategy

`feature-flag-gated`. Kill switches ship disabled. If Option B: migration additive (one table + indexes). Revert via `git revert` + `DROP TABLE compose_drafts` (destructive — declare in handoff).

## Memory alignment gates (G10.5 reviewer will check)

- **`feedback_technical_decisions_claude_calls`** — Option A/B lock, inline-vs-deferred send, new kill switch, subject generator approach — all silently locked in G1. No technical questions to Andy.
- **`project_two_perpetual_contexts`** — compose drafter reads **both** Brand DNA (system) and CCE (user context), same as UI-5. Reuse UI-5's prompt primitives.
- **`project_llm_model_registry`** — `modelFor("inbox-compose-draft")` + `modelFor("inbox-compose-subject")`. No raw model IDs.
- **`feedback_dont_undershoot_llm_capability`** — trust Opus to reason from intent + context; don't over-scaffold with templates.
- **`project_context_safety_conventions`** — prompts-as-files: both new slugs get sections in `unified-inbox.md` with Intent/Tier/Input/Output/Effects.
- **`ui_5_invoke_system_role_plumbing`** (PATCHES_OWED from UI-5) — G10.5 will note this again if UI-6 keeps the labelled-preamble pattern. If the `lib/ai/invoke.ts` refactor happens in UI-6, consume the new `system` param; otherwise PATCHES_OWED carries forward.
- **Voice profile** — compose drafter must teach the same voice rules as UI-5. Reuse `buildDraftReplySystemPrompt(brand)` verbatim if possible; if an intent-specific variant is needed, justify inline.

## What UI-7 inherits

- **Refine-chat sidecar** (Opus instruction-based rewrite of an existing cached draft) consumes UI-5's cached-draft columns and UI-6's compose-send plumbing. UI-7 does not add a new send path — it calls the same `sendCompose` server action with a modified body.
- If Option B landed, UI-7 may reuse `compose_drafts` table for refine sessions too.

## PATCHES_OWED additions (provisional)

1. Subject auto-gen 60-char cap → settings key candidate for Phase 3.5.
2. Autosave for `compose_drafts` (if Option B) deferred to compose-polish session.
3. Send-at / schedule-send — `inbox_draft_reply` task_type still reserved.
4. Mobile compose nudge sheet copy (content mini-session).

---

## G0 kickoff ritual

1. Read this brief.
2. Read `sessions/ui-5-handoff.md` + `sessions/ui-4-handoff.md`.
3. Read spec §§4.4 (compose-new), 7.4 (Q9 intent-to-draft), 11 (cross-spec), 16 disciplines.
4. Read `lib/graph/draft-reply.ts` + `draft-reply-prompt.ts` (reuse primitives).
5. Read `lib/graph/send.ts` (existing `sendViaGraph`).
6. Verify all 13 preconditions. **Lock Option A vs B + inline-vs-deferred send + new kill-switch decisions** silently per `feedback_technical_decisions_claude_calls`.
7. Load skills: `drizzle-orm`, `typescript-validation`, `spec-driven-development`.
8. Build order:
   1. (If Option B) Migration + schema + journal entry.
   2. Register the two new slugs in MODELS + INDEX + unified-inbox.md.
   3. Activity log kinds + kill switch additions.
   4. `compose-draft.ts` generator + subject helper.
   5. Server actions + `sendCompose` + `invalidateCachedDraft` wiring.
   6. Tests.
   7. Typecheck + test + build + lint.
   8. Handoff; tracker flip; closure-log prepend; commit.
