---
status: DRAFT — awaiting Andy sign-off per AUTONOMY_PROTOCOL §4
author: claude
date: 2026-04-17
applies to: AUTONOMY_PROTOCOL.md (locked 2026-04-13)
---

# Amendment — Context Compaction Discipline

## §4 revision-rule inputs

**Named failure mode:** every Phase 5 build session is hitting at least one auto-compaction mid-session. The second half of the session runs on lossily-compressed memory of the first half. Decisions locked in G1 are summarised by the time G10.5 grades them. Mechanical gates (typecheck / tests / lint / build) still pass because they verify internal consistency — they do not verify that the final commit matches the brief's intent or the spec. Across ~93 build sessions, this drift has likely accumulated as minor cross-session inconsistencies and handoff-note misremembering.

**Specific rules the current protocol did not catch it:** G3 (70% mid-session checkpoint) is defined but appears to be under-triggering, probably because the session reaches compaction threshold before G3's subjective prompt to checkpoint fires. The protocol also permits briefs of unbounded size and permits G10.5 to run a full-diff review on every session, both of which front-load context cost before any code is written.

**Proposed gate / rule additions:** four changes, ranked by impact.

---

## Change 1 — Hard cap on per-session context inputs (new G0.5)

Insert between G0 (kickoff) and G1 (preflight).

> **G0.5 — Context input budget**
>
> Before starting work, the session reports an estimated token cost for its fixed inputs (brief + spec excerpts + mockups + skills + last 2 handoffs). Target: ≤35k tokens of fixed input. Hard ceiling: 50k.
>
> If the estimate exceeds 35k: the brief is too large. Either (a) split the session, (b) replace full spec reads with brief-inline excerpts, or (c) trim the mockup/skill whitelist.
>
> If the estimate exceeds 50k: the session cannot start. Escalate as a blocker handoff.
>
> Rationale: leaves ≥150k tokens for code + tool output + G10.5 + handoff. Under this budget, mid-session compaction becomes rare rather than guaranteed.

## Change 2 — Brief contains spec excerpts, not spec references (amend §2 "Pre-compiled session briefs")

Replace:

> Spec pointer(s) — by file path + section.

with:

> Spec excerpts — the 5–50 lines of spec prose that the session actually needs, inlined into the brief. File path + section kept as an audit footer so the full spec is findable, but the session does not read the spec file itself at session start. If the session discovers mid-build that the excerpt is insufficient, it reads the named section (not the full file), patches the brief's excerpt for the next time, and continues.

Rationale: specs are 400–2000 lines. Most sessions need a handful of paragraphs. Inlining saves ~80% of spec token cost with no loss of fidelity.

## Change 3 — G10.5 runs for UI briefs only; non-UI briefs get a lightweight fidelity grep (amend G10.5)

Amend G10.5 opening clause:

> **The gate (UI briefs only):** before writing the handoff, UI-type sessions spawn a sub-agent...

Add a new clause:

> **Non-UI fidelity grep:** INFRA / FEATURE / TEST sessions do not spawn a reviewer sub-agent. Instead, the closing session runs a grep-based fidelity check in main context:
>
> - Grep the session's diff for every acceptance-criterion keyword named in the brief. Missing criterion = FAIL.
> - Grep the diff for any scope-whitelist violation. Hit = FAIL.
> - Read the brief's "memory alignment" list and scan the diff for silent violations. Hit = FAIL.
>
> Mechanical checks. Cheap in tokens. Catches the same class of drift G10.5 catches for UI, minus the visual-fidelity axis that non-UI sessions don't own.

Rationale: G10.5's reviewer sub-agent adds ~20k tokens per session. For non-UI sessions, the visual / palette / mockup axis is N/A — the review is graded purely on spec prose, which a grep can do structurally.

## Change 4 — Handoff note length cap (amend G11)

Add to G11:

> **Length cap:** 40 lines or fewer. The SESSION_TRACKER row is the primary handoff artefact; the note is the audit detail. If the session genuinely needs more than 40 lines to hand off, it probably did too much in one session — flag as over-scope in `PATCHES_OWED.md` and carry forward.

Rationale: the handoff is read by the next session. Long notes eat the next session's G0 budget. Current notes are running 80–120 lines; capping at 40 halves the load.

---

## Not-in-scope for this amendment

Two things I considered and did not draft:

- **Full session atomicity restructure** (1 table + 1 handler + 1 test per session). This would require re-authoring BUILD_PLAN.md and most pre-compiled briefs. Too large a change to land mid-phase.
- **Replacing G10.5 with continuous CI.** Right process, wrong time — CI infra itself is a deferred piece.

Both worth revisiting post-launch if compaction pressure persists.

---

## How this lands if approved

1. Andy signs off (or redirects).
2. A single `/normal` session applies changes 1–4 to `AUTONOMY_PROTOCOL.md` in one commit, updates `sessions/_brief-template.md` to match, and closes.
3. UI-10 runs as the first session under the amended protocol (Opus, `/deep`, with brief-inline spec excerpts instead of full reads).
4. First 3 post-amendment sessions get a retrospective note in their handoff: did compaction still fire? If yes, we iterate.

Expected outcome: ~40–50% reduction in fixed input cost per session, which should eliminate mid-session compaction on typical sessions. Large sessions (e.g. Wave 18 HP-1) may still need a split, which G0.5 would now force rather than silently accommodate.
