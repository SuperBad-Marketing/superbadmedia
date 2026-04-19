---
spec: docs/specs/intro-funnel.md
status: partial (synthesis + retainer-fit + abandon-email calibrated; signal-tag-extraction + apology-email still stub)
populated-by: IF-3 build session
---

# Intro Funnel prompts

## `intro-funnel-signal-tag-extraction`

**Tier:** Haiku. **Intent:** extract `signal_tags` from questionnaire section answers. **Input:** section answers + shape + existing tags. **Output:** array of tags from the closed taxonomy (content session defines v1 taxonomy). **Status:** stub — not yet implemented.

## `intro-funnel-reflection-synthesis`

**Tier:** Opus. **Intent:** generate the post-shoot synthesis reveal text. **Input:** reflection answers + shape + signal tags + onboarding answers + Brand DNA context (system message) + SuperBad voice. **Output:** prose synthesis text (plain text, 2–4 paragraphs). **Implementation:** `lib/intro-funnel/generate-synthesis.ts`. Drift-checked; fallback text on failure.

## `intro-funnel-retainer-fit-recommendation`

**Tier:** Opus. **Intent:** generate the retainer-fit recommendation. **Input:** full context bundle (onboarding + enrichment + reflection + synthesis + Brand DNA + standing brief + safety_valve_triggered flag). **Output:** structured JSON (`recommendation_type`, `confidence`, `reasoning_text`, `flags`). **Implementation:** `lib/intro-funnel/generate-retainer-fit.ts`. Drift-checked with one retry on failure. Internal-only — never shown to prospect.

## `intro-funnel-abandon-email`

**Tier:** Haiku. **Intent:** draft the abandonment rescue email (24h + 3d variants). **Input:** submission state + questionnaire answers + shape + stage + portal link. **Output:** JSON with `subject` + `body`. **Implementation:** inline in `lib/intro-funnel/abandon-tracking.ts`. Drift-checked; hardcoded fallback on failure.

## `intro-funnel-apology-email`

**Tier:** Haiku. **Intent:** apology email for SuperBad-initiated cancel/reschedule. **Input:** reason note + prospect context + mode. **Output:** email subject + body. **Status:** stub — not yet implemented.
