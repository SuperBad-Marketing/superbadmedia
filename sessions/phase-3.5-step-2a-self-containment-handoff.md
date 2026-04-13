# Phase 3.5 Step 2a — Spec Self-Containment Pass Handoff

**Session id:** `phase-3.5-step-2a-self-containment`
**Date:** 2026-04-13
**Scope:** Phase 3.5 step 2a only — inline cross-spec contract detail currently only in `sessions/phase-3-*-handoff.md` notes into the specs that own the contracts, so a Phase 5 build session reading only its target spec is complete.
**Steps 3, 3a, 3b, 4–16 deferred** to subsequent Phase 3.5 sessions.

## What was done

- Read `START_HERE.md` § Phase 3.5, step 1 + step 2 handoffs, `PATCHES_OWED.md`, updated 🧭 Next Action block.
- Ran an initial Explore sub-agent scan. It returned a suspiciously clean "zero gaps, all applied" result. Spot-checked one seed candidate (Branded Invoicing ↔ Quote Builder handler refinement) by literal grep — the sub-agent was wrong; Quote Builder's spec still had only the single-handler shape. The sub-agent had trusted prior-step handoff summaries rather than verifying actual spec content.
- Re-ran the scan with a tighter prompt that mandated literal-grep verification against spec content and explicitly called out the first sub-agent's failure mode. Second scan surfaced the real shape of the gap: enum consolidation never happened.
- Ran a third focused audit on `activity_log.kind` declarations across all 17 downstream specs. Confirmed 166 values declared locally in each spec but absent from `sales-pipeline.md` §4.1 — the authoritative receiver.
- Applied three consolidated patches: `sales-pipeline.md` activity_log enum, `quote-builder.md` task_type enum + handler map, `quote-builder.md` Branded Invoicing handler-split refinement (§3.2 / §3.3 / §8.3).

## Patches applied

### 1. `sales-pipeline.md` §4.1 — `activity_log.kind` enum consolidation

Added a "Consolidated" authoritative-receiver note above the `activity_log` table definition (directive: every spec declaring `activity_log.kind` additions in its own prose patches this single enum in the same session).

Added 166 values in labelled blocks inside the `kind` enum array:
- Quote Builder (17 — `quote_sent` kept in original block, not duplicated)
- Branded Invoicing (8)
- Brand DNA Assessment (8)
- Intro Funnel (21 — `shoot_*` naming family preserved distinct from original `trial_shoot_*` values; semantic-duplicate reconciliation deferred to step 6)
- Lead Generation (10)
- Content Engine (15)
- Client Context Engine non-active_strategy (11)
- Client Management (8)
- Daily Cockpit (8)
- Onboarding + Segmentation (8)
- SaaS Subscription Billing (11)
- Setup Wizards (6)
- Unified Inbox (18)
- Six-Week Plan Generator (17)

Enum now totals ~215 values across 15 labelled blocks. Phase 5 foundation migration seeds the full union.

### 2. `quote-builder.md` §5.4 — `scheduled_tasks.task_type` enum consolidation

Added an authoritative-union note and rewrote the enum from 5 values + "extensible by future specs" comment to a consolidated 31-value union in labelled blocks by owner spec:
- Quote Builder owner block (6 — now includes `manual_invoice_generate` per Branded Invoicing refinement)
- Branded Invoicing (`invoice_overdue_reminder`)
- Client Context Engine (2), Content Engine (6), Client Management (2), Daily Cockpit (1), Unified Inbox (5), SaaS Subscription Billing (3), Cost & Usage Observatory (5), Finance Dashboard (6)

### 3. `quote-builder.md` §8.2 — handler map dispatch table

Expanded the `handlers` map from 5 entries to 32. Each entry points at a handler whose implementation is owned by the block's source spec. Added comment block headers naming the owner spec for each section. Explanatory lead-in clarifies: Quote Builder §8.3 only defines its own handlers; the other owner specs define theirs in their own spec files but must register in this single dispatch map so the worker compiles.

### 4. `quote-builder.md` §3.2 step 7 — first-cycle enqueue

Changed `manual_invoice_send` → `manual_invoice_generate`, `run_at = first_invoice_date` → `run_at = first_invoice_date - 3 days`, with a short inline note explaining the refinement references §3.3 and §8.3.

### 5. `quote-builder.md` §3.3 — monthly invoicing long-tail

Rewrote the single-sentence description of the handler chain to describe the full two-task per-cycle shape: `manual_invoice_generate` → draft + cockpit review → `manual_invoice_send` → status branch (draft→send, sent→skip-but-continue, void→skip-and-stop) → enqueue next cycle's generate at `next_cycle_send_date - 3 days`.

### 6. `quote-builder.md` §8.3 — handler definitions

- Added full `handleManualInvoiceGenerate` definition: calls `generateInvoice()` on Branded Invoicing, fires cockpit notification, enqueues matching send task with deterministic idempotency key.
- Narrowed existing `handleManualInvoiceSend` from "call generation + on-success enqueue next send" to "re-read draft, branch on status, dispatch or skip, enqueue next cycle's generate (not send), enqueue overdue reminder".

## Key decisions

- **Literal-grep verification is non-negotiable for step 2a-shaped scans.** The first sub-agent pass was credulous toward prior-step summaries and returned a false "clean" result. Spot-checking one seed candidate surfaced the error inside 30 seconds. Future structural audits (steps 6, 7, 8) should require grep-by-value verification, not "check handoff summary X for claim Y."
- **Treat each spec's locally-declared enum as a declaration and the owner spec's enum as the single receiver.** The pattern already existed for Observatory/Finance/Hiring/active_strategy blocks — extended to all remaining specs. No new architectural decision; just completing the existing pattern.
- **`shoot_*` vs `trial_shoot_*` preserved as distinct name families.** Original Sales Pipeline block has `trial_shoot_booked` + `trial_shoot_completed`. Intro Funnel added `shoot_booked` + `shoot_rescheduled` + 5 others. Semantic duplication likely — but name-level reconciliation is step 6's job (data-model sanity: conflicts / gaps / bloat), not step 2a's. Flagged in-line for step 6.
- **Handler map is deliberately authoritative in Quote Builder even though other specs own their handlers.** Alternative would have been one handler map per owner spec — but `dispatch(row)` needs a single map, so Quote Builder's §8.2 is the only coherent home. Comment block structure makes ownership obvious.
- **No mop-up brainstorm needed.** Mechanical work; no product-judgement questions surfaced.
- **No new memories.** Everything was structural in-spec work.

## What the next session should know

- **Start at Phase 3.5 step 3 — deferred task inventory** (with follow-on 3a content re-homing and 3b prompt-file extraction). Read the updated Next Action block.
- **Semantic enum duplicates flagged for step 6.** `trial_shoot_booked` (Sales Pipeline original) vs `shoot_booked` (Intro Funnel); `trial_shoot_completed` vs no direct Intro Funnel equivalent but `deliverables_ready` + `reflection_complete` carry related signals. Step 6 must reconcile whether to collapse or keep separate — name-level preserve decision was purely a step 2a de-scope to avoid product judgement mid-mechanical-pass.
- **Handler-name consistency is not verified.** Handler map in quote-builder.md §8.2 names 27 handlers (`handleContentKeywordResearch`, etc.) that don't yet appear in their owner specs. Owner specs describe the behaviour in prose but may not pin the exact function name. This is a real risk for Phase 5 — if the owner spec names `handleContentKeywordResearchJob` (with `Job` suffix) while the map says `handleContentKeywordResearch`, the build fails to compile. Step 7 (shared-primitive registry) should verify every handler-name consumer ↔ owner pairing during the registry pass.
- **Enum now reaches ~215 values in `activity_log.kind`.** Before Phase 5 foundation migration, verify SQLite can tolerate the string enum at this size (it can — it's TS-level constraint, not DB-level), and verify Drizzle infers the type cleanly.
- **`PATCHES_OWED.md` Pending reduced by one row.** The "inline cross-spec contract detail" row is now APPLIED. Remaining Pending rows: settings-key literal conversion (step 7a's work), Voice & Delight treatment audit (step 4 or named mop-up), prompt-file extraction (step 3b), `docs/content/` re-homing (step 3a).
- **Settings keys introduced this session:** none.
- **Files edited (5):** `docs/specs/sales-pipeline.md` (§4.1 enum + header note), `docs/specs/quote-builder.md` (§3.2 step 7, §3.3 long-tail, §5.4 enum + header note, §8.2 handler map, §8.3 handler definitions), `PATCHES_OWED.md` (one row struck, six rows Applied), `SESSION_TRACKER.md` (Next Action block), `sessions/phase-3.5-step-2a-self-containment-handoff.md` (this file).

## Files touched

- `docs/specs/sales-pipeline.md`
- `docs/specs/quote-builder.md`
- `PATCHES_OWED.md`
- `SESSION_TRACKER.md`
- `sessions/phase-3.5-step-2a-self-containment-handoff.md` (this file)
