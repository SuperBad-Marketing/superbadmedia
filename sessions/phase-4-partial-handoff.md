# Phase 4 — Partial Handoff (BUILD_PLAN.md landed)

**Date:** 2026-04-13
**Status:** Phase 4 in progress — 1 of 3 artefacts complete.

## What landed this session

- **`BUILD_PLAN.md`** — dependency-ordered plan, 23 waves, ~150 atomic build sessions.
  - Wave 0: Pixieset spike (P0).
  - Wave 1: Foundation A (A1–A8) — project init, design tokens, primitives, motion+sound, settings+permissions+kill-switches+ESLint, activity_log + scheduled_tasks + formatTimestamp + LLM registry + external_call_log + messages/threads schema, email adapter + canSendTo + quiet window + drift check + ensureStripeCustomer + renderToPdf stub + internal-only marker, portal-guard + Brand DNA Gate middleware.
  - Wave 2: Foundation B — Sentry + reportIssue + cost alerts (B1), backups + DR + credential vault (B2), legal pages + cookie consent (B3).
  - Waves 3–22: features in dependency-strict order, aggregators (COB, DC) last.
  - Wave 23: Settings Audit Pass + synthetic-client dry-run.
  - §C consolidated cron table (60+ jobs).
  - §R shared-primitive registry.
  - §E critical-flow E2E assignments.
  - Rollback strategy declared per session.

## Key decisions locked

- **Build ordering:** option A — dependency-strict, aggregators last. (Andy chose this on build-quality grounds, not operational.)
- **Legal-pages spec:** folded into Phase 4 docs pass (not a back-written Phase 3 mini-session).
- **Foundation split:** Foundation A (auth/DB/design/settings/permissions/env/kill-switches/core primitives) → Foundation B (observability/backups/vault/cookie consent/legal pages).
- **Unified Inbox schema pulled up:** `messages` + `threads` tables land in A6 so CCE/CM can read them; full UI stack still in Wave 9.
- **renderToPdf:** stub in A7, real impl at QB-3.
- **Brand DNA Gate:** middleware in A8; BDA-4 flips it from redirect to clear.

## What remains in Phase 4

1. **`AUTONOMY_PROTOCOL.md`** — per-session non-skippable gates for Phase 5 autonomous execution.
   - Required gates: motion review, rollback declaration, settings-literal sweep, preflight precondition verification, mid-session context budget checkpoint (70%), minimum-necessary skill loading, end-of-session artefact verification, typecheck + test gates always, E2E on 5 critical flows.
   - Autonomy inputs (from `PATCHES_OWED.md` lines 309–323): model tiering (Haiku/Sonnet/Opus + /quick /normal /deep), plan-level Opus→Sonnet fallback = pause not degrade, cache-aware session batching (5-min TTL), pre-compiled `sessions/<id>-brief.md`, per-session skill whitelist, sub-agent offload for discovery, verification-gate discipline.
2. **`LAUNCH_READY.md`** — Phase 6 pre-launch checklist (from START_HERE.md § Phase 4 step 12):
   - DNS configured, email warmup + SPF/DKIM/DMARC, Resend reputation, Stripe live keys rotated, first restorable automated backup, kill switches wired + tested, cost alerts firing, critical-flow E2E green against production, privacy + terms live, synthetic-client dry-run complete.
3. **Tracker + commit:** update `SESSION_TRACKER.md` 🧭 Next Action to point at Wave 0 (P0 Pixieset spike) as first Phase 5 session; write `sessions/phase-4-handoff.md` (final); commit all 3 Phase 4 artefacts in one commit ("one concern" = Phase 4).

## Why split

Per the mid-session context-budget discipline we're explicitly codifying into AUTONOMY_PROTOCOL: BUILD_PLAN.md was the densest synthesis in Phase 4. Doing AUTONOMY_PROTOCOL.md and LAUNCH_READY.md in a fresh session preserves headroom for correctness on those artefacts too. The working tree is intentionally uncommitted — Phase 4 is one concern and will commit as a single unit when all three artefacts land.

## Resumption — first Claude moves

1. Read `BUILD_PLAN.md` § Wave 1 (A5/A6 settings + kill-switch context).
2. Read `PATCHES_OWED.md` Pending section — specifically the autonomy-inputs rows.
3. Read `START_HERE.md` § Phase 4 step 11 (autonomy-gate list).
4. Draft `AUTONOMY_PROTOCOL.md`.
5. Draft `LAUNCH_READY.md`.
6. Update tracker + write final phase-4-handoff + commit all 3 artefacts.
