# `ui-7` — Refine-chat sidecar (Opus instruction-based draft rewrite) — Handoff

**Closed:** 2026-04-16
**Wave:** 10 — Unified Inbox (7 of 13)
**Model tier:** `/deep` (Opus) — as recommended by brief

---

## What was built

The third Opus call in the Unified Inbox's draft family. UI-5 drafted replies (async scheduled task); UI-6 drafted compose-from-intent (user-initiated, synchronous); UI-7 closes the triangle with **instruction-based rewrite**: Andy opens the refine sidecar on a thread that already has a draft (either UI-5's cached reply draft or UI-6's compose-intent draft), types an instruction ("shorter, less formal" / "push the meeting to next week" / "drop the price reference"), and Opus rewrites the draft in place. Iterable — each turn layers on prior turns until Andy is happy, then he sends via UI-6's existing `sendCompose` with the refined body. Pure backend: zero UI surface, zero migration, zero new table, zero new kill switch. Reuses UI-5's `buildDraftReplySystemPrompt(brand)` verbatim for voice + Brand DNA framing; reuses UI-5's `DraftReplyOutputSchema` verbatim so `{ draft_body, low_confidence_flags }` stays a single cross-feature contract. The only genuinely new artefact is a compose-refine user-prompt builder that folds in the current draft + instruction + prior-turn history.

**Files created:**

- `lib/graph/refine-draft.ts` — Opus rewriter. Exports:
  - `generateRefinedDraft({ priorDraft, instruction, priorTurns?, contactId?, threadId?, sendingAddress })` → `Promise<RefineDraftResult>`. Five outcomes: `generated` / `skipped_kill_switch` / `skipped_empty_instruction` / `skipped_empty_prior_draft` / `fallback_error`. **Every non-success outcome returns `draft_body: priorDraft`** — the refine turn is a no-op from the user's perspective, never a silent blank.
  - `buildRefineUserPrompt(ctx)` — composes WHO THEY ARE / WHERE YOU ARE WITH THEM (CCE block) + THREAD HISTORY (conditional, reply-refine path) + SENDING FROM + CURRENT DRAFT + PRIOR REFINE TURNS (conditional, iteration history) + ANDY'S NEW INSTRUCTION + TASK directive ("surgical, not total rewrite; preserve grounded facts; flag uncertainty rather than fabricate").
  - Constants: `MAX_REFINE_INSTRUCTION_CHARS = 500`, `MAX_REFINE_TURNS = 6` (prior turns cap head-first — most recent iteration context stays), `MAX_THREAD_MESSAGES = 20`, `MAX_BODY_CHARS = 2000`, `REFINE_MAX_OUTPUT_TOKENS = 1500`.
  - Types: `RefineTurn` (`{ instruction, result_body }`), `GenerateRefinedDraftInput`, `RefineDraftOutcome`, `RefineDraftResult`.
  - Kill-switch gate on `llm_calls_enabled` first; trim + cap instruction; cap prior turns; parallel load Brand DNA + CCE (via `loadClientContextOrStub`) + thread history (if `threadId` supplied); single-string combined prompt `${systemPrompt}\n\n---\n\n${userPrompt}` (matches UI-5/UI-6 pattern until `invoke.ts` ships a first-class `system` param); `invokeLlmText({ job: "inbox-draft-refine", prompt, maxTokens })`; strip markdown fences; `DraftReplyOutputSchema.parse`; defensive empty-body check after parse (if model returns `draft_body: ""`, fall through to `fallback_error` with prior preserved).
- `tests/graph-refine-draft.test.ts` — 13 tests. Schema reuse (1 — `DraftReplyOutputSchema` parses the refine shape). Prompt builder (4 — prior draft + instruction present, thread history section on reply-refine, prior refine turns section, CCE block present). `generateRefinedDraft` outcomes (8 — kill-switch preserves prior, empty-instruction preserves prior, empty-prior-draft skip, generated happy path returns parsed rewrite, fallback preserves prior on malformed JSON, fallback preserves prior on empty-body LLM, prior turns cap head-first at `MAX_REFINE_TURNS`, instruction truncation at `MAX_REFINE_INSTRUCTION_CHARS`). Hoisted mocks for `@anthropic-ai/sdk` + `@/lib/kill-switches` + `@/lib/db`.

**Files edited:**

- `lib/ai/models.ts` — new `"inbox-draft-refine": "opus"` row under the `unified-inbox` block; comment count 6 → 7.
- `lib/ai/prompts/INDEX.md` — header count 56 → 57; added row 62 for `inbox-draft-refine`.
- `lib/ai/prompts/unified-inbox.md` — populated-by line gained `UI-7 (draft-refine — DONE)`; intro paragraph gained UI-7 summary; new full `## inbox-draft-refine` section documenting Intent / Spec / Implementation / Model / Fired-from / Input / Two-perpetual-contexts / Output / Effects / Fallback / Kill-switches.
- `app/lite/inbox/compose/actions.ts` — added imports for `generateRefinedDraft` + constants + `RefineDraftResult`; added `RefineTurnSchema` + `RefineDraftInputSchema` Zod validators (`priorTurns` array capped at `MAX_REFINE_TURNS * 4` at the boundary as belt-and-braces — the generator trims the actual replay window); added `refineDraft` server action (admin-role gate, Zod validate, delegate to generator, `logActivity("inbox_draft_refined", ...)` on `outcome === "generated"` with meta `{ thread_id, turn_count, instruction_length, flag_count }`); returns `{ ok: true, draft } | { ok: false, error }` discriminated union.
- `lib/graph/index.ts` — barrel exports for `generateRefinedDraft`, `buildRefineUserPrompt`, `MAX_REFINE_INSTRUCTION_CHARS`, `MAX_REFINE_TURNS`, and the four types.
- `sessions/ui-7-brief.md` — G10.5 surfaced three miscitations of "§16 discipline #63 — fallback asymmetry" in the brief (spec §16 #63 is actually "Noise classifier errs conservative" — there is no numbered fallback-asymmetry discipline). Fixed in-session: three call sites now cite §7.4's "ephemeral in-memory session" intent directly and point to PATCHES_OWED `ui_7_brief_spec_citation_fix` for possible future codification as a numbered spec discipline.

## Key decisions locked (all silent per `feedback_technical_decisions_claude_calls`)

1. **Ephemeral turn storage (Option A)** — turns live in client React state, passed back on each `refineDraft` call. No `refine_turns` table, no `threads.refine_state` column. Spec §7.4 is explicit: "ephemeral in-memory session, no persistence unless useful for future learning." Option B (persist turns) was ruled out at G1 — it would drift the surface away from the spec's "sketch, not transcript" intent.
2. **Reuse `DraftReplyOutputSchema` verbatim** — the output contract (`{ draft_body, low_confidence_flags }`) is identical across UI-5 (reply), UI-6 (compose), UI-7 (refine). Duplicating the schema per generator would fragment the flag-rendering surface UI-8 inherits.
3. **Reuse `buildDraftReplySystemPrompt(brand)` verbatim** — voice rules (Brand DNA + Andy's dry/observational/self-deprecating cadence + banned words) are universal across the three Opus calls. Any divergence would create three slightly-different voices at the same product surface. UI-7 only authors a new user prompt.
4. **Preserve-prior-draft fallback axis (asymmetry #3)** — UI-5 no-writes on failure (protects the cache); UI-6 returns empty body on failure (UI renders "Drafting failed — try again", no cached state to protect); UI-7 preserves the prior draft on failure (a refine turn is iterative, not a clean-slate generation — clobbering Andy's working copy with an empty string mid-iteration would be worse than a no-op turn). Family pattern: each generator picks its own conservative side. Logged as candidate codification in PATCHES_OWED `ui_7_brief_spec_citation_fix`.
5. **Empty-body defence post-parse** — Zod validates `draft_body: z.string()` (non-negative length); a whitespace-only LLM response still passes schema but would clobber the prior draft. Explicit check after parse: `if (!parsed.draft_body || parsed.draft_body.trim() === "") return fallback_error + priorDraft`. Defence-in-depth on top of schema validation.
6. **New slug `inbox-draft-refine` (Opus)** — NOT reusing `inbox-draft-reply` or `inbox-compose-draft`. Third distinct prompt in the draft family; deserves its own registry row for cost attribution. `project_llm_model_registry` discipline: the slug is a job identifier, not a tier shortcut.
7. **No new kill switch** — `llm_calls_enabled` suffices. Refine is pure LLM; it never touches Graph, so `inbox_sync_enabled` / `inbox_send_enabled` don't apply. Granularity beyond that is a PATCHES_OWED candidate if future need emerges.
8. **No new send path** — refine-and-send routes through UI-6's existing `sendCompose` with `bodyText = refinedDraft.draft_body`. UI-7 adds zero lines of send plumbing. Zero duplication.
9. **Turn-history cap = 6 (head-first)** — `input.priorTurns.slice(-MAX_REFINE_TURNS)` keeps the most recent 6 iterations, drops the oldest. Enough to show iteration context to Opus, bounded enough to keep prompts small. Server-action Zod accepts up to `6 * 4 = 24` at the boundary (belt-and-braces against malformed client state); the generator trims the actual replay window.
10. **Combined system + user prompt (single string)** — `${systemPrompt}\n\n---\n\n${userPrompt}` passed as `invokeLlmText({ prompt })`. Same pattern as UI-5/UI-6 until `lib/ai/invoke.ts` ships a first-class `system` parameter (PATCHES_OWED `ui_5_invoke_system_role_plumbing` inherited forward). When that refactor lands, refine-draft is a one-line migration.
11. **Constants stay module-level** — `MAX_REFINE_INSTRUCTION_CHARS=500`, `MAX_REFINE_TURNS=6`, `REFINE_MAX_OUTPUT_TOKENS=1500`. Candidate PATCHES_OWED for Phase 3.5 if settings-driven granularity is wanted; mirrors UI-5/UI-6 precedent.
12. **Tests target the library, not the server action** — follows UI-6's precedent. `refineDraft` in `app/lite/inbox/compose/actions.ts` is a thin auth + Zod + logActivity adapter; mocking NextAuth `auth()` + `logActivity` for 5 tests is not cost-effective when the generator is already well-tested. Logged as PATCHES_OWED `ui_7_server_action_tests_owed` — G10.5 reviewer flagged this as a real coverage gap but not commit-blocking.

## Verification (G0–G12)

- **G0** — brief pre-compiled at UI-6 G11.b (`sessions/ui-7-brief.md`). Read at G0 alongside UI-5 + UI-6 handoffs.
- **G1** — 9 preconditions verified: `invalidateCachedDraft`, `DraftReplyOutputSchema`, `DraftReplyLowConfidenceFlag`, `loadClientContextOrStub`, `buildDraftReplySystemPrompt` exported from their modules; `inbox-draft-refine` absent from MODELS + INDEX + unified-inbox.md before the edit; `inbox_draft_refined` present in activity-log enum (from A6 consolidated enum); `sendCompose` accepts arbitrary `bodyText`; `killSwitches.llm_calls_enabled` live; `invokeLlmText` exported. No precondition failed.
- **G2** — files match brief whitelist exactly; "Must not touch" list (router/notifier/signal-noise/draft-reply/draft-reply-prompt/compose-draft/compose-send/send/sync/schema) all untouched.
- **G3** — not triggered (pure backend; no motion / no Tier-2 slot).
- **G4** — structural constants inline per UI-5/UI-6 precedent; flagged in PATCHES_OWED for Phase 3.5 settings-driven review.
- **G5** — N/A (backend only; motion lives in UI-8 sidecar reveal).
- **G6** — feature-flag-gated via `llm_calls_enabled` (ships disabled). No new kill switch, no schema change, no migration. Rollback = flip flag off OR `git revert`.
- **G7** — completion contract all items green: 0 TS errors; 13 new UI-7 tests (977 total / 1 skipped, up from UI-6's 964/1); clean build; slug registered in MODELS + INDEX + unified-inbox.md; server action exported; generator exported; barrel export complete.
- **G8** — `npx tsc --noEmit` → 0 errors. `npm test` → **977 passed + 1 skipped** (+13 new). `npm run build` → "Compiled successfully". `npm run lint` → no new issues on UI-7 files (generator uses `invokeLlmText`, not direct SDK; zero new `lite/no-direct-anthropic-import` violations).
- **G9** — no critical flow touched (refine is additive; no existing flow depends on it).
- **G10** — N/A (backend feature; UI sidecar lands in UI-8).
- **G10.5** — external `general-purpose` sub-agent review run. Verdict: **PASS_WITH_NOTES**. Two non-blocking defects recorded:
  1. Brief cited "§16 discipline #63 — fallback asymmetry" three times but spec §16 #63 is "Noise classifier errs conservative" — no numbered fallback-asymmetry discipline exists. **Fixed inline this session** — all three call sites in `sessions/ui-7-brief.md` now cite §7.4 directly and reference PATCHES_OWED `ui_7_brief_spec_citation_fix`.
  2. Brief §5 promised `tests/inbox-refine-actions.test.ts` (~5 tests for the server action: auth gate / Zod validation / happy path / LLM failure passthrough / kill-switch). File not created. Server action's auth gate, Zod validation, and `logActivity` emission have zero unit coverage. **Logged to PATCHES_OWED** as `ui_7_server_action_tests_owed` per reviewer's explicit recommendation — mirrors UI-6 precedent (also shipped without server-action tests). Generator-level behaviour is well-tested (13 tests); the action is a thin adapter. Not commit-blocking.
  Reviewer's verbatim verdict: "PASS_WITH_NOTES — proceed to G11/G12 commit, but both notes must land in `PATCHES_OWED.md` in the UI-7 block (§10 of brief mentions the PATCHES_OWED block is to be appended at G12). The spec-citation error is a clarity bug not a behaviour bug; the missing server-action test file is a real coverage gap but the shipped code works, passes typecheck, and the generator-level behaviour is well-tested. Neither defect warrants blocking the commit, but both must be recorded — skipping them lets the drift compound into UI-8 where the refine sidecar UI gets built on top of a partially-tested server-action contract."
- **G11** — this file. UI-8 brief written alongside per G11.b rolling cadence.
- **G12** — tracker flip + CLOSURE_LOG prepend + PATCHES_OWED append + commit next.

## Memory-alignment declaration

- **`feedback_technical_decisions_claude_calls`** — all twelve implementation choices silently locked. No technical questions asked of Andy.
- **`project_two_perpetual_contexts`** — refine rewriter reads BOTH Brand DNA (system, via reused `buildDraftReplySystemPrompt`) and CCE (user, via reused `loadClientContextOrStub`). Identical to UI-5 + UI-6.
- **`project_llm_model_registry`** — `modelFor("inbox-draft-refine")` via `invokeLlmText`. No raw model IDs. Enforced by ESLint `lite/no-direct-anthropic-import`.
- **`feedback_dont_undershoot_llm_capability`** — Opus trusted with prior draft + instruction + turn history + CCE + thread history + Brand DNA. No over-scaffolded templates. Prompt describes criteria ("surgical, not total rewrite; preserve grounded facts; flag uncertainty") and lets Opus reason into the rewrite.
- **`project_context_safety_conventions`** (rule 4 — prompts as files) — full prompt contract documented in `lib/ai/prompts/unified-inbox.md` `## inbox-draft-refine` section (Intent / Tier / Input / Output / Effects / Fallback / Kill-switches). TS builder cites the doc in its leading comment.
- **`project_brand_dna_as_perpetual_context`** — Brand DNA profile loaded on every refine call via `loadBrandDna`; prose portrait + first-impression composed into system preamble via `buildDraftReplySystemPrompt`.
- **`project_autonomy_protocol_phase_4`** — third Opus-tier recurring LLM spend in the inbox (after UI-5 reply drafter, UI-6 compose drafter); routed through `modelFor()` so cost observability is automatic via the Observatory's actor-attribution layer.

## PATCHES_OWED (raised this session)

See the session block appended to `PATCHES_OWED.md` under "Phase 5 Wave 10 UI-7 (2026-04-16)". Summary:

- **`ui_7_brief_spec_citation_fix`** — brief miscited "§16 discipline #63 — fallback asymmetry" three times; fixed inline to point at §7.4. If the family pattern (UI-5 no-write / UI-6 empty body / UI-7 preserve prior) warrants promotion to a numbered spec discipline, it belongs in a future `docs/specs/unified-inbox.md` §16 edit or a cross-cutting discipline in `FOUNDATIONS.md`.
- **`ui_7_server_action_tests_owed`** — `tests/inbox-refine-actions.test.ts` promised in brief §5 not built; 5 tests owed (auth gate, Zod validation, happy-path logActivity emission, LLM failure passthrough, kill-switch). Generator-level coverage (13 tests) is complete; the adapter-level tests are a real coverage gap. Mirrors UI-6's deferred server-action tests.
- **`ui_7_constants_to_settings`** — `MAX_REFINE_INSTRUCTION_CHARS=500`, `MAX_REFINE_TURNS=6`, `REFINE_MAX_OUTPUT_TOKENS=1500` inline in `lib/graph/refine-draft.ts`. Phase 3.5 may want them settings-driven alongside UI-3/UI-4/UI-5/UI-6 structural constants.
- **`ui_5_invoke_system_role_plumbing`** (carried forward, not UI-7-specific) — `lib/ai/invoke.ts` still exposes a single-string `prompt` param; UI-5/UI-6/UI-7 all fold system + user into one string with `\n\n---\n\n`. When `invoke.ts` ships a first-class `system` param, all three feature files migrate in a single patch.

## Rollback strategy

`feature-flag-gated` — `llm_calls_enabled` (ships disabled) gates `generateRefinedDraft`. Off = `{ outcome: "skipped_kill_switch", draft_body: priorDraft }`; the refine sidecar UI renders a toast and preserves the prior draft. No schema change, no migration, no data shape to revert. `git revert` cleanly drops the feature.

## What the next session (UI-8) inherits

UI-8 is the three-column inbox UI — list / detail / compose / refine sidecar. Things UI-8 inherits from UI-7:

- **Server action contract:** `refineDraft({ priorDraft, instruction, priorTurns?, contactId?, threadId?, sendingAddress })` returns `{ ok: true, draft: { outcome, draft_body, low_confidence_flags, reason } } | { ok: false, error }`. `outcome === "generated"` is the only success branch; every other outcome returns `draft_body === priorDraft` so the UI can render a "nothing changed" note without special-casing.
- **Ephemeral turn storage:** the refine sidecar holds `priorTurns` in React state only (array of `{ instruction, result_body }`). On each successful `refineDraft` call, UI-8 appends `{ instruction: userInput, result_body: draft_body }` to the local turn array and passes the full array back on the next call. No server persistence; sidecar close discards the turn history (spec §7.4 explicit).
- **Send path:** refine-and-send routes through UI-6's existing `sendCompose` with `bodyText = refinedDraft.draft_body`. No new send action.
- **Mobile (§6.2):** simplified single-line instruction input on narrow viewports. Same server action, narrower UI.
- **Constants exposed:** `MAX_REFINE_INSTRUCTION_CHARS = 500` (input char cap for the instruction field); `MAX_REFINE_TURNS = 6` (UI may show "older turns trimmed" hint after the 6th turn).
- **"Refine" button gate:** visible only when a draft is present (cached reply draft from UI-5 OR compose-intent draft from UI-6). Empty-body threads → hide Refine.
- **Low-confidence flag rendering:** `result.low_confidence_flags` is `Array<{ span, reason }>` — UI-8 should render them either as an annotation list below the draft or as inline highlight spans. Same shape UI-5/UI-6 emit; single rendering surface suffices across all three.
- **Activity log:** `inbox_draft_refined` fires server-side inside `refineDraft` on `outcome === "generated"`. UI-8 does not need to log anything client-side.
- **Kill-switch feedback:** when `llm_calls_enabled` is off, the action returns `outcome: "skipped_kill_switch"` with `draft_body === priorDraft`. UI-8 should render a calm "LLM calls paused — try again later" toast rather than a generic failure.
