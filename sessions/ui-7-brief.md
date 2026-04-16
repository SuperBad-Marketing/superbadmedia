# `ui-7` — Refine-chat sidecar (Opus instruction-based draft rewrite) — Brief

> **Pre-compiled at UI-7 G0 kickoff per AUTONOMY_PROTOCOL.md §G0.**
> Read this brief. Do **not** read all 21 specs. If any precondition in §7 is missing, stop (G1).

**Wave:** 10 (Unified Inbox 7 of 13 — refine sidecar backend)
**Type:** FEATURE
**Size:** small
**Model tier:** `/deep` (Opus) — the rewriter is Opus (customer-facing text, voice-critical); session is pure backend, no UI.
**Spec:** `docs/specs/unified-inbox.md` §§7.4 (refine-chat paragraph), 4.4 (Compose action row mentions refine), 6.2 (mobile behaviour), 11.3 (activity kinds). Fallback posture is a builder-level discipline derived from §7.4, not a numbered spec rule — see PATCHES_OWED `ui_7_brief_spec_citation_fix`.
**Precedent:**
- `sessions/ui-5-handoff.md` — UI-5 shipped the reply drafter + `invalidateCachedDraft` export + `DraftReplyOutputSchema` + `buildDraftReplySystemPrompt` + `loadClientContextOrStub`. UI-7 **reuses these primitives verbatim** for voice consistency.
- `sessions/ui-6-handoff.md` — UI-6 shipped `sendCompose` server action + `sendComposeMessage` wrapper + `compose_drafts` table. UI-7 does **not** introduce a new send path; refine-and-send routes through UI-6's `sendCompose`.

UI-7 is the third call in the Opus draft family (UI-5 reply, UI-6 compose-from-intent, UI-7 instruction-based rewrite). Same system prompt, same context hydration, different user turn: the current draft + Andy's instruction + prior refine turns.

---

## 1. Identity

- **Session id:** `ui-7`
- **Wave:** 10 — Unified Inbox (7 of 13)
- **Type:** FEATURE
- **Model tier:** `/deep` (Opus)
- **Sonnet-safe:** no — voice calibration on customer-facing text.
- **Estimated context:** small — pure backend, reuses UI-5/UI-6 primitives, no migration, no UI.

## 2. Spec references

- `docs/specs/unified-inbox.md` §7.4 — "Refine-chat: when Andy opens the refine sidecar, conversation is: his instructions in, new draft out, iterate. Stores as an ephemeral in-memory session, no persistence unless useful for future learning."
- `docs/specs/unified-inbox.md` §4.4 — compose action row lists "Refine-chat (if draft present)" as a valid state transition.
- `docs/specs/unified-inbox.md` §6.2 — mobile refine is a single-line instruction input + re-draft (no sidecar panel). Backend shape unchanged; UI-8 handles the responsive split.
- `docs/specs/unified-inbox.md` §11.3 — `inbox_draft_refined` activity kind (already seeded in `lib/db/schema/activity-log.ts:236` from A6 consolidated enum; no schema work).
- UI-7 fallback discipline — **preserve the prior draft**; never overwrite with garbage on parse failure. Builder-level discipline derived from §7.4's "ephemeral in-memory session" intent, not a numbered spec rule. The family pattern (UI-5 no-write, UI-6 empty body, UI-7 preserve prior) is a SuperBad-internal convention tracked in PATCHES_OWED `ui_7_brief_spec_citation_fix` for possible future codification.

## 3. Acceptance criteria (verbatim from §7.4)

```
Refine-chat: when Andy opens the refine sidecar, conversation is:
his instructions in, new draft out, iterate. Stores as an ephemeral
in-memory session, no persistence unless useful for future learning.
```

Plus §4.4 implication: refine is only available when a draft is present (cached reply draft from UI-5, or compose-intent draft from UI-6). Sending a refined draft routes through UI-6's `sendCompose` unchanged.

## 4. Skill whitelist

- `typescript-validation` — Zod schemas for action inputs + LLM output reuse.
- `spec-driven-development` — resisting scope creep into UI-8 territory.
- `systematic-debugging` — prompt calibration on the rewrite turn.

## 5. File whitelist (G2 scope discipline)

**Create:**
- `lib/graph/refine-draft.ts` — `generateRefinedDraft({ priorDraft, instruction, priorTurns, contactId?, threadId?, sendingAddress })` Opus rewriter.
- `tests/graph-refine-draft.test.ts` — ~8 tests covering Zod parse, prompt assembly, kill-switch skip, preserve-on-fallback, prior-turns inclusion.
- `tests/inbox-refine-actions.test.ts` — ~5 tests covering server action auth, Zod validation, happy path, LLM failure passthrough, kill-switch.

**Edit:**
- `lib/ai/models.ts` — register `inbox-draft-refine` → Opus (new slug, new registry row).
- `lib/ai/prompts/INDEX.md` — add row 62; bump header count to 57 / 14 specs + email adapter.
- `lib/ai/prompts/unified-inbox.md` — append `## inbox-draft-refine` section; append `, UI-7 (draft-refine — DONE)` to populated-by.
- `app/lite/inbox/compose/actions.ts` — add `refineDraft` server action (Zod input, `requireAdminActor()`, delegates to `generateRefinedDraft`, returns `{ok, draft, turns}` shape).
- `lib/graph/index.ts` — barrel export `generateRefinedDraft` + types.
- `SESSION_TRACKER.md` — G12 flip Next Action → ui-8.
- `sessions/CLOSURE_LOG.md` — prepend UI-7 summary.
- `PATCHES_OWED.md` — append UI-7 block (see §10).

**Must not touch:**
- `lib/graph/router.ts`, `notifier.ts`, `signal-noise.ts`, `draft-reply.ts`, `draft-reply-prompt.ts`, `compose-draft.ts`, `compose-send.ts`, `send.ts`, `sync.ts` — all prior-wave stable.
- `lib/db/schema/*` — no migration.
- `lib/kill-switches.ts` — no new flag (reuses `llm_calls_enabled`).
- `app/lite/inbox/` list/detail/compose UI — UI-8 territory.

## 6. Settings keys touched

- **Reads:** none (feature-flag via kill switches only).
- **Seeds (new keys):** none — UI-7 adds zero settings keys. Constants (`MAX_REFINE_INSTRUCTION_CHARS`, `MAX_REFINE_TURNS`, `REFINE_MAX_OUTPUT_TOKENS`) live as module constants; PATCHES_OWED candidates if Phase 3.5 wants them settings-driven.

## 7. Preconditions (G1 — grep-verifiable)

- [ ] `lib/graph/draft-reply.ts` exports `invalidateCachedDraft` — verify: `grep "export async function invalidateCachedDraft" lib/graph/draft-reply.ts` (confirmed at line 209).
- [ ] `lib/graph/draft-reply.ts` exports `DraftReplyOutputSchema` + `DraftReplyLowConfidenceFlag` — verify: `grep "export const DraftReplyOutputSchema\|export type DraftReplyLowConfidenceFlag" lib/graph/draft-reply.ts` (confirmed lines 42, 47).
- [ ] `lib/graph/draft-reply-prompt.ts` exports `loadClientContextOrStub` + `buildDraftReplySystemPrompt` — verify: `grep "export .* loadClientContextOrStub\|export function buildDraftReplySystemPrompt" lib/graph/draft-reply-prompt.ts` (confirmed lines 170, 269).
- [ ] `lib/ai/models.ts` does NOT include `inbox-draft-refine` — verify: `grep "inbox-draft-refine" lib/ai/models.ts` (empty).
- [ ] `lib/ai/prompts/INDEX.md` does NOT list `inbox-draft-refine`.
- [ ] `lib/ai/prompts/unified-inbox.md` has UI-5/UI-6 sections but no `## inbox-draft-refine`.
- [ ] `inbox_draft_refined` present in activity-log kind enum — confirmed at `lib/db/schema/activity-log.ts:236`.
- [ ] `sendCompose` server action exists and accepts arbitrary `bodyText` — confirmed in `app/lite/inbox/compose/actions.ts:120`. UI-7 does **not** modify this action; client-side refine flow calls `sendCompose` with the refined body text.
- [ ] `killSwitches.llm_calls_enabled` exists — UI-5/UI-6 both gate on this.
- [ ] `invokeLlmText({ job, prompt, maxTokens })` exists in `lib/ai/invoke.ts` — reused verbatim.

## 8. Rollback strategy (G6 — exactly one)

- [x] `feature-flag-gated` — `llm_calls_enabled` (shipped disabled) gates `generateRefinedDraft`. No new kill switch. Rollback = flip `llm_calls_enabled` off OR `git revert` the commit (no schema change, no data migration).

Additive surface: new file `lib/graph/refine-draft.ts`, new server action in an existing file, three docs edits, two test files. Zero schema risk.

## 9. Definition of done

- [ ] `lib/graph/refine-draft.ts` exists — verify: `ls lib/graph/refine-draft.ts`.
- [ ] `generateRefinedDraft` exported — verify: `grep "export async function generateRefinedDraft" lib/graph/refine-draft.ts`.
- [ ] `inbox-draft-refine` → opus in registry — verify: `grep "inbox-draft-refine" lib/ai/models.ts`.
- [ ] Prompts-as-files: `## inbox-draft-refine` section present — verify: `grep "## inbox-draft-refine" lib/ai/prompts/unified-inbox.md`.
- [ ] INDEX.md header bumped to 57.
- [ ] `refineDraft` server action exported — verify: `grep "export async function refineDraft" app/lite/inbox/compose/actions.ts`.
- [ ] `npx tsc --noEmit` → zero errors.
- [ ] `npm test` → green (~13 new tests; total ≥ 971 based on UI-6's 958 baseline).
- [ ] `npm run build` → clean.
- [ ] `npm run lint` → UI-7 adds one new expected `lite/no-direct-anthropic-import` line on `refine-draft.ts` (same as UI-5/UI-6 — escape hatch is `invokeLlmText`, but ESLint counts each file). Confirm at G8.
- [ ] **G10.5 external-reviewer gate** — `general-purpose` sub-agent verdict `PASS` or `PASS_WITH_NOTES`; verdict attached verbatim to handoff; any notes → `PATCHES_OWED.md`.
- [ ] Kill-switches off → no LLM call, no exceptions, returns `{ outcome: "skipped_kill_switch", draft_body: priorDraft }`.
- [ ] **Preserve-prior-draft fallback** covered by test: on LLM parse failure, outcome is `"fallback_error"` and `draft_body` equals `priorDraft` (NOT empty, NOT garbage).
- [ ] **Memory-alignment declaration** — handoff lists every applied memory with one-line "how applied".
- [ ] G-gates end-to-end (G0 → G12) with a clean handoff written.

## 10. Notes for the next-session brief writer (UI-8)

UI-8 is the three-column inbox UI + compose UI + refine sidecar UI. Things UI-8 will need from UI-7:

- **Server action contract:** `refineDraft({ priorDraft: string, instruction: string, priorTurns: Array<{instruction, resultBody}>, contactId?, threadId?, sendingAddress })` returns `{ ok: true, draft: { outcome, draft_body, low_confidence_flags } } | { ok: false, error }`.
- **Ephemeral turn storage:** UI-8's refine sidecar holds `priorTurns` in React state only. No server persistence — spec §7.4 "no persistence unless useful for future learning" is explicit. Each refine call replays the full turn history as context (capped at `MAX_REFINE_TURNS = 6` — older turns truncate head-first).
- **Send path:** refine-and-send calls UI-6's `sendCompose` with `bodyText = refinedDraft.draft_body` (+ existing `threadId` / `contactId`). No new send action.
- **Mobile (§6.2):** UI-8 needs to render a simplified single-line instruction input on narrow viewports. Same server action, narrower UI. Brief should cite §6.2 verbatim.
- **Constants exposed:** `MAX_REFINE_INSTRUCTION_CHARS = 500`, `MAX_REFINE_TURNS = 6`. UI-8 may reference for input caps / history truncation UX.
- **"Refine" button gate:** UI-8 shows Refine only when a draft is present (cached reply draft OR compose-intent draft). Empty-body threads → Refine hidden.
- **Activity log:** `inbox_draft_refined` fires inside `refineDraft` server action (meta: `{ contact_id, thread_id, turn_count, instruction_length, flag_count }`). UI-8 doesn't need to log anything client-side.
- **Low-confidence flags:** UI-8 should render them in the sidecar (reuse UI-5's flag rendering if it exists; otherwise spec §7.4 says flags surface as highlight-spans in the draft).

## 11. PATCHES_OWED additions (provisional — append at G12)

1. `MAX_REFINE_INSTRUCTION_CHARS` (500) → settings key candidate.
2. `MAX_REFINE_TURNS` (6) → settings key candidate.
3. `ui_5_invoke_system_role_plumbing` still owed — UI-7 also folds system + user into a single `invokeLlmText` prompt via `${systemPrompt}\n\n---\n\n${userPrompt}`. When the `invoke.ts` refactor lands, refine-draft is a one-line migration.
4. Refine turn persistence (if future learning use case emerges, spec §7.4 leaves the door open). Not in v1.

## 12. Silent locks (per `feedback_technical_decisions_claude_calls` — NOT asked to Andy)

Locked without confirmation because these are implementation decisions, not product decisions:

1. **Ephemeral turns (Option A)** — turns live in client React state, passed back on each request. No `refine_turns` table. Matches spec §7.4 verbatim.
2. **Slug `inbox-draft-refine` → Opus** — third distinct prompt in the draft family, deserves its own registry row for cost attribution.
3. **No new kill switch** — `llm_calls_enabled` suffices. Granularity beyond that is a PATCHES_OWED candidate if the need emerges.
4. **No new send path** — refine-and-send is the client calling `sendCompose` with the refined body. Zero duplication.
5. **Preserve-prior-draft fallback** — on parse/LLM failure, return `{ outcome: "fallback_error", draft_body: priorDraft, ... }`. The refine turn is a no-op from the user's perspective; the prior draft survives. This is UI-7's conservative side in the draft-family fallback convention (UI-5 no-write, UI-6 empty body, UI-7 preserve prior) — SuperBad-internal convention, not a numbered spec discipline.
6. **Reuse `buildDraftReplySystemPrompt` verbatim** — voice consistency. Any divergence would create three slightly-different voices across the three Opus calls.
7. **Reuse `DraftReplyOutputSchema` verbatim** — `{ draft_body, low_confidence_flags }`. No new output shape.
8. **Combined prompt (system + user folded into single string)** — same pattern as UI-5/UI-6. When `invoke.ts` ships the `system` parameter, all three feature files migrate in one patch.
9. **Turn-history cap = 6** — enough to show iteration, bounded enough to keep prompts small. PATCHES_OWED if Phase 3.5 wants it settings-driven.

## 13. Memory alignment gates (G10.5 reviewer will check)

- **`feedback_technical_decisions_claude_calls`** — §12 locks all silently. No technical questions to Andy.
- **`project_two_perpetual_contexts`** — refine rewriter reads **both** Brand DNA (system) and CCE (user context). Reuse UI-5's prompt primitives.
- **`project_llm_model_registry`** — `modelFor("inbox-draft-refine")`. No raw model IDs in feature code.
- **`feedback_dont_undershoot_llm_capability`** — trust Opus to reason from prior draft + instruction + turn history. No over-scaffolded templates.
- **`project_context_safety_conventions`** — prompts-as-files: new slug gets full section in `unified-inbox.md` with Intent/Tier/Input/Output/Effects/Fallback/Kill-switches.
- **Voice profile** — refine rewriter teaches identical voice rules as UI-5/UI-6 via `buildDraftReplySystemPrompt`.

---

## G0 kickoff ritual

1. Read this brief.
2. Read `sessions/ui-6-handoff.md` + `sessions/ui-5-handoff.md`.
3. Read spec §§7.4, 4.4, 6.2, 11.3 (already summarised above — reread only if ambiguity arises).
4. Read `lib/graph/draft-reply.ts`, `draft-reply-prompt.ts`, `compose-draft.ts`, `compose-send.ts`, `app/lite/inbox/compose/actions.ts`.
5. Verify all preconditions in §7.
6. Lock silent decisions per §12.
7. Build order:
   1. `lib/graph/refine-draft.ts` (generator + types).
   2. Register slug in MODELS + INDEX + `unified-inbox.md`.
   3. `refineDraft` server action in `app/lite/inbox/compose/actions.ts`.
   4. Barrel export in `lib/graph/index.ts`.
   5. Tests (`tests/graph-refine-draft.test.ts` + `tests/inbox-refine-actions.test.ts`).
   6. Typecheck + test + build + lint (G8).
   7. G10.5 external reviewer.
   8. Handoff + tracker flip + closure-log prepend + PATCHES_OWED block + commit.
