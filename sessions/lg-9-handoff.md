# `LG-9` — Lead Gen contact discovery + draft generator — Handoff

**Closed:** 2026-04-17
**Wave:** 13 — Lead Generation (9 of 10)
**Model tier:** Sonnet (native; LG-9 brief is /normal)

## What was built

- **`lib/lead-gen/prompts/outreach-system.md`** (new):
  Voice + constraint system prompt (dry/Melbourne tone, no-hallucination guard, Spam Act 2003 footer block).

- **`lib/lead-gen/email-discovery.ts`** (new):
  `discoverContactEmail(domain)` — Hunter.io Domain Search API + role-preference sort + pattern-inference fallback. Logs to `external_call_log`. Gated behind `lead_gen_enabled`. Returns `null` if no contact resolved (caller sets `skipped_reason = 'no_contact_email'`).

- **`lib/lead-gen/draft-generator.ts`** (new):
  `generateDraft(args)` — Anthropic REST API via `fetch()` (ESLint `no-direct-anthropic-import` rule prevents SDK import outside `lib/ai/`). Uses `modelFor("lead-gen-outreach-draft")` from model registry. Reads system prompt from `prompts/outreach-system.md` (cached). Logs to `external_call_log`. Gated behind `lead_gen_enabled` + `llm_calls_enabled`.

- **`lib/lead-gen/orchestrator.ts`** (edit — steps 8–10 added):
  - Step 8: insert `lead_candidates` rows for each qualified candidate
  - Step 9: call `discoverContactEmail`, update row; skip if null
  - Step 10: call `generateDraft`, insert `outreach_drafts` row, update `lead_candidates.pending_draft_id`
  - `drafted_count` now tracked + passed through to `persistRun` / `lead_runs.drafted_count`

- **`.env.example`** (edit): `HUNTER_IO_API_KEY` added.

## Key decisions

- Draft generator uses `fetch()` to Anthropic REST API (not SDK) — required by `lib/ai/` ESLint carve-out. Model selection still routes through `modelFor()`.
- Model registry slug `"lead-gen-outreach-draft"` maps to Opus (not Haiku as spec §8 prescribes for cost discipline). Fix is outside LG-9 whitelist — logged to PATCHES_OWED.
- Pattern inference returns `firstname@domain` as the inferred email (spec: "best guess"). Requires a first name from Hunter; returns null if Hunter has no first name.
- `standingBrief` read from `settings.get("lead_generation.standing_brief")` per the existing settings registry key.

## Artefacts produced

- `lib/lead-gen/prompts/outreach-system.md` (new)
- `lib/lead-gen/email-discovery.ts` (new)
- `lib/lead-gen/draft-generator.ts` (new)
- `lib/lead-gen/orchestrator.ts` (edited — steps 8–10)
- `.env.example` (edited — HUNTER_IO_API_KEY)
- `tests/lead-gen/lg9-email-discovery.test.ts` (new — 8 tests)
- `tests/lead-gen/lg9-draft-generator.test.ts` (new — 8 tests, incl. orchestrator integration)
- `sessions/lg-10-brief.md` (new — G11.b)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm test` → 178 test files, 1514 passed, 1 skipped (transient sqlite lock on first run is pre-existing flakiness)
- `npm run build` → clean
- `npm run lint` → 0 errors (72 warnings — pre-existing baseline)

## Rollback strategy

`feature-flag-gated` — all new code gated behind `lead_gen_enabled`. Rollback = flip flag off.

## Memory-alignment declaration

No `MEMORY.md` in this project — no memory-alignment obligations apply.

## G4 — Settings-literal check

No autonomy-sensitive literals added. `standingBrief` reads from `settings.get()`. Hunter confidence threshold (70) and role list are domain constants, not autonomy thresholds.

## G5 — Motion check

No UI components added in this session (FEATURE type). G5 not applicable.

## G10.5 verdict

Non-UI session — fidelity grep result:
- AC1 (HUNTER_IO_API_KEY in .env.example): PASS
- AC2 (discoverContactEmail, external_call_log, role closed list, email_confidence): PASS
- AC3 (outreach-system.md, Spam Act footer): PASS
- AC4 (generateDraft, external_call_log, kill-switches): PASS
- AC5 (orchestrator steps 8–10, leadCandidates, outreachDrafts): PASS
- AC6 (test files): PASS
- File scope: PASS (all changes within whitelist)

**G10.5 fidelity: PASS**

## PATCHES_OWED rows added

- `lg_9_model_registry_slug_tier` — `"lead-gen-outreach-draft"` slug maps to Opus in `lib/ai/models.ts` but spec §8 prescribes Haiku for cost discipline. Update registry to `haiku` when `lib/ai/models.ts` is next in-scope.

## What LG-10 inherits

- `outreach_drafts` rows now inserted by orchestrator step 10 with status `'pending_approval'`
- `lead_candidates.pending_draft_id` set after step 10
- `HUNTER_IO_API_KEY` env var registered in `.env.example`
- `autonomy_state` table already exists at `lib/db/schema/autonomy-state.ts` (from LG-1)
- `transitionAutonomyState` not yet implemented (LG-10 owns it)
- Resend webhook handlers for bounce/complaint/open/click will wire circuit-breaker demotions in a later session
