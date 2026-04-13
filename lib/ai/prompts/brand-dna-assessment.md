---
spec: docs/specs/brand-dna-assessment.md
status: stub
populated-by: Brand DNA Assessment content mini-session (largest content session)
---

# Brand DNA Assessment prompts

All five are Opus. Between-section insight is the single highest-leverage creative prompt — must be calibrated against multiple test answer sets in the content session.

## `brand-dna-generate-section-insight`

**Intent:** after each of the four sections. **Input:** section answers + tags + all prior answers + tags + alignment gate + shape. **Output:** 1–2 sentences, human register, flat delivery (voice constraints in spec §6.4). **Current inline location:** spec §9.

## `brand-dna-generate-first-impression`

**Intent:** on completion (×1). **Input:** all answers + full tag map + reflection text + alignment gate + shape. **Output:** 2–3 sentences, sharpest possible insight. **Current inline location:** spec §9.

## `brand-dna-generate-prose-portrait`

**Intent:** on completion (×1). **Input:** all answers + full tag map + reflection text + first impression + alignment gate + shape. **Output:** 500–800 words, coherent narrative portrait. **Current inline location:** spec §9.

## `brand-dna-generate-company-blend`

**Intent:** when ≥2 stakeholder profiles exist (×1 per regeneration). **Input:** all individual profiles (tags + prose + first impressions). **Output:** blended tags JSON + narrative + divergences. **Current inline location:** spec §9.

## `brand-dna-generate-retake-comparison`

**Intent:** on retake completion (×1). **Input:** previous profile + current profile. **Output:** comparison narrative highlighting shifts. **Current inline location:** spec §9.
