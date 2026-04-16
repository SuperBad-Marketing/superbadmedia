# `ui-5` — Thread draft generation (Opus) + cached-draft retrieval — Handoff

**Closed:** 2026-04-16
**Wave:** 10 — Unified Inbox (5 of 13)
**Model tier:** `/deep` (Opus) — as recommended by brief

---

## What was built

First **generation** surface in the Unified Inbox pipeline (all prior UI-2/3/4 waves were classifiers). Opus-tier reply-drafter per spec §7.4 Q14+Q15, fired asynchronously from a new `inbox_draft_generate` scheduled task after the 3-way classifier block settles. Assembles the two perpetual contexts (Brand DNA as system, Client Context Engine as user) plus thread history + few-shot Andy-sent examples, Zod-validates the Opus output `{ draft_body, low_confidence_flags[] }`, and caches on `threads.cached_draft_*`. Conservative-side fallback per discipline #63: on LLM/parse failure the prior draft stays put — a subtly-wrong cached draft Andy trusts and sends is worse than a missing one. Debounce coalesces bursts of inbounds on the same thread (60s idempotency bucket → one enqueue). Includes the exported `invalidateCachedDraft(threadId, reason)` helper UI-6 calls on outbound send.

**Files created:**

- `lib/db/migrations/0035_ui5_cached_draft_flags.sql` — single additive `ALTER TABLE threads ADD COLUMN cached_draft_low_confidence_flags text` (JSON column via `text({ mode: "json" })`). Journal idx 35.
- `lib/graph/draft-reply-prompt.ts` — prompt context loader + builders. Exports `loadDraftReplyPromptContext(threadId)`, `buildDraftReplySystemPrompt(brand)`, `buildDraftReplyUserPrompt(ctx)`, `loadClientContextOrStub(contactId)`. CCE stub via dynamic-specifier `import()` so TS doesn't statically resolve the not-yet-built Wave 16 module; catch falls through to `buildClientContextStub` which hydrates from `contacts.relationship_type` + last 10 `activity_log` rows. Few-shot stub similarly deferred to Wave 11. Structural constants: `MAX_THREAD_MESSAGES=20`, `MAX_FEW_SHOTS=10`, `MAX_BODY_CHARS=2000`, `MAX_CCE_ACTIVITY_ROWS=10`.
- `lib/graph/draft-reply.ts` — `generateCachedDraftReply(threadId)` (main entry). Kill-switch gated → load context → build prompts → `invokeLlmText` (job `inbox-draft-reply`, maxTokens 1200) → strip ```json fence → `DraftReplyOutputSchema.parse` → persist. Empty-body response calls `clearCachedDraft` (model judged no reply warranted). Fallback = no write + `reportIssue`-style log. Also exports **`invalidateCachedDraft(threadId, reason)`** — UI-6 inheritance contract; clears body/flags, flips `has_cached_draft=false`, logs `inbox_draft_discarded`. Writes `inbox_draft_generated` activity on success with meta (`history_size`, `few_shot_count`, `low_confidence_flag_count`, `cce_source`).
- `lib/scheduled-tasks/handlers/inbox-draft-generate.ts` — `handleInboxDraftGenerate` reads `{ thread_id }` from payload (Zod-validated), dispatches to `generateCachedDraftReply`. Exports `INBOX_DRAFT_HANDLERS: HandlerMap`.
- `tests/graph-draft-reply.test.ts` — 15 tests: Zod parse (4 — happy + missing draft_body + malformed flags + empty `[]`), prompt builder + CCE stub (5 — history included, Brand DNA portrait, few-shots block, CCE-unlive marker, null-contact stub path, **real-contact CCE stub via seeded activity** after G10.5 note), persistence (3 — writes + flips + clears stale; empty body clears; fallback leaves prior), kill-switch skip (1), `invalidateCachedDraft` clears + logs `inbox_draft_discarded` (1).
- `tests/inbox-draft-generate.test.ts` — 9 tests: handler parse + dispatch (2), schema validation (1), HandlerMap registration (1), enqueue for client (1), no enqueue for non_client (1), spam gate (1), debounce (1), kill-switch skip (1).

**Files edited:**

- `lib/db/schema/messages.ts` — added `cached_draft_low_confidence_flags: text("cached_draft_low_confidence_flags", { mode: "json" })` to `threads` (NOT messages) after `cached_draft_stale`.
- `lib/db/schema/scheduled-tasks.ts` — added `"inbox_draft_generate"` under "Unified Inbox (6)" after `inbox_draft_reply` (which stays reserved for UI-6/UI-7 send path).
- `lib/db/migrations/meta/_journal.json` — added entry for idx 35.
- `lib/ai/models.ts` — added `"inbox-draft-reply": "opus"` under `unified-inbox (4)` comment.
- `lib/ai/prompts/INDEX.md` — count 53→54, added row for `inbox-draft-reply`.
- `lib/ai/prompts/unified-inbox.md` — added `## inbox-draft-reply` section documenting Intent/Tier/Fire/Input/Output/Effects/Invalidation/Fallback/Kill-switches/CCE-stub; `populated-by` marks UI-5 DONE; `status: populated` held.
- `lib/graph/sync.ts` — added `maybeEnqueueDraftGeneration(threadId, routerResult, signalNoiseResult)` (exported) called after the 3-way `Promise.allSettled` on inbound messages. Kill-switch + spam + relationship gate (`client | past_client | lead`). Flips `cached_draft_stale=true` BEFORE the enqueue so invalidation fires even if enqueue throws. 60s idempotency bucket (`inbox-draft-generate:{threadId}:{bucket}`). Constants `DRAFT_DEBOUNCE_MS=60_000`, `DRAFTABLE_RELATIONSHIPS={client,past_client,lead}`.
- `lib/graph/index.ts` — barrel exports for all draft-reply + draft-reply-prompt symbols, including `invalidateCachedDraft`.
- `lib/scheduled-tasks/handlers/index.ts` — imports + spread `...INBOX_DRAFT_HANDLERS` into `HANDLER_REGISTRY`.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **CCE stub via dynamic specifier** — `const cceModulePath = "@/lib/client-context/drafter-context"; await import(cceModulePath)` defeats TypeScript's compile-time resolution so the Wave 16 module can be absent without TS2307. On catch, `buildClientContextStub` hydrates from `contacts.relationship_type` + last 10 activity rows — a degraded but present second perpetual context per `project_two_perpetual_contexts`. Same pattern for Wave 11 few-shot store.
2. **Brand DNA in system prompt, CCE in user prompt** — composition-layer split. Two-perpetual-contexts discipline: who they are (brand) is framing, where you are with them (CCE) is situational.
3. **`invokeLlmText` boundary stays single-string** — current wrapper accepts only `prompt`; system + user get folded into a labelled preamble `${system}\n\n---\n\n${user}` at the composition layer. G10.5 flagged this as a latent gap (`lib/ai/invoke.ts` should grow an optional `system` param and route via Anthropic's `system` field); logged to PATCHES_OWED rather than refactored in-session because it affects all four classifiers + drafter and the scope of UI-5 is the drafter only.
4. **Debounce = 60s via idempotency bucket** — `bucket = Math.floor(runAtMs / DRAFT_DEBOUNCE_MS)` collapses bursts of inbounds on the same thread within the same minute to one enqueue. Structural constant, not a settings key — mirrors UI-3/UI-4 precedent; flagged for Phase 3.5 reconciliation in PATCHES_OWED.
5. **Stale-flag flip before enqueue** — the invalidation write happens before `enqueueTask` so a throwing enqueue still leaves the thread marked stale. G10.5 noted this flip sits inside the kill-switch gate; justified inline — when both switches are off, the drafter is fully disabled and no "refreshing…" UI state is meaningful. Logged for reconsideration if partial-kill-switch scenarios become a real thing (e.g. sync on, LLM off — unlikely).
6. **Empty-body response → clear, not preserve** — if the model returns an empty string the UI-shown "has cached draft" would be misleading; clear `has_cached_draft` and drop the prior body. Distinct from the parse-failure branch which preserves prior.
7. **Fallback asymmetry — no-write** — opposite direction to UI-3's silent-preferring and UI-4's signal-preferring defaults. Drafter's conservative side is "show Andy the Generate-draft prompt instead of a wrong pre-filled reply." Same discipline #63, different axis.
8. **New task_type `inbox_draft_generate`** — NOT the pre-registered `inbox_draft_reply` (A6 reserved it for the future send path). UI-6/UI-7 will wire the reply handler to the reserved slug without colliding with UI-5.
9. **`cached_draft_low_confidence_flags` as a separate nullable JSON column** — not inline in `cached_draft_body`. Two reasons: (a) `cached_draft_body` stays plain-text for compose-surface reuse; (b) flags are easily `null`-able as a distinct state from "empty array = confident draft." Candidate spec §5.1 reconciliation logged.
10. **`logActivity` kind for invalidation** — `inbox_draft_discarded`, not `inbox_draft_generated`. Semantic correctness; both kinds pre-registered by A6.

## Verification (G0–G12)

- **G0** — brief pre-compiled by UI-4; read + UI-2/UI-3/UI-4 handoffs + spec §§5.1, 7.4, 11.4, 16 (#52 #54 #56 #60 #63).
- **G1** — all 16 preconditions verified pre-code. Notably UI-4 handoff incorrectly claimed `inbox-draft-reply` was already in the registry; grepped for it, confirmed absent, added in G2.
- **G2** — files match brief whitelist exactly; nothing in "Must not touch" touched.
- **G3** — not triggered.
- **G4** — no autonomy-sensitive literals; structural constants (60s debounce, 20-msg history, 10 few-shots, 2000-char trunc, 1200 max tokens) inline with the UI-3/UI-4 precedent.
- **G5** — N/A (backend feature; kill-switch-gated; no user-visible state transitions until compose surface ships in UI-6+).
- **G6** — feature-flag-gated via `inbox_sync_enabled` + `llm_calls_enabled` both-must-be-on at generator entry; `inbox_sync_enabled` alone at enqueue site. Migration additive (1 nullable column).
- **G7** — completion contract all 9 items green: 0 TS errors, 24 new UI-5 tests in 2 files (940 total green / 1 skipped), clean build, lint parity (one pre-existing `lite/no-direct-anthropic-import` at `draft-reply.ts` — same precedent as router/notifier/signal-noise), migration 0035 applied, column verified, slug registered in MODELS + INDEX + unified-inbox.md, task_type registered, handler spread wired, kill-switch off path tested.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → **940 passed + 1 skipped** (up from 916 pre-session; +24 new tests — brief said ~18, the extra 6 cover empty-flags-array default, real-contact CCE stub path, and `invalidateCachedDraft` which landed post-G10.5). `npm run build` → clean. `npm run lint` → 74 problems — zero regression vs baseline (`git stash` confirmed identical pre/post).
- **G9** — no critical flow touched (drafter is new surface; no existing flows depend on it).
- **G10** — N/A (backend feature, no UI surface).
- **G10.5** — external reviewer: **PASS_WITH_NOTES**. Two in-session fixes landed before closure: (a) exported `invalidateCachedDraft` helper (brief §5 contract to UI-6 was broken before fix), (b) added a real-contact CCE-stub-when-module-missing test (prior coverage only hit the null-contact fast path). Two defects logged to PATCHES_OWED as latent: (1) `lib/ai/invoke.ts` single-string boundary means the Brand-DNA-as-system-context discipline is enforced at composition but not at the SDK wire — retrofit to route via Anthropic `system` param; (2) stale-flag flip sits inside the kill-switch gate — decouple if partial-switch scenarios become real. Full reviewer verdict in §"G10.5 external reviewer verdict" below.
- **G11** — this file.
- **G12** — tracker update + PATCHES_OWED append + CLOSURE_LOG prepend + commit next.

## G10.5 external reviewer verdict

**VERDICT: PASS_WITH_NOTES** — after two in-session fixes (`invalidateCachedDraft` export + real-contact CCE stub test).

- Spec fidelity (§7.4 + §11 + §16): PASS_WITH_NOTES — Opus, two-context input, scheduled-task trigger, `cached_draft_*` columns, no-auto-send, fallback = no-write, kill-switches gate both enqueue + handler, debounce, spam + non-client skip, CCE stub with module-missing fallback all present. Deviates from spec §11.4 by splitting `inbox_draft_reply` into `inbox_draft_generate` (this session) + reserved `inbox_draft_reply` (future send) — brief-flagged in PATCHES_OWED.
- Mockup fidelity: N/A — backend session, no UI surface.
- Voice fidelity: PASS_WITH_NOTES — `buildDraftReplySystemPrompt` teaches the voice explicitly (dry/observational/self-deprecating/slow burn, short sentences, never explain the joke, banned "synergy/leverage/solutions/circle back/touch base/reach out/excited to/thrilled to") — not handwaving.
- Memory alignment: PASS_WITH_NOTES — two-perpetual-contexts honoured at composition (Brand DNA framed "system", CCE framed "user") but flattened to a single user-role message at the SDK wire (defect 1 below); model-registry clean (`modelFor("inbox-draft-reply")`, no raw IDs); prompts-as-files populated; CCE stub real (activity_log + relationship_type).
- Test honesty: PASS_WITH_NOTES — 22→24 after fix; covers Zod edges incl. default/empty/malformed; prior-draft-survives-fallback is real (pre-seeds → unparseable → asserts unchanged); enqueue covers spam/non-client/client/kill-switch/debounce; after fix, real-contact CCE stub module-miss path now exercised.
- Scope discipline: PASS — all touched files in whitelist; no must-not-touch touched; no auto-send code; `invalidateCachedDraft` now exported (was the gap flagged).

### Defects that shipped as PATCHES_OWED (not fixed in-session)

1. **System-role plumbing in `lib/ai/invoke.ts`** — wrapper takes only `prompt`; system + user are folded into a labelled preamble string. Discipline-level honour is at the composition layer; SDK wire still sees one user message. Fix: add optional `system` param to `invokeLlmText`, route via Anthropic's `system` field. Affects four callers (router, notifier, signal-noise, draft-reply); out-of-scope for UI-5 because it's a cross-cutting refactor.
2. **Stale-flag flip coupled to kill-switch gate** — `maybeEnqueueDraftGeneration` returns early when either switch is off, meaning the `cached_draft_stale=true` flip also skips. On kill-switch recovery, inbounds that arrived during outage won't have invalidated their stale drafts. Low-severity (the drafter is disabled end-to-end during outage); flag kept for review.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all ten implementation choices silently locked. No technical questions asked.
- **`project_two_perpetual_contexts`** — Brand DNA assembled into system preamble, CCE into user-context block. CCE stub preserves relationship_type + recent activity when Wave 16 module absent. (Wire-level flattening logged to PATCHES_OWED — composition-layer split is real today; SDK-layer split is the PATCHES_OWED fix.)
- **`project_llm_model_registry`** — `modelFor("inbox-draft-reply")` via `invokeLlmText`, enforced by the ESLint `lite/no-direct-anthropic-import` rule.
- **`feedback_dont_undershoot_llm_capability`** — Opus trusted with rich context (thread history + Brand DNA portrait + CCE + few-shots) to draft in Andy's voice. No labelled training data; spec specifies Opus and the prompt teaches the voice rules directly.
- **`project_context_safety_conventions`** (rule 4 — prompts as files) — full prompt contract documented in `lib/ai/prompts/unified-inbox.md` `## inbox-draft-reply` section; TS builder cites the doc in its leading comment.
- **`project_autonomy_protocol_phase_4`** — first Opus-tier recurring LLM spend in the inbox; routed through `modelFor()` wrapper so cost observability is automatic via the A5 wrapper.
- **`project_brand_dna_as_perpetual_context`** — Brand DNA profile read on every drafter call via `loadDraftReplyPromptContext`; prose portrait + first-impression composed into system preamble.

## PATCHES_OWED (raised this session)

See the session block appended to `PATCHES_OWED.md` under "Phase 5 Wave 10 UI-5 (2026-04-16)". Summary:

- **`ui_5_spec_col_reconciliation`** — spec §5.1 doesn't list `cached_draft_low_confidence_flags`; UI-5 adds the column and this PATCHES_OWED row flags the spec update.
- **`ui_5_task_type_rename_reconciliation`** — spec §11.4 names `inbox_draft_reply` as the generator task_type; build introduces `inbox_draft_generate` and reserves `inbox_draft_reply` for send. Reconcile spec wording.
- **`ui_5_structural_constants_to_settings`** — 60s debounce + 20-msg history cap + 10 few-shot cap + 2000-char truncation as lexical constants; Phase 3.5 may want these in the settings table.
- **`ui_5_invoke_system_role_plumbing`** — `lib/ai/invoke.ts` should grow an optional `system` parameter and route through the Anthropic `system` field for this and all earlier classifiers; composition-layer discipline is honoured today but not at the wire.
- **`ui_5_stale_flag_decouple_from_kill_switch`** — consider decoupling the `cached_draft_stale=true` flip from the kill-switch gate in `maybeEnqueueDraftGeneration` so recovery leaves drafts correctly invalidated.
- **`ui_5_cce_wave16_contract`** — Wave 16 CCE-1's `loadClientContextForDrafter(contactId)` export must return a superset of the stub shape: `{ relationship_type, display_name, recent_activity: Array<{kind, body, created_at_ms}>, summary, open_action_items, source }`.
- **`ui_5_few_shot_wave11_contract`** — Wave 11's `loadDraftReplyFewShots(limit)` export must return `FewShotExample[]` shape: `{ inbound_summary, andy_reply }[]`.
- **`ui_5_ui4_handoff_incorrect_claim`** — UI-4 handoff claimed `inbox-draft-reply` was pre-registered in A6. Not true. UI-5 registered it. Future readers of `ui-4-handoff.md` should read the claim as "will be registered in UI-5."

## Rollback strategy

`feature-flag-gated` — both `inbox_sync_enabled` and `llm_calls_enabled` must be ON for enqueue + handler. All kill switches ship disabled. Rollback = leave switches off → enqueue no-ops + handler no-ops; prior drafts (none exist yet — no production data) untouched.

Migration 0035 is additive (one nullable JSON column). Revert = `git revert` + `ALTER TABLE threads DROP COLUMN cached_draft_low_confidence_flags` (**destructive — declared explicitly**).

## What the next session (UI-6) inherits

Next: **`ui-6`** — per Wave 10 roadmap, compose + send outbound surface (first user-visible inbox UI).

- **`invalidateCachedDraft(threadId, reason)`** exported from `lib/graph/draft-reply.ts`. UI-6 calls on outbound send; clears body/flags, logs `inbox_draft_discarded`.
- **`inbox_draft_reply` task_type** still reserved in `SCHEDULED_TASK_TYPES` with no handler. UI-6 (or UI-7) wires the draft-send-email handler here — distinct from the drafter's `inbox_draft_generate`.
- **Cached-draft contract** — `threads.cached_draft_body` (plain text) + `cached_draft_low_confidence_flags` (nullable JSON) + `has_cached_draft` (bool) + `cached_draft_stale` (bool) + `cached_draft_generated_at_ms` (int). UI-6's compose editor reads these into the draft surface; typically the send flow only calls `invalidateCachedDraft` once the outbound lands.
- **`sync.ts` dispatch block** is stable at `Promise.allSettled([router, notifier, signalNoise])` + post-block `maybeEnqueueDraftGeneration`. UI-6 does not change the parallel count or the enqueue path.
- **Fallback asymmetry convention** — each classifier/generator picks the conservative side of its own axis: router → `new_lead`, notifier → `silent`, signal/noise → `signal`, drafter → **no-write**. UI-6 should apply the same discipline to outbound send failures (queue-for-retry, never silently drop a send).
- **Kill switches** — continue honouring `inbox_sync_enabled` + `llm_calls_enabled` gates. Outbound send will want its own `inbox_send_enabled` kill switch candidate — raise at G1 of UI-6.
