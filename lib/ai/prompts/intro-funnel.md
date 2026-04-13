---
spec: docs/specs/intro-funnel.md
status: stub
populated-by: Intro Funnel content mini-session
---

# Intro Funnel prompts

## `intro-funnel-signal-tag-extraction`

**Tier:** Haiku. **Intent:** extract `signal_tags` from questionnaire section answers. **Input:** section answers + shape + existing tags. **Output:** array of tags from the closed taxonomy (content session defines v1 taxonomy). **Current inline location:** spec §18.

## `intro-funnel-reflection-synthesis`

**Tier:** Opus. **Intent:** generate the post-shoot synthesis reveal text. **Input:** reflection answers + shape + signal tags + onboarding answers + Brand DNA context + SuperBad voice. **Output:** prose synthesis text. **Current inline location:** spec §18.

## `intro-funnel-retainer-fit-recommendation`

**Tier:** Opus. **Intent:** generate the retainer-fit recommendation (three outcomes: retainer / take-the-plan-and-run / not now). **Input:** full context bundle (onboarding + enrichment + reflection + synthesis + Brand DNA + standing brief). **Output:** structured JSON (`recommendation_type`, `confidence`, `reasoning_text`, `flags`). **Current inline location:** spec §18.

## `intro-funnel-abandon-email`

**Tier:** Haiku. **Intent:** draft the abandonment rescue email (24h + 3d variants). **Input:** submission state + questionnaire answers + shape + stage. **Output:** email subject + body. **Current inline location:** spec §18.

## `intro-funnel-apology-email`

**Tier:** Haiku. **Intent:** apology email for SuperBad-initiated cancel/reschedule. **Input:** reason note + prospect context + mode. **Output:** email subject + body. **Current inline location:** spec §18.
