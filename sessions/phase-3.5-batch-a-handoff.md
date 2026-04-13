# Phase 3.5 Batch A — handoff (2026-04-13)

Steps 3 + 3a + 3b + 4 + 5 of the Phase 3.5 exit-gate checklist, run autonomously in one session after Andy approved "yes".

## What was done

### Step 3 — deferred task inventory
Audited every spec for deferred / parked items. **No items quietly dropped.** Every deferral has a home:
- Phase 5 content mini-sessions (§"Content mini-session scope" sections across 8 specs)
- v1.1 roadmap in SCOPE.md
- Open-questions lists in each spec's §"Open questions" or §"Open items" section
- Phase 4 Build Plan scope (e.g., `settings` editor UI)

No new PATCHES_OWED.md rows needed.

### Step 3a — content-authoring output home
Created `docs/content/README.md` establishing the convention: every content mini-session's output lands at `docs/content/<spec-slug>.md`. Consuming specs reference it by path.

**No pre-existing content to re-home** — every prior content mini-session produced spec-inline lock tables, not separate content artefacts.

### Step 3b — prompt-file extraction
Created the `lib/ai/prompts/` structure:
- `lib/ai/prompts/README.md` — convention: one `.md` file per spec with prompts; Phase 4 foundation splits into per-prompt `.ts` files.
- `lib/ai/prompts/INDEX.md` — table of **47 prompts across 14 specs** with slug + owner spec + model tier + intent.
- **14 per-spec stub files** at `lib/ai/prompts/<spec>.md`, each with YAML frontmatter (`spec`, `status: stub`, `populated-by`) and H2 sections per prompt (tier, intent, input/output, current inline location).

Per-spec stub breakdown:
- `quote-builder.md` (7 prompts), `branded-invoicing.md` (3), `intro-funnel.md` (5), `client-context-engine.md` (5), `brand-dna-assessment.md` (5), `content-engine.md` (10), `six-week-plan-generator.md` (4), `cost-usage-observatory.md` (3), `finance-dashboard.md` (1), `daily-cockpit.md` (1), `lead-generation.md` (1 composed system), `client-management.md` (3), `task-manager.md` (1), `unified-inbox.md` (3).

**Every prompt-heavy spec now carries a `> **Prompt files:**` cross-reference at the top** pointing at its stub file, so future spec readers discover the prompt file before drifting back to the inline prose.

### Step 4 — SCOPE.md vs specs alignment
Cross-checked SCOPE.md against every spec in `docs/specs/`. **Core v1 features are all specced.** Four product-judgement items surfaced — each has a full spec but no SCOPE.md entry:

1. **Branded Invoicing** — referenced in SCOPE only as "#4" in Finance Dashboard's sequencing note; not a numbered feature.
2. **Intro Funnel** — reduced to a single bullet under §1 Lead Gen ("Paid intro offer") despite being one of the largest specs and the primary acquisition surface.
3. **Six-Week Plan Generator** — no SCOPE entry; memory confirms it's a locked trial-shoot deliverable.
4. **Hiring Pipeline** — no SCOPE entry; emerged mid-Phase-3 from Finance/Observatory brainstorms.

**All four recorded in `PATCHES_OWED.md` → Pending → SCOPE.md** flagged as product-judgement items for Andy. Per `feedback_technical_decisions_claude_calls`, Claude does not silently pick scope membership — this is Andy's call.

### Step 5 — FOUNDATIONS.md patch-list consolidation
- **3 patches already applied** (§11.6 LLM model registry, §11.2 `sendEmail()` classification base, §11.2 six hiring classification values).
- **4 Phase-5-gated pending patches** recorded in `PATCHES_OWED.md` → Pending → FOUNDATIONS.md:
  - Six-Week Plan `sendEmail()` classification extensions (3 new values)
  - Task Manager + S&D build-time disciplines 24–29
  - `scheduled_tasks` §11-tier pointer (currently authoritatively at Quote Builder §5.4 / §8.2)
  - Observatory unified-send-gate cross-reference
- **Verdict: no blockers for Phase 4 sequencing.**

## Key decisions

- **Prompt stubs use `.md` not `.ts`.** Stubs carry YAML frontmatter + prose sections so Phase 4 foundation can author real prompts before TS scaffolding lands. The `.ts` split is a Phase 4 foundation task per `lib/ai/prompts/README.md`.
- **Specs link to prompt files via a top-of-spec `> **Prompt files:**` blockquote**, not a trailing reference section. Future readers hit the cross-reference before reading prompt-related prose.
- **Step 4's unscoped specs become stop-point questions for Andy**, not silent scope mutations. Applies `feedback_technical_decisions_claude_calls`.
- **Step 5's pending FOUNDATIONS patches are Phase-5-gated by design** — each lands alongside the build session that consumes it, not upfront.

## Flags / known follow-ups for later steps

- **Step 6** (cross-spec enum review) must look for semantic duplicates surfaced in step 2a: e.g., `trial_shoot_booked` vs `shoot_booked` in `activity_log.kind` across Intro Funnel vs Client Management.
- **Step 7** (handler consistency) must literal-grep the 32-entry handler map at Quote Builder §8.2 against each owner spec's §8.x handler definitions for name mismatches.

## Next session

**Stop point** — Andy must resolve the four SCOPE.md product-judgement items before Batch B runs. After Andy decides, run Batch B autonomously: steps 6, 7, 7a, 10. Then stop at step 11 for Andy, proceed to Batch C (8, 9, 12, 13, 15), then stops at 14 and 16.

See `SESSION_TRACKER.md` → 🧭 Next Action for the authoritative plan.
