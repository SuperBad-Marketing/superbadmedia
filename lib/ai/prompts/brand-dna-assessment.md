---
spec: docs/specs/brand-dna-assessment.md
status: calibrated
populated-by: Brand DNA Assessment content mini-session (CMS-1), 2026-04-17
---

# Brand DNA Assessment prompts

All five are Opus. Calibrated against the real 79-tag taxonomy and 112-question bank during CMS-1.

## `brand-dna-generate-section-insight`

**File:** `generate-section-insight.ts`
**Intent:** Between-section insight after each of sections 1–4. The single highest-leverage creative prompt — sets the tone for the entire assessment experience.
**Input:** Section number, top tags, prior insights, track.
**Output:** 2–3 sentences. Human register, flat delivery, admin-roommate voice. See spec §6.4.
**Calibration:** Section-specific context (what each section measures), prior-insight awareness (builds on or contradicts earlier observations), tension naming when signals conflict.

## `brand-dna-generate-first-impression`

**File:** `generate-first-impression.ts`
**Intent:** The emotional peak of the reveal. 2–3 sentences, shown alone on screen.
**Input:** Full tag frequency map, section insights, reflection text, track, shape.
**Output:** 2–3 sentences. The irreducible insight.
**Calibration:** Tension pair detection (15 known pairs like risk_appetite vs perfectionism), domain-grouped summaries, reflection contrast analysis, absent-signal awareness.

## `brand-dna-generate-prose-portrait`

**File:** `generate-prose-portrait.ts`
**Intent:** The full narrative portrait. 500–800 words.
**Input:** Full tag map, section insights, reflection, first impression, track, shape, brand override tags (for founder_supplement).
**Output:** 4–6 plain paragraphs. Through-lines, tensions, personality, absent signals, brand-split narrative (when overrides exist).
**Calibration:** Brand override layer for founder_supplement track, 5-point capture framework (through-lines, tensions, personality, reflection contrast, absent signals, brand split), specificity-over-abstraction voice constraint.

## `brand-dna-generate-company-blend`

**File:** `generate-company-blend.ts`
**Intent:** Synthesise ≥2 individual profiles into a company-level Brand DNA.
**Input:** All stakeholder profiles (tags, first impressions, portrait excerpts, brand overrides).
**Output:** Three sections — shared signals (grouped by domain), divergences (specific tensions between stakeholders), company portrait (300–500 words).
**Calibration:** Not an average — a synthesis. Divergences described as productive tensions, not resolved. Brand overrides included when stakeholders used founder_supplement track.

## `brand-dna-generate-retake-comparison`

**File:** `generate-retake-comparison.ts`
**Intent:** Compare previous and current profiles on retake. Side-by-side narrative.
**Input:** Both profiles' tags, first impressions, portrait excerpts, days between assessments.
**Output:** 200–400 words. What held, what shifted, what appeared/disappeared, narrative interpretation.
**Calibration:** Automated tag movement computation (gained, lost, strengthened, weakened, stable). Time-aware framing (different approach for 30-day vs 6-month gaps).
