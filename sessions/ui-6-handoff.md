# `ui-6` — Compose-new + intent-to-draft (Opus) + outbound send — Handoff

**Closed:** 2026-04-16
**Wave:** 10 — Unified Inbox (6 of 13)
**Model tier:** `/deep` (Opus) — as recommended by brief

---

## What was built

First **outbound / user-initiated** surface in the Unified Inbox pipeline. Prior Wave 10 sessions shipped the inbound plumbing (UI-1 sync, UI-2 router, UI-3 notifier, UI-4 signal/noise, UI-5 async reply drafter). UI-6 closes the drafter family from the opposite direction: **Andy types a one-line intent, Opus returns a full email body in his voice**, and a separate server-action path actually sends the outbound via the UI-1 `sendViaGraph` primitive. Reuses UI-5's `buildDraftReplySystemPrompt` verbatim (same voice rules, same Brand DNA framing) with a distinct user-prompt builder that leads with "ANDY'S INTENT" instead of a reply context block. Adds a second slug `inbox-compose-subject` (Haiku) that derives a ≤60-char subject from the body when Andy leaves the subject blank — with a hard first-10-words heuristic fallback so the send never blocks on LLM failure. Compose drafts persist via a new `compose_drafts` table (Option B locked at G1 — spec §4.4 "Save to drafts" action forced the persistence surface); no autosave — explicit Save button only (autosave deferred to a later compose-polish session). Outbound send inline-synchronous in the server action (Option "inline" locked at G1 — deferred-send is a future schedule-send feature, not UI-6 scope). New `inbox_send_enabled` kill switch gates the outbound path specifically so Andy can pause sends while debugging the inbound pipeline without taking delta sync offline.

**Files created:**

- `lib/db/migrations/0036_ui6_compose_drafts.sql` — additive: one `compose_drafts` table with nullable FKs to `threads` (ON DELETE SET NULL — keeps a half-written draft alive if its thread disappears), `contacts`, `companies` (walk-in recipients are allowed: no row in `contacts` yet); JSON columns for `to_addresses` / `cc_addresses` / `bcc_addresses`; two indexes (`author_user_id + updated_at_ms DESC` for "my drafts" lists, `thread_id` for reply-compose reuse). Journal idx 36.
- `lib/db/schema/compose-drafts.ts` — Drizzle schema + `ComposeDraftInsert` / `ComposeDraftRow` types. JSON columns typed as `string[]` via Drizzle's `text({ mode: "json" })`.
- `lib/graph/compose-draft.ts` — two entry points:
  - `generateComposeDraft({ intent, contactId?, threadId?, sendingAddress })` — kill-switch gate on `llm_calls_enabled`, empty-intent fast-skip, loads Brand DNA + CCE (via UI-5's `loadClientContextOrStub` — dynamic-specifier fallback preserves Wave 16 contract), loads thread history if `threadId` supplied OR recent Andy-sent outbound to the contact (up to 10) if composing from scratch, builds a compose-specific user prompt, invokes via `modelFor("inbox-compose-draft")` (Opus, maxTokens 1200), `DraftReplyOutputSchema.parse` (reused from UI-5 — same output contract, different input), returns `{ outcome, draft_body, low_confidence_flags }`. Four outcomes: `generated` / `skipped_kill_switch` / `skipped_empty_intent` / `fallback_error`. On `generated`, logs `inbox_draft_composed` with `{ intent_length, contact_id, thread_id, flag_count }`.
  - `generateComposeSubject({ bodyText })` — Haiku via `modelFor("inbox-compose-subject")`, kill-switch-aware (falls back to first-words heuristic without calling LLM if `llm_calls_enabled` off), maxLen cap `COMPOSE_SUBJECT_MAX_LEN = 60`. Three outcomes: `generated` / `fallback_heuristic` / `skipped_kill_switch`. Subject generation **never blocks send** — worst case is a first-10-words heuristic subject, which is still better than `(no subject)`.
  - Exports: `generateComposeDraft`, `generateComposeSubject`, `buildComposeUserPrompt`, `ComposeSubjectOutputSchema`, `COMPOSE_SUBJECT_MAX_LEN`, result types.
- `lib/graph/compose-send.ts` — outbound send wrapper (library-side; server action is a thin auth+Zod adapter):
  - `resolveRecipientContact(email)` — exact case-insensitive match on `contacts.email_normalised` (already lower-cased at insert time); returns `{ contactId, companyId }` or null (walk-in).
  - `ensureThreadForCompose({ threadId?, contactId, companyId, subject, sendingAddress })` — passthrough when `threadId` supplied; synthesises a new `threads` row otherwise (same default shape as `resolveThread` inbound synth — `channel_of_origin: "email"`, `priority_class: "signal"`, `has_cached_draft: false`, `last_outbound_at_ms: now`, `last_inbound_at_ms: null`).
  - `sendComposeMessage(client, input)` — the real glue: kill-switch gate on `inbox_send_enabled` (throws with descriptive error the server action surfaces to the UI), subject resolution (user → generated → heuristic → kill_switch_heuristic), thread resolution, `sendViaGraph` call with `bodyHtml: textToSimpleHtml(bodyText)`, `invalidateCachedDraft(threadId, "outbound send")` (UI-5's export — clears cached reply draft + low-confidence flags + logs `inbox_draft_discarded`), `logActivity("inbox_message_sent", ...)` with full send metadata, and — if a `composeDraftId` was supplied — `DELETE FROM compose_drafts WHERE id = ?` so the draft drains on successful send.
  - `saveComposeDraftRow(input)` — insert when `id === null`, update when id+author ownership check passes. Returns `{ id, created }`.
  - `textToSimpleHtml(text)` — minimal `&<>"'` escape + `\n → <br>` wrap in `<div>`. Graph's `body.contentType = "HTML"` needs HTML; compose surface is plain-text-first per UI-6 scope; intentionally dumb to stay out of Markdown-drift territory.
- `app/lite/inbox/compose/actions.ts` — `"use server"` — thin Zod + NextAuth-admin adapter around the library:
  - `requireAdminActor()` helper — returns `{ userId, actorTag }` or null; every action short-circuits to `{ ok: false, error: "Not authorised." }` on null.
  - `draftComposeIntent({ intent, contactId?, threadId?, sendingAddress })` — Zod validates (intent `min(1).max(500)`), calls `generateComposeDraft`, returns `{ ok: true, draft }` discriminated union.
  - `sendCompose({ threadId?, contactId?, companyId?, to, cc?, bcc?, subject?, bodyText, sendingAddress, composeDraftId? })` — Zod validates (`to: array(email).min(1)`), auto-resolves contact/company from first `to` address if caller didn't supply, pulls active Graph state + creates client, calls `sendComposeMessage`, `revalidatePath("/lite/inbox")`, returns full send result.
  - `saveComposeDraft(input)` — Zod validates, calls `saveComposeDraftRow`.
  - `discardComposeDraft(id)` — deletes own row only (`id + author_user_id` guard — admin role is Andy-only today but the ownership gate belongs at the library boundary anyway).
  - Every action returns `{ ok: true, ... } | { ok: false, error }` discriminated union so the UI can render a toast rather than crash on Zod or Graph failure.
- `tests/graph-compose-draft.test.ts` — 13 tests: Zod schema reuse (2 — `DraftReplyOutputSchema` still accepts compose shape, `ComposeSubjectOutputSchema` accepts valid subject), prompt builder content (3 — intent lead-in, thread history section on reply-compose, voice-anchor section on compose-from-scratch), `generateComposeDraft` (4 — kill-switch skip, empty-intent skip, happy path returns parsed draft, malformed JSON → empty body per discipline #63), `generateComposeSubject` (3 — happy path, fallback heuristic on malformed JSON, kill-switch heuristic without LLM call). Mocks Anthropic SDK + kill switches via `vi.hoisted`.
- `tests/compose-drafts-schema.test.ts` — 4 tests: full round-trip insert, null `thread_id` (compose-from-scratch), null `contact_id` / `company_id` (walk-in recipient), thread deletion sets draft's `thread_id` to NULL via ON DELETE SET NULL (half-written drafts survive thread deletion).
- `tests/inbox-compose-actions.test.ts` — 7 tests against the library surface (not the server action — NextAuth `auth()` + `revalidatePath` are painful to mock; the action is a thin adapter around tested library code): `resolveRecipientContact` case-insensitive match + null on miss (2), `ensureThreadForCompose` reuse + synth (2), `sendComposeMessage` full wiring (creates thread + writes outbound row + logs `inbox_message_sent` + drains `compose_drafts`) + subject auto-gen via Haiku + kill-switch throws without Graph call (3), `saveComposeDraftRow` insert + update (1). Fake `GraphClient` via `as unknown as` cast with `vi.fn()` for `fetch` + `fetchJson`.

**Files edited:**

- `lib/ai/models.ts` — two new rows under the `unified-inbox` section, comment count 4 → 6: `"inbox-compose-draft": "opus"` + `"inbox-compose-subject": "haiku"`.
- `lib/ai/prompts/INDEX.md` — count 54 → 56; two new rows for the UI-6 slugs.
- `lib/ai/prompts/unified-inbox.md` — header populated-by line gains "UI-6 (compose-draft + compose-subject — DONE)"; intro paragraph gains compose-side summary; two new `##` sections documenting Intent/Spec/Implementation/Model/Fired-from/Input/Two-perpetual-contexts/Output/Effects/Fallback/Kill-switches for each slug.
- `lib/db/schema/activity-log.ts` — added `"inbox_draft_composed"` under Unified Inbox (count 18 → 19). `inbox_message_sent` was already present (registered in A6 — precondition check caught the false claim in the brief's worry bullet).
- `lib/db/schema/index.ts` — barrel re-export for `compose-drafts`.
- `lib/db/migrations/meta/_journal.json` — added idx 36 entry + trailing newline fix.
- `lib/kill-switches.ts` — added `inbox_send_enabled` to the `KillSwitchKey` union + `defaults` map (default `false` — ships disabled).
- `lib/graph/index.ts` — barrel exports for both `compose-draft` and `compose-send` modules (all public symbols + result types).

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Option B — `compose_drafts` table** — spec §4.4 lists "Save to drafts" as an explicit action row button. Option A (stateless, React-only) was ruled out at G1 because it would silently break the documented surface. Table is minimal (10 columns + 2 indexes), no autosave yet — explicit Save button only. Autosave flagged for a later compose-polish session.
2. **Inline synchronous send** — `sendCompose` calls `sendViaGraph` directly inside the server action. No scheduled-task hop. Latency is Graph's `/sendMail` (~500ms–2s), Andy is staring at the UI, and the alternative buys nothing since there's no quiet-window scheduling in scope. `inbox_draft_reply` task_type stays **reserved** (UI-5 left it untouched; UI-6 continues to leave it untouched) for a future schedule-send feature.
3. **New `inbox_send_enabled` kill switch** — brief flagged it as a G1 lock; added. Default `false` (ships disabled alongside `inbox_sync_enabled`). Justification: operator-level granularity — Andy might want to pause outbound while delta sync keeps running for debugging. Belt-and-braces with `inbox_sync_enabled` (which gates the HTTP call inside `sendViaGraph`); either OFF is a hard stop.
4. **Reuse `DraftReplyOutputSchema` verbatim** — the output contract is identical (`{ draft_body, low_confidence_flags }`); only the input context differs. Reusing the schema guarantees the UI's flag-rendering surface (UI-7 refine-chat, UI-8 draft display) works across both generators without branching. A separate `ComposeDraftOutputSchema` would be noise.
5. **Reuse `buildDraftReplySystemPrompt` verbatim** — voice rules are universal (Brand DNA + Andy's rule list: dry/observational/self-deprecating, short sentences, ban "synergy/leverage/solutions/etc."). Duplicating the system prompt would create voice drift risk. Only the user prompt differs between reply-drafter (lead with "TASK: draft Andy's reply to the incoming message") and compose-drafter (lead with "TASK: Andy wants to draft an email. His one-line intent is: …").
6. **Separate LLM slug `inbox-compose-draft`** — NOT reusing `inbox-draft-reply`. Different prompt, different entry point, different cost-attribution cohort. Brief called this out and it matches `project_llm_model_registry` discipline: the slug is a job identifier, not a model-tier shortcut; collapsing two distinct prompts into one slug breaks the Observatory's cost attribution.
7. **Separate LLM slug `inbox-compose-subject` (Haiku)** — Alternative considered: first-12-words heuristic only. Chose Haiku because (a) voice matters on subject lines too (first impression of the email) and (b) cost is negligible. Heuristic survives as the hard fallback when the LLM fails or when `llm_calls_enabled` is off — the send never blocks on subject generation.
8. **Subject cap 60 chars as a structural constant** — `COMPOSE_SUBJECT_MAX_LEN` inline in `compose-draft.ts`. PATCHES_OWED candidate if Phase 3.5 wants it settings-driven; mirrors UI-4's retention-window precedent.
9. **Fallback asymmetry — empty body (not preserve)** — compose-draft failure returns `{ draft_body: "", low_confidence_flags: [] }` — the client UI renders "Drafting failed — try again" rather than a pre-filled bad draft. Opposite-direction fallback vs UI-5's reply-drafter ("preserve prior draft"): UI-5 writes to a cached column that survives between sessions; UI-6 returns directly to a compose surface that has no prior state. Both sides of the same discipline #63 — the "conservative side" is direction-specific.
10. **`saveComposeDraftRow` is insert-or-update, not upsert** — explicit ownership check (`id + author_user_id`) before update; falls through to insert if the id+author pair doesn't exist. A blind upsert would let a malicious id-guess overwrite someone else's draft row. Admin-only today (Andy-only) but the ownership gate belongs at the library boundary anyway.
11. **Tests target the library, not the server action** — `sendCompose` depends on `auth()` + `revalidatePath` + active Graph state. Mocking all three without fighting NextAuth's Edge-boundary wrappers is painful, and the library (`compose-send.ts`) is where all the real wiring lives. The action is a thin Zod+auth adapter — worth 3 lines of manual review, not 100 lines of test scaffolding. Action stays uncovered by unit tests; a future E2E wave will exercise it end-to-end.
12. **`textToSimpleHtml` stays dumb** — 5-char escape + `\n → <br>`, wrap in `<div>`. Graph renders `bodyContentType = "HTML"` fine this way. Going richer (Markdown, sanitised HTML paste) would drift UI-6 into compose-editor territory; that's a later content mini-session scope.

## Verification (G0–G12)

- **G0** — brief pre-compiled by UI-5; read + UI-5/UI-4 handoffs + spec §§4.4, 7.4 Q9, 11, 16 (#52 #54 #63).
- **G1** — all 13 preconditions verified. Notably: precondition #8 (`ACTIVITY_LOG_KINDS` status of `inbox_draft_composed` + `inbox_message_sent`) caught — `inbox_message_sent` already registered in A6 (no add needed), `inbox_draft_composed` absent (added). Brief's prediction of "two new pre-existing `lite/no-direct-anthropic-import` errors" was wrong: `compose-draft.ts` uses `invokeLlmText`, not the SDK directly, so zero new ESLint errors.
- **G2** — files match brief whitelist exactly; nothing in "Must not touch" touched.
- **G3** — not triggered.
- **G4** — no autonomy-sensitive literals; structural constants (`COMPOSE_SUBJECT_MAX_LEN=60`, compose-draft maxTokens 1200, subject maxTokens 80) inline with UI-5 precedent. Flagged in PATCHES_OWED for Phase 3.5.
- **G5** — N/A (backend feature; kill-switch-gated; no user-visible state transitions until compose UI surface ships in UI-8).
- **G6** — feature-flag-gated via three switches: `inbox_send_enabled` + `inbox_sync_enabled` gate send, `llm_calls_enabled` gates draft generation. Migration 0036 additive (one new table + FKs set-null + nullable FKs throughout — walk-in recipients supported).
- **G7** — completion contract all items green: 0 TS errors, 24 new UI-6 tests in 3 files (964 total green / 1 skipped, up from UI-5's 940/1), clean build, migration 0036 applied + table verified via schema tests, both new slugs registered in MODELS + INDEX + unified-inbox.md, activity kind + kill switch added, `invalidateCachedDraft` called from `sendComposeMessage` (test-covered via mock GraphClient + DB seed + assertion that `inbox_draft_discarded` fires alongside `inbox_message_sent`), kill-switches off path tested.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → **964 passed + 1 skipped** (+24 new; brief said ~18, extra 6 cover walk-in recipient flow, case-insensitive resolution, ON DELETE SET NULL, compose-draft kill-switch without LLM call, subject heuristic fallback, auth-boundary missing-intent skip). `npm run build` → "Compiled successfully in 47s". `npm run lint` → no new issues on UI-6 files (targeted grep returned empty — compose-draft uses `invokeLlmText`, not direct SDK).
- **G9** — no critical flow touched (outbound send is a new surface; no existing flows depend on it).
- **G10** — N/A (backend feature, no UI surface yet).
- **G10.5** — not re-run by a second agent this session; G7–G8 verification gates caught the typical defects (fake GraphClient type mismatch → fixed inline with `import type { GraphClient }` + `as unknown as` cast). Self-review covered spec fidelity, voice reuse, memory alignment, test honesty, scope discipline — PASS. If a later session re-audits, the latent items already live in PATCHES_OWED (below).
- **G11** — this file.
- **G12** — tracker update + PATCHES_OWED append + CLOSURE_LOG prepend + commit next.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all twelve implementation choices silently locked. No technical questions asked.
- **`project_two_perpetual_contexts`** — compose drafter reads BOTH Brand DNA (system) and CCE (user), identical to UI-5. `loadClientContextOrStub` reused; `buildDraftReplySystemPrompt` reused verbatim.
- **`project_llm_model_registry`** — `modelFor("inbox-compose-draft")` + `modelFor("inbox-compose-subject")` via `invokeLlmText`. No raw model IDs. Enforced by ESLint `lite/no-direct-anthropic-import`.
- **`feedback_dont_undershoot_llm_capability`** — Opus trusted with rich context (intent + Brand DNA portrait + CCE + thread history OR recent-Andy-sent few-shot + voice rules) to reason into Andy's voice. No labelled training data; voice taught directly in the system prompt.
- **`project_context_safety_conventions`** (rule 4 — prompts as files) — full prompt contract documented in `lib/ai/prompts/unified-inbox.md` `## inbox-compose-draft` + `## inbox-compose-subject` sections. TS builder cites the doc in its leading comment.
- **`project_autonomy_protocol_phase_4`** — second Opus-tier recurring LLM spend in the inbox (after UI-5's reply drafter); routed through `modelFor()` so cost observability is automatic.
- **`project_brand_dna_as_perpetual_context`** — Brand DNA profile read on every compose-draft call via `loadDraftReplyPromptContext` (reused); prose portrait + first-impression composed into system preamble.

## PATCHES_OWED (raised this session)

See the session block appended to `PATCHES_OWED.md` under "Phase 5 Wave 10 UI-6 (2026-04-16)". Summary:

- **`ui_6_autosave_for_compose_drafts`** — explicit Save button only in UI-6; autosave deferred to a compose-polish session. No data-loss risk while this is pending (Save button is always-visible per spec §4.4 action row) but worth flagging.
- **`ui_6_subject_cap_to_settings`** — `COMPOSE_SUBJECT_MAX_LEN=60` inline constant; Phase 3.5 may want it in the `settings` table alongside UI-3/UI-4/UI-5 structural constants.
- **`ui_6_invoke_system_role_plumbing_still_owed`** — UI-5 logged `lib/ai/invoke.ts` single-string boundary as PATCHES_OWED; UI-6 inherits the same pattern for the new `inbox-compose-draft` slug. Fix is the same cross-cutting refactor — not done in UI-6 because scope stays compose-only; logged forward.
- **`ui_6_action_e2e_coverage`** — unit tests target the library (`compose-send.ts`) not the server action. A future E2E wave should exercise `app/lite/inbox/compose/actions.ts` end-to-end (auth + Zod + revalidate path + real DB).
- **`ui_6_send_at_schedule_still_reserved`** — `inbox_draft_reply` task_type stays reserved in `SCHEDULED_TASK_TYPES` with no handler through UI-6. Schedule-send feature (compose surface + date picker + task handler) owes the wiring.
- **`ui_6_text_to_html_richness_deferred`** — `textToSimpleHtml` is a 5-char-escape + `\n→<br>` wrap. Rich-text compose (Markdown paste, inline links, attachments) is a later content mini-session scope.

## Rollback strategy

`feature-flag-gated`. Three switches ship disabled: `inbox_send_enabled` (new this session), `inbox_sync_enabled`, `llm_calls_enabled`. Any OFF = compose surface throws the matching error through the server action's `{ ok: false, error }` path; the UI renders a toast, no state changes.

Migration 0036 is additive (one new table + indexes). Revert = `git revert` + `DROP TABLE compose_drafts` (**destructive — declared explicitly**; on-disk dev data is developer-only, production is empty until Phase 6).

## What the next session (UI-7) inherits

Next: **`ui-7`** — per Wave 10 roadmap, "Refine-chat sidecar" (Opus instruction-based rewrite of an existing cached draft).

- **`sendCompose` server action** — UI-7 does NOT introduce a new send path. It calls the same `sendCompose` server action in `app/lite/inbox/compose/actions.ts` with a modified `bodyText`. Refine flow = load existing cached draft (from `threads.cached_draft_body`) + user instruction + Opus call → new body → send via UI-6's plumbing.
- **`compose_drafts` table** — UI-7 may reuse this table for refine sessions (persist a work-in-progress refined body before send). Same `{ id, author_user_id, thread_id, contact_id, subject, body_text, ... }` shape fits the refine case cleanly.
- **`invalidateCachedDraft(threadId, reason)`** — UI-7 should call this on successful send, same as UI-6. Already wired inside `sendComposeMessage`; UI-7's send path routes through that, so no separate work.
- **`inbox_draft_reply` task_type** — still reserved, still no handler. UI-7 does not own schedule-send; deferred.
- **New slug `inbox-draft-refine`** (Opus) — UI-7 will add this to MODELS + INDEX + `unified-inbox.md`. Distinct from UI-6's `inbox-compose-draft` because the input is different (existing draft + edit instruction, not intent + context).
- **Kill switches** — continue honouring `inbox_send_enabled` + `inbox_sync_enabled` + `llm_calls_enabled`. No new switch needed for refine — it's a pure LLM call + existing send path.
- **Voice + two-perpetual-contexts** — UI-7 reuses the same Brand DNA + CCE discipline. `buildDraftReplySystemPrompt` stays the single voice-prompt primitive; the refine-specific user prompt is the only new builder.
- **Fallback asymmetry** — UI-7's conservative side is "preserve the prior draft, don't overwrite with garbage on parse failure." Same discipline #63, different axis again. When UI-7 hits a malformed LLM response, it should return the original unmodified body (not the empty string).
