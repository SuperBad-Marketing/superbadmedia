# Brand DNA Assessment — Technical Handoff

**System:** SuperBad Lite  
**Date:** 2026-04-28  
**Audience:** Developers implementing a similar feature  

---

## 1. What Brand DNA Does

Brand DNA is a personality assessment for businesses and their founders. A respondent answers ~98 multiple-choice questions across 5 themed sections. Each answer silently awards 1–3 "signal tags" from a taxonomy of 79 traits. After completion, an LLM (Claude Opus) reads the accumulated tag frequencies and generates a narrative profile — a written portrait that captures who the person or brand actually is.

The output is not a personality type or a score. It's a prose document that names through-lines, tensions, and absent signals in the respondent's choices.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                              │
│                                                                  │
│  Alignment Gate ──→ Business Context ──→ Section 1 ──→ Insight  │
│                                          Section 2 ──→ Insight  │
│                                          Section 3 ──→ Insight  │
│                                          Section 4 ──→ Insight  │
│                                          Section 5 ──→ Reflection│
│                                                     ──→ Reveal   │
│  (founder_supplement only: +15 supplement questions)             │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     DATA PIPELINE                                │
│                                                                  │
│  Answer → tags_awarded[] → signal_tags{} (freq map on profile)  │
│                                                                  │
│  After each section (1–4):                                       │
│    → Opus generates between-section insight (3–4 sentences)      │
│                                                                  │
│  After section 5:                                                │
│    → Optional free-form reflection                               │
│    → Opus generates first impression (2–3 sentences)             │
│    → Opus generates prose portrait (500–800 words)               │
│                                                                  │
│  Multi-stakeholder (≥2 profiles):                                │
│    → Opus generates company blend                                │
│                                                                  │
│  On retake:                                                      │
│    → Opus generates retake comparison                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Branching Logic — The Three Tracks

### 3.1 Alignment Gate

Before any questions, the respondent answers one routing question:

> **"How much of your business is you?"**

| Option | Track | Effect |
|--------|-------|--------|
| "It's me. The business is an extension of who I am." | `founder` | Questions framed as "you" |
| "It starts from me, but the brand has its own thing going." | `founder_supplement` | Full founder track + 15 supplement questions |
| "We're separate. The brand has its own identity." | `business` | Questions framed as "the brand" / "we" |

No tags are awarded at the gate. It's pure routing.

### 3.2 Question Selection by Track

Each question in the bank has a `track` field:

- **`shared`** — shown to both founder and business tracks. If the question has dual-framed text (`{ founder: "...", business: "..." }`), the appropriate framing is selected based on the respondent's track.
- **`founder`** — only shown to founder and founder_supplement tracks.
- **`business`** — only shown to the business track.

```typescript
function getQuestionsForTrack(section: SectionNumber, track: "founder" | "business"): Question[] {
  return QUESTION_BANK.filter(
    (q) => q.section === section && (q.track === "shared" || q.track === track),
  );
}
```

### 3.3 Company Shape

Profiles also carry a `shape` field that captures team structure:

| Shape | Meaning |
|-------|---------|
| `solo_founder` | One person = the business |
| `founder_led_team` | Founder + team |
| `multi_stakeholder_company` | Multiple decision-makers |

Shape affects downstream prompt context but does not change which questions are shown.

---

## 4. Question Bank Structure

### 4.1 Totals

- **98 core questions** across 5 sections (~18–20 per section)
- **15 supplement questions** (founder_supplement track only)
- **113 total questions** in the bank

### 4.2 Five Sections

| # | Title | What It Measures |
|---|-------|-----------------|
| 1 | Aesthetic Identity | Visual taste, sensory world, cultural touchpoints |
| 2 | Communication DNA | How they write, speak, handle conflict, exist in a room |
| 3 | Values & Instincts | Decision drivers, risk appetite, gut reactions. The deepest section. |
| 4 | Creative Compass | Taste in others' creative work, process, weaknesses |
| 5 | Brand Aspiration | Desired brand feeling, current vs ideal gap, motivational drivers |

### 4.3 Question Shape

Every question has exactly 4 options (a/b/c/d). Each option awards 1–3 signal tags.

```typescript
interface Question {
  id: string;                    // e.g. "s1_q01"
  section: 1 | 2 | 3 | 4 | 5;
  track: "shared" | "founder" | "business";
  text: string | { founder: string; business: string };
  options: {
    a: { text: string; tags: string[] };
    b: { text: string; tags: string[] };
    c: { text: string; tags: string[] };
    d: { text: string; tags: string[] };
  };
  visual?: boolean;  // whether the question has colour swatches, images, etc.
}
```

### 4.4 Example Question

```typescript
q("s1_q04", 1, "shared",
  { founder: "Which colour palette would you trust to represent you?",
    business: "Which colour palette would you trust to represent the brand?" },
  ["Warm earth — terracotta, sage, cream, clay.",
    ["warmth", "muted_palette", "organic_forms"]],
  ["Monochrome with one accent — black, white, grey, one sharp red.",
    ["high_contrast", "minimalism", "geometric_precision"]],
  ["Desaturated quiet — dusty rose, muted blue, warm grey, off-white.",
    ["muted_palette", "warmth", "introversion"]],
  ["Saturated bold — deep navy, burnt orange, mustard, forest green.",
    ["maximalism", "high_contrast", "extraversion"]],
  true  // visual = true (shows colour swatches)
)
```

### 4.5 Supplement Questions

Only shown to the `founder_supplement` track. These ask where the brand intentionally diverges from the founder.

Tags are prefixed with `brand_override.<domain>.<tag>` (e.g. `brand_override.communication.formality`) so downstream prompts can distinguish "who the founder is" from "what the brand should be."

Options that select "same as me" award no tags (empty array).

---

## 5. Signal Tag Taxonomy

### 5.1 Overview

79 tags across 5 domains. Tags are unweighted — frequency across all answers is the only scoring mechanism.

### 5.2 Domains and Tags

**Aesthetic (12 tags):** `warmth`, `minimalism`, `maximalism`, `organic_forms`, `geometric_precision`, `analogue_texture`, `high_contrast`, `muted_palette`, `cinematic_eye`, `tactile_craft`, `sensory_memory`, `curation_instinct`

**Communication (16 tags):** `directness`, `dry_humour`, `brevity`, `warmth_in_voice`, `storytelling`, `formality`, `confrontation_comfort`, `metaphor_use`, `listen_first`, `provocation`, `selective_vulnerability`, `tonal_awareness`, `introversion`, `extraversion`, `conflict_avoidant`, `agreeableness`

**Values (21 tags):** `authenticity`, `risk_appetite`, `risk_caution`, `patience`, `perfectionism`, `pragmatism`, `independence`, `loyalty`, `transparency`, `conviction`, `control_need`, `legacy_drive`, `gut_first`, `head_first`, `high_sensitivity`, `thick_skin`, `openness`, `conscientiousness`, `neuroticism`, `resilience`, `curiosity`, `prudence`, `ambition`

**Creative (13 tags):** `admires_restraint`, `admires_boldness`, `admires_craft`, `rejects_trend`, `genre_fluency`, `nostalgia_pull`, `innovation_pull`, `emotional_resonance`, `intellectual_depth`, `visual_storytelling`, `taste_as_identity`, `anti_polish`, `improviser`

**Aspiration (15 tags):** `premium_positioning`, `underdog_energy`, `quiet_confidence`, `category_creation`, `community_building`, `thought_leadership`, `local_roots`, `global_ambition`, `personality_forward`, `systems_forward`, `reputation_weight`, `proving_ground`, `ambition`, `achievement_orientation`, `affiliation`, `power_drive`

### 5.3 How Tags Accumulate

```
Answer selected → option.tags[] extracted → merged into profile.signal_tags

signal_tags is a Record<string, number>:
  { "warmth": 7, "minimalism": 4, "directness": 6, ... }

Higher frequency = stronger signal. Zero frequency = absence (also informative).
```

### 5.4 Known Tension Pairs

These tag combinations signal contradictory pulls — they make the most interesting profiles:

| Tag A | Tag B |
|-------|-------|
| `risk_appetite` | `perfectionism` |
| `risk_appetite` | `risk_caution` |
| `introversion` | `extraversion` |
| `patience` | `ambition` |
| `independence` | `affiliation` |
| `minimalism` | `maximalism` |
| `directness` | `conflict_avoidant` |
| `gut_first` | `head_first` |
| `admires_restraint` | `admires_boldness` |
| `warmth_in_voice` | `formality` |
| `innovation_pull` | `nostalgia_pull` |
| `conviction` | `agreeableness` |
| `control_need` | `loyalty` |
| `pragmatism` | `perfectionism` |
| `quiet_confidence` | `proving_ground` |

---

## 6. LLM Prompts

All five prompts use Claude Opus. Every prompt is routed through a model registry (`modelFor("slug")`) so the model ID never appears in feature code.

### 6.1 Section Insight (between-section reveal)

**When:** After completing each of sections 1–4  
**Input:** Section answers (what they chose AND what they rejected), top tags, prior insights, track  
**Output:** 3–4 sentences  
**Token limit:** 400  

**Prompt structure:**
1. Subject name and section context (what this section was measuring)
2. Track note (founder = personal address, business = brand address)
3. Full answer traces: for each question, the chosen text AND the three rejected options
4. Aggregate signal pattern (top 8 tags by frequency)
5. Prior insights from earlier sections (for continuity or contradiction)

**Key voice constraints:**
- Two-move structure: (1) name something specific they did, (2) make an inferential leap
- Audience-aware: business owners, not designers — inferences about shopfronts, offices, routines
- Never start with "You", never use hedging language
- Flat, perceptive delivery — "like a sharp friend who just watched you make fourteen decisions"

**Full prompt builder:**

```typescript
export function buildSectionInsightPrompt(input: SectionInsightInput): string {
  // See lib/ai/prompts/brand-dna-assessment/generate-section-insight.ts
  // for complete implementation
}
```

### 6.2 First Impression (emotional peak)

**When:** Start of the reveal sequence (after all sections + reflection complete)  
**Input:** Full tag frequency map (top 15), domain-grouped summaries, tension pairs, section insights, reflection text, track, shape, industry  
**Output:** 2–3 sentences  
**Token limit:** 400  

**Prompt structure:**
1. Subject name, track, shape
2. Top 15 tags by frequency
3. Domain summary (top 4 tags per domain)
4. Detected tension pairs (from the 15 known pairs)
5. All between-section insights
6. Reflection text (with instruction to note what's there that wasn't in structured answers)
7. Business context / industry (if available)

**Key voice constraints:**
- The irreducible insight — "the one thing that's true that everything else orbits"
- Look for: cross-domain through-lines, central tension, reflection vs structured contrast, absent signals
- Never self-reference ("I notice"), never hedge, never use marketing speak

### 6.3 Prose Portrait (full narrative)

**When:** After first impression is generated  
**Input:** Everything — full tag map (top 25), section insights, reflection, first impression, brand override tags, business context, industry  
**Output:** 500–800 words, 4–6 plain paragraphs  
**Token limit:** 2000  

**6-point capture framework:**
1. **Through-lines** — where signals from different domains reinforce each other
2. **Tensions** — contradictory signals described as productive contradictions (never averaged away)
3. **Personality** — the human being that emerges, not a trait list
4. **Reflection contrast** — what the free-form text revealed that structured answers couldn't
5. **Absent signals** — what tags are missing and what that means
6. **Brand split** (founder_supplement only) — where the brand diverges from the founder

**Brand override handling:**
When a founder_supplement profile has override tags, they're injected as a separate block:
```
Brand override signals (where the brand intentionally diverges from the founder):
  brand_override.communication.formality (×3)
  brand_override.aesthetic.minimalism (×2)
  ...
```
The prompt instructs: "The person is X, but the brand reaches for Y" — this is described as the most valuable insight in the entire profile.

### 6.4 Company Blend (multi-stakeholder synthesis)

**When:** ≥2 individual profiles are complete for the same company  
**Input:** All stakeholder profiles (top 15 tags, first impressions, portrait excerpts, brand overrides)  
**Output:** Three sections with `===` headers:
- `SHARED SIGNALS` — tags where ≥2 stakeholders align, grouped by domain
- `DIVERGENCES` — specific tensions between stakeholders (NOT resolved, just described)
- `COMPANY PORTRAIT` — 300–500 words, coherent narrative

**Key principle:** Not an average. A synthesis. Divergences are productive tensions, not problems to solve.

### 6.5 Retake Comparison

**When:** A retake completes  
**Input:** Both profiles' tags, first impressions, portrait excerpts, days between assessments  
**Output:** 200–400 words  

**Automated tag movement computation:**
```typescript
// For each tag in either profile:
if (prev === 0 && curr > 0)       → "gained"
if (prev > 0 && curr === 0)       → "lost"
if (curr > prev + 1)              → "strengthened"
if (prev > curr + 1)              → "weakened"
if (prev > 0 && curr > 0)         → "stable"
```

**Time-aware framing:**
- ≤30 days: "likely re-answering from a similar place, look for subtle shifts"
- 31–180 days: "enough time for real change, look for genuine evolution"
- >180 days: "substantial time has passed, expect meaningful shifts"

---

## 7. Database Schema

### 7.1 Tables

**`brand_dna_profiles`** — The main profile record. One per assessment attempt.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | CUID |
| `subject_type` | enum | `superbad_self` or `client` |
| `track` | enum | `founder`, `business`, or `founder_supplement` |
| `shape` | enum | `solo_founder`, `founder_led_team`, `multi_stakeholder_company` |
| `status` | enum | `pending` → `in_progress` → `complete` |
| `signal_tags` | JSON text | `{ tag: frequency }` map |
| `prose_portrait` | text | 500–800 word Opus output |
| `first_impression` | text | 2–3 sentence Opus output |
| `reflection_text` | text | Optional free-form reflection |
| `business_context` | JSON text | `{ businessDoes, customers, differentiator }` |
| `section_insights` | JSON text | `string[]` — 4 between-section insights |
| `version` | integer | Auto-incremented per retake |
| `is_current` | boolean | Only one current profile per subject |

**`brand_dna_answers`** — One row per answered question.

| Column | Type | Purpose |
|--------|------|---------|
| `profile_id` | text FK | Links to profile |
| `question_id` | text | References static question bank (e.g. `s1_q04`) |
| `section` | integer | 1–5 (or 6 for supplement) |
| `selected_option` | enum | `a`, `b`, `c`, or `d` |
| `tags_awarded` | JSON text | `string[]` of tags this answer produced |

**`brand_dna_blends`** — Company-level synthesis from ≥2 profiles.

| Column | Type | Purpose |
|--------|------|---------|
| `company_id` | text FK | Which company |
| `source_profile_ids` | JSON text | Array of profile IDs used |
| `tags_json` | JSON text | Blended frequency map |
| `prose_portrait` | text | Opus-generated company narrative |
| `divergences_json` | JSON text | Structured divergence flags |

**`brand_dna_invites`** — Tokenised one-time invite links for client assessments.

| Column | Type | Purpose |
|--------|------|---------|
| `contact_id` | text FK | Who the invite is for |
| `token_hash` | text | SHA-256 of the raw token (raw token only in the URL) |
| `expires_at_ms` | integer | Expiry timestamp |
| `used_at_ms` | integer | Null until redeemed, then set (one-time use) |

---

## 8. Server Actions (Write Path)

### 8.1 `submitAlignmentGate`

Creates or resumes the profile, sets the track, redirects to business context page.

### 8.2 `submitAnswer`

1. Validates question exists in the bank
2. Inserts answer row (idempotent — skips if already answered)
3. Merges `tags_awarded` into `profile.signal_tags`
4. Counts answered questions in section
5. If section complete and sections 1–4 → redirect to between-section insight
6. If section complete and section 5 → redirect to reflection page
7. If section incomplete → redirect back to section page

### 8.3 `submitReflection`

Saves optional free-form text, redirects to reveal page (which triggers Opus generation).

### 8.4 `goBack`

Deletes the most recent answer in the section, removes its tags from the frequency map, redirects back so the question reappears. Handles cross-section navigation.

---

## 9. Generation Pipeline

### 9.1 Execution Order

```
1. Section 1 complete → generateSectionInsight(profileId, 1)
2. Section 2 complete → generateSectionInsight(profileId, 2)
3. Section 3 complete → generateSectionInsight(profileId, 3)
4. Section 4 complete → generateSectionInsight(profileId, 4)
5. Section 5 complete → (optional reflection captured)
6. Reveal page loads  → generateFirstImpression(profileId)
7. After first impression → generateProsePortrait(profileId)
8. If ≥2 profiles for company → generateCompanyBlend(companyId)
```

### 9.2 Caching Strategy

Every generator checks if its output field is already populated before calling Opus. Page refreshes and navigation back-and-forth do not trigger additional API calls.

### 9.3 Kill Switches

Two kill switches gate the system:
- `brand_dna_assessment_enabled` — gates the entire assessment flow
- `llm_calls_enabled` — gates Opus API calls specifically (generators return stub text when off)

---

## 10. Navigation Flow

```
/brand-dna                          → Alignment gate
/brand-dna/context                  → Business context (3 text fields)
/brand-dna/section/1                → Section 1 questions (one at a time)
/brand-dna/section/1/insight        → Opus-generated insight reveal
/brand-dna/section/2                → Section 2 questions
/brand-dna/section/2/insight        → Insight reveal
/brand-dna/section/3                → Section 3 questions
/brand-dna/section/3/insight        → Insight reveal
/brand-dna/section/4                → Section 4 questions
/brand-dna/section/4/insight        → Insight reveal
/brand-dna/section/5                → Section 5 questions
/brand-dna/section/5/reflection     → Optional free-form reflection
/brand-dna/reveal                   → Cinematic reveal (first impression + portrait)
```

---

## 11. Key Design Decisions

1. **Frequency-only scoring.** No weighted tags, no manual adjustments. If a tag appears 7 times across 98 questions, it's 7× important. Simplicity is the feature.

2. **Tensions are features.** Contradictory tags (e.g. `risk_appetite` + `perfectionism`) are never averaged away. They're explicitly surfaced as productive contradictions.

3. **Absence is informative.** A tag at frequency 0 is itself a signal. The prompts instruct Opus to note what's conspicuously missing.

4. **Answer traces, not just tags.** Section insight prompts receive the full answer traces — what the respondent chose AND what they rejected. The rejected options reveal as much as the chosen ones.

5. **Prior insight continuity.** Each section insight prompt receives all prior insights. The prompt instructs: "build on what's come before — or contradict it if the new signals warrant it."

6. **Brand override separation.** Supplement tags use a `brand_override.` prefix so they never contaminate the founder's personal signal map. The prose portrait treats them as a separate narrative layer.

7. **One question at a time.** The UI shows a single question per screen, not a form. This is deliberate — it forces the respondent to sit with each choice.

8. **Model registry abstraction.** All LLM calls route through `modelFor("job-name")`. Feature code never references a model ID. This lets you swap models without touching feature code.

---

## 12. Implementation Tips for Your Build

1. **Start with the question bank and tag taxonomy.** These are the foundation. Get the taxonomy right first — changing tags after launch means regenerating every profile.

2. **Build tag aggregation before touching the LLM.** You can test the entire question→tag→frequency pipeline without any API calls.

3. **Prompts are the product.** The quality of the output is 90% prompt engineering. The code is plumbing. Invest in prompt iteration with real test profiles.

4. **Cache everything.** Every Opus call should be idempotent — check if the output already exists before calling. This saves money and prevents inconsistent results on page refresh.

5. **The "back" button is harder than you think.** Going back means deleting the answer AND removing its tags from the frequency map. Test this thoroughly.

6. **Supplement questions are a separate concern.** Build and ship the founder and business tracks first. Add founder_supplement as a second pass.

7. **Company blends are expensive.** They read multiple full profiles and generate a synthesis. Only trigger on explicit completion events, never on page loads.

---

*Document generated 2026-04-28. Source: SuperBad Lite codebase.*
