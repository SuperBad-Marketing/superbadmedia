# Phase 3 — Six-Week Plan Generator — Handoff

**Date locked:** 2026-04-13
**Questions resolved:** 16
**Spec:** [docs/specs/six-week-plan-generator.md](../docs/specs/six-week-plan-generator.md)
**Closes:** Phase 3 — this was the last outstanding feature spec.
**Unlocks:** Phase 3.5 spec-review exit gate.

---

## What the spec does

Generates the bespoke week-by-week marketing plan bundled as a trial-shoot deliverable ($297 trial shoot = 1× short-form video + 10 photos + 6-week strategy + 60 days portal access). Plan is framed honestly as "this is what we'd implement if we were your agency" — broken down so the prospect can self-run it if they don't convert, or take it forward as the live retainer strategy if they do. Generation is autonomous (two-stage Opus + Haiku self-review) but Andy reviews and approves before any prospect sees the plan.

---

## Load-bearing decisions (quick table)

| # | Decision | Memory impact |
|---|----------|---------------|
| 1 | Two-stage Opus (strategy → per-week) + Haiku self-review; stages calibrate in content mini-session | — |
| 2 | Entry point = Andy pastes Pixieset URL + fills structured shoot-day notes form on Trial Shoot panel → generator fires | — |
| 3 | Artefact = web page inside shared Client Management portal (plan is one section) + Puppeteer PDF takeaway | Reshapes Intro Funnel post-shoot portal to be Client Management portal (patches owed) |
| 4 | Plan scope = full marketing plan (email list, lead magnets, Meta ads, local SEO, partnerships, content) — not content-only | — |
| 5 | Current-state input = hybrid enrichment pre-fill + shoot-day notes Andy confirms/corrects + LLM low-confidence flagging at review | — |
| 6 | Andy review UX = two-tier (strategy review → detail review) with per-week regen, no inline editing (except hand-edit at retainer refresh-review) | — |
| 7 | Prospect revision = one free "this doesn't fit" button → routes to Andy's queue with note | — |
| 8 | Plan framing = IS the retainer plan, self-run version (not teaser, not lite artefact) | New memory: `project_six_week_plan_is_the_retainer_plan.md` |
| 9 | Week 1 clock = non-converters click "Start Week 1" on portal; converters' first retainer payment fires it | — |
| 10 | Non-converter portal lifecycle = 60 days from shoot completion, then portal archives (PDF stays with them) | New memory: `project_non_converter_portal_lifecycle.md` |
| 11 | Chat NOT owned by this spec — consumed from Client Management bartender primitive with pre-retainer rate-limit | — |
| 12 | Retainer migration = on Deal Won, approved plan copies into Client Context as `active_strategy` artefact; Andy refresh-reviews at kickoff | — |
| 13 | v1.0 scope = trial-shoot-only; mid-cycle + end-of-cycle re-planning deferred to Strategic Planning v1.1 | Aligns with `project_strategic_planning_postlaunch.md` |
| 14 | Intake questionnaire (Intro Funnel) must contain enough practical info to feed generator — Andy's direct patch | Patch owed on Intro Funnel |
| 15 | Shoot-day notes schema = Marketing Infrastructure checklist (6 fields enrichment-prefilled) + Goals (1–3 ordered) + 4 × 1–5 Signals + Observations textarea | — |
| 16 | Success metrics = revision-request rate < 10% + regens ≤ 2 + median review < 10min (primary); retainer conversion lift (secondary) | — |

---

## What the next session should know

### Phase 3.5 is next — the exit gate

This spec puts substantial load on the 3.5 reconciliation pass:
- **11 patches owed** across Intro Funnel (×3), Client Management (×2), Client Context Engine, Daily Cockpit, Cost & Usage Observatory, Branded Invoicing/SaaS Billing, Surprise & Delight sprinkle bank, FOUNDATIONS §11.2, `activity_log.kind` (17 new values), `scheduled_tasks.task_type` (3 new types), design-system-baseline (2 new Tier-2 motion candidates).
- **Lock-date filter for 3.5 backward pass:** this spec was locked after every other spec it references. All its patches are forward (apply to earlier-locked specs). No backward diff needed *for this spec*.
- **Cross-spec contract surface in this spec is already inlined** per the self-containment rule. Phase 5 build sessions reading only this spec can execute without reaching into other specs' handoffs.

### Data model footprint
- 3 new tables (`six_week_plans`, `six_week_plan_task_progress`, `trial_shoot_notes`).
- Extends `activity_log.kind` enum by 17 values.
- Adds 3 `scheduled_tasks.task_type` values.
- Adds 3 `sendEmail()` classifications.
- 9 new settings keys under `plan.*`.
- 4 new LLM model registry entries.

### Build sizing (Phase 5)
4 sessions:
- **A (INFRA)** — data model + helpers + prompt stubs.
- **B (FEATURE)** — generator pipeline + Andy review UI. Requires content mini-session complete.
- **C (FEATURE)** — portal surface + PDF + revision flow. Depends on Client Management portal shell shipped.
- **D (FEATURE)** — retainer migration + non-converter expiry + Stripe hook. Depends on Client Management migration job + archive logic.

Critical-flow E2E smoke test added: trial shoot → plan generation → Andy approval → portal reveal → PDF download → self-activation → Week 1 progress path.

### Content mini-session (owed, medium)
Must run before Phase 5 session B. Produces:
- Stage 1 Opus prompt calibrated on ≥ 8 synthetic scenarios.
- Stage 2 Opus prompt.
- Haiku self-review checklist final form.
- Revision-reply Haiku prompt.
- Portal page copy (intro block, "Start Week 1", revision modal).
- PDF layout + footer sprinkle line.
- 3 email bodies (release, revision-resolved, expiry).
- Browser tab title rotation pool.
- Andy review UI microcopy.

---

## Key decisions Andy made that shaped the spec

1. **"Intake questionnaire should contain enough info to generate the plan."** (Mid-brainstorm, after Q4.) This reshaped the generator's context bundle and created a patch on the already-locked Intro Funnel spec. The shape-branched self-persuasion questions must be extended with practical marketing-infrastructure info (email list, ads, goals, current channels) — either folded into the banks or appended as a new section, resolved in Intro Funnel content mini-session.

2. **"Plan is what we'd implement if we were your agency."** (Post-Q7 framing clarification.) Killed the "bait-and-switch" risk of a watered-down self-service artefact. Locked the prompt framing for stages 1 + 2 + portal copy. New memory.

3. **"60 days portal access + limited chat for non-converters."** (Q9 correction.) Killed the "portal dormant indefinitely" line in Intro Funnel spec. Created the non-converter expiry job + forced the unified-portal architectural insight: the trial-shoot post-shoot portal IS the Client Management portal, just pre-retainer and time-bounded. Chat is Client Management's bartender consumed with a rate-limit.

4. **"Week 1 clock: self-activate for non-converters; retainer payment fires for converters."** (Q9 two-trigger clarification.) Split the clock logic cleanly — no tension between the two paths.

5. **"At conversion, we review the plan against retainer deliverables."** (Q10 reframe.) Made the refresh-review at retainer kickoff a real review (with regen + hand-edit options), not a five-minute rubber-stamp. This is the one surface in the spec where inline editing exists.

---

## Memories added / touched

**New memories written this session:**
- [`project_six_week_plan_is_the_retainer_plan.md`](../.claude/projects/-Users-Andy-Desktop-SuperBad-Lite/memory/project_six_week_plan_is_the_retainer_plan.md) — plan framing, governs prompts + portal copy + on-conversion behaviour.
- [`project_non_converter_portal_lifecycle.md`](../.claude/projects/-Users-Andy-Desktop-SuperBad-Lite/memory/project_non_converter_portal_lifecycle.md) — 60-day window, rate-limited chat, portal archive at day 60, PDF retained.

**Memories consulted / applied:**
- `project_six_week_plan_is_real_deliverable.md` (quality bar framing)
- `project_strategic_planning_postlaunch.md` (v1.0 scope cut justification)
- `project_two_perpetual_contexts.md` (Brand DNA + Client Context injection)
- `project_brand_dna_after_trial_shoot.md` (Brand DNA optional at trial — generator degrades gracefully)
- `feedback_technical_decisions_claude_calls.md` (silently locked implementation details)
- `feedback_no_content_authoring.md` (Andy doesn't author ongoing content — structured form not blank textarea)
- `feedback_dont_undershoot_llm_capability.md` (two-stage Opus trusted without training data wait)
- `feedback_felt_experience_wins.md` (plan framing over convention)
- `feedback_primary_action_focus.md` (no nag surfaces on non-converter path)
- `feedback_motion_is_universal.md` (motion candidates added to design-system revisit queue)
- `project_context_safety_conventions.md` (prompt-file extraction + PATCHES_OWED logging + spec self-containment)

---

## Patches owed (recap — all logged in `PATCHES_OWED.md`)

Intro Funnel:
- Replace "portal stays dormant indefinitely" with 60-day expiry.
- Extend intake questionnaire for plan-generator practical inputs.
- Post-shoot portal surfaces migrate to Client Management portal shell.

Client Management:
- Pre-retainer portal rendering mode (section gating + 60-day archive + chat rate-limits).
- Portal chat reads active plan + gains "explain a week/task" safe action.

Cost & Usage Observatory:
- 4 new LLM jobs in §7 model registry.

Daily Cockpit:
- `getWaitingItems()` + `getHealthBanners()` gain new source kinds.

Client Context Engine:
- Confirm/add `active_strategy` artefact type + `origin: 'six_week_plan'` + `pending_refresh_review` flag.

Branded Invoicing / SaaS Subscription Billing:
- Extend first-retainer-charge webhook handler to fire `six_week_plan_retainer_week_1_start`.

FOUNDATIONS §11.2:
- `sendEmail()` classification enum gains 3 values.

Cross-spec enums:
- `activity_log.kind` — 17 new values.
- `scheduled_tasks.task_type` — 3 new values.

Design-system-baseline revisit:
- 2 new Tier-2 motion candidates (`motion:plan_reveal`, `motion:plan_activate`).

Surprise & Delight sprinkle bank:
- Claim PDF footer dry line.

---

## Open questions / deferred scope
- End-of-Week-6 re-planning → v1.1 Strategic Planning.
- Mid-cycle retainer re-planning → v1.1 Strategic Planning.
- Direct/referral/legacy onboarding plan generation → those paths don't have the trial shoot, so don't need the plan.
- Plan versioning UI for prospects — no history, latest version only.
- PDF with interactive / progress state — static snapshot only.

None of these need resolving before Phase 3.5.

---

## Context hygiene

Session ended cleanly. Spec is self-contained and will not require re-reading other specs to execute Phase 5 build sessions. Main risks into Phase 3.5:
- **Prompt-stage drift between content mini-session and Phase 5** — mitigated by prompts-as-files convention.
- **Andy's shoot-day notes discipline** — mitigated by Observatory telemetry flagging thin notes.
- **Intro Funnel intake questionnaire extension design** — must not break the self-persuasion flow. Handled in Intro Funnel content mini-session.
