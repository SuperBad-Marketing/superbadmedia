# Phase 3.5 Step 2 — Cross-Spec Flag Reconciliation Handoff

**Session id:** `phase-3.5-step-2-flag-reconciliation`
**Date:** 2026-04-13
**Scope:** Phase 3.5 step 2 only — verify every cross-spec flag raised in any locked spec is acknowledged in the receiving spec; patch any gaps.
**Steps 2a, 3–16 deferred** to subsequent Phase 3.5 sessions. Step 2a (spec self-containment inlining) is next and is flagged as the heaviest sub-step.

## What was done

- Read `START_HERE.md` § Phase 3.5, the step 1 handoff, current `PATCHES_OWED.md`, and the updated 🧭 Next Action.
- Delegated the full-corpus scan to an Explore sub-agent (per memory pattern + step 1 precedent) — 20 specs × every cross-spec claim, classified ACK / MISSING / PARTIAL / CONFLICT against the receiving spec, with step 1's applied-patches list excluded.
- Sub-agent returned: **95 ACK, 1 MISSING, 3 PARTIAL, 0 CONFLICT.** Corpus is ~95% reconciled — step 1 absorbed most of the work.
- Applied the one MISSING patch + one PARTIAL patch worth a touch. Deferred the other two PARTIALs as accepted forward flags (documented below).

## Patches applied

### 1. Client Context Engine — `active_strategy` artefact

Raised by `six-week-plan-generator.md` §12.4: needs Context Engine to support an `active_strategy` artefact with `origin: 'six_week_plan'` and `pending_refresh_review` flag, readable as part of the perpetual LLM context (per `project_two_perpetual_contexts.md`).

Receiving spec (`client-context-engine.md`) had no acknowledgement. Patched:

- **§11.1** — added `getActiveStrategy(clientId)`, `setActiveStrategy(clientId, payload, { origin, status })`, `markActiveStrategyReviewed(clientId)` to the exported function library.
- **§11.2** — extended consuming-specs table with rows for Six-Week Plan Generator (writer), Content Engine (reader), and added the function to Client Management + Daily Cockpit's existing rows.
- **§11.3** (new) — full prose definition of the artefact: origin, lifecycle states (`pending_refresh_review` → `live` → `archived`), read discipline ("every client-facing LLM call that already reads Brand DNA must also read `active_strategy` if present"), future-origin extensibility.
- **§12.5** (new) — `active_strategies` table schema (id, client_id unique, origin, source_id, status, payload_json, pending_refresh_review boolean for fast filter, timestamps, reviewed_at). Existing "New column on contacts" renumbered to §12.6.

### 2. Sales Pipeline — `activity_log.kind` enum

Added 4 values for the new artefact's audit trail, in the consolidated cross-spec extensions block (§4.1):
- `active_strategy_created`
- `active_strategy_reviewed`
- `active_strategy_updated`
- `active_strategy_archived`

### 3. Brand DNA — existing-profile gate skip

Self-flagged in `onboarding-and-segmentation.md` §15.4 ("Brand DNA gate must check for existing profiles — cross-spec gap"). Added a one-paragraph "Existing-profile skip" note under `brand-dna-assessment.md` §3.2 (alignment gate). Logic: if a completed `brand_dna_profiles` row already exists for the account (trial-shoot phase or invite), gate doesn't re-prompt — entry routes to the existing profile view; Retake (§3.4) is the only re-answer path.

## Deferred (acceptable forward flags)

- **Client Management §16.3 WebSocket/SSE infrastructure choice** — flagged in spec as a Phase 5 build-time decision (SSE vs WebSocket). Not a cross-spec gap; a deferred design call. Phase 5 routing/realtime session owns it.
- **Cost & Usage Observatory actor-attribution audit (§10)** — every spec calling LLMs/external APIs must declare `actor_type` + `actor_id` at the call site. Documentation hygiene, not a schema gap. Folds naturally into Phase 3.5 step 5 (Foundations patch list) or step 7 (shared-primitive registry — `external_call_log` consumer audit). Logged here so it isn't lost.

## Key decisions

- **Scoped to step 2 only.** Step 2a (inline cross-spec contract detail from handoffs into specs) is explicitly the heaviest sub-step; bundling it would have burnt context. Next session runs 2a clean.
- **Sub-agent delegation worked.** Same pattern as step 1. Primary context stayed light; gap report came back structured and accurate.
- **No mop-up brainstorm needed.** Zero conflicts; the one MISSING gap had a clear contract from Six-Week Plan to copy. No product-judgement question for Andy.
- **No new memories.** Structural in-spec work; no new Andy-voiced rules emerged.

## What the next session should know

- **Start at Phase 3.5 step 2a — spec self-containment pass.** This is the heavy one: inline cross-spec contract detail currently only in `sessions/phase-3-*-handoff.md` notes into the specs themselves, so a Phase 5 build session reading only its target spec is complete.
- **Step 2a candidates likely include:** Branded Invoicing's refinement of Quote Builder's handler integration (`manual_invoke_generate` vs `manual_invoice_send`), Six-Week Plan Generator's contract refinements with Pipeline / Daily Cockpit / Client Management, Content Engine's claimable-backlog interactions with Hiring Pipeline, Hiring Pipeline's bench primitives consumed by Task Manager, Lead Generation's reply-intelligence consumed by Unified Inbox. Use the same Explore sub-agent pattern for the discovery scan; apply patches in primary context.
- **`PATCHES_OWED.md` Pending section grew by zero new rows this session** — the 3 patches applied went straight to Applied. Pending still holds only the 4 structural rows + `docs/content/` re-homing, all of which are themselves later-Phase-3.5-step tasks (2a, 7a, voice-discipline audit completion, prompt extraction 3b, content re-homing 3a).
- **New settings keys introduced this session:** none.
- **`activity_log.kind` enum** in `sales-pipeline.md` is now 38 cross-spec values (was 34). Step 6 (data-model sanity) should re-confirm no stray drift in other specs after this addition.

## Files touched

- `docs/specs/client-context-engine.md` — §11.1, §11.2, §11.3 (new), §12.5 (new), §12.6 (renumbered from §12.5)
- `docs/specs/sales-pipeline.md` — §4.1 enum (4 new values)
- `docs/specs/brand-dna-assessment.md` — §3.2 existing-profile skip note
- `PATCHES_OWED.md` — Applied section gained "Phase 3.5 step 2" subsection (3 rows)
- `SESSION_TRACKER.md` — Next Action block (next message)
- `sessions/phase-3.5-step-2-flag-reconciliation-handoff.md` (this file)
