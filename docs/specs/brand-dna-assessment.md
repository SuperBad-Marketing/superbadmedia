# Spec — Brand DNA Assessment

**Phase 3 spec. Locked 2026-04-12.**

> **Prompt files:** `lib/ai/prompts/brand-dna-assessment.md` — authoritative reference for every Claude prompt in this spec. Inline prompt intents below are summaries; the prompt file is the single source of truth Phase 4 compiles from.

THE premium retainer differentiator. A deep psychological + aesthetic + communication profile that becomes the perpetual LLM context every downstream feature reads. Not a questionnaire — an assessment. Not a form — a flagship experience.

Governing memories: `project_brand_dna_as_perpetual_context.md`, `project_two_perpetual_contexts.md`, `project_brand_dna_flagship_experience.md`, `feedback_dont_undershoot_llm_capability.md`, `feedback_client_doc_source_hierarchy.md`, `feedback_no_lite_on_client_facing.md`.

---

## 1. Purpose and shape

Brand DNA captures who a client is at their core — visual taste, communication style, values, decision-making patterns, creative instincts, and brand aspiration — so that every LLM-generated artefact in Lite sounds authentically like them without needing to ask anything at the moment of generation.

The profile is a **perpetual reference document**. Once completed, it is read by every downstream Claude call made on behalf of that client: content engine, outreach, reply drafts, morning briefs, ad copy, proposals, creative briefs. It is the "who they are" half of the two-perpetual-contexts pairing (Brand DNA + Client Context Engine).

The assessment experience must feel incredible. This is the one place where over-investing in feel is correct. Hold it to the highest bar for design, interaction, pacing, and copy.

**All client-facing surfaces say "SuperBad", never "SuperBad Lite."** Lite is the internal/admin platform name. Clients interact with SuperBad.

### 1.1 Setup wizard shell reference (added 2026-04-13 Phase 3.5)

The Brand DNA assessment renders through the `WizardDefinition` primitive owned by [setup-wizards.md](./setup-wizards.md) §5.3. Wizard key: **`brand-dna`**. Render mode: **dedicated route** (flagship client-facing capstone — the §12 completion ceremony is the highest-signal moment in the product). This spec owns all step content, the shape-branched question banks, signal-tag extraction, profile rendering, and the completion payload (profile persisted + signal tags + embedding + `activity_log`). The shell chrome (progress bar, resume, cancel, Observatory integration) lives in the primitive; the flagship capstone motion/sound treatment may spend either an inherited flagship slot or a new Tier-1 slot — design-system-baseline revisit decides.

---

## 2. The 30 locks (quick-reference table)

| # | Decision | Lock |
|---|---|---|
| 1 | What is Brand DNA assessing? | Full psychological + aesthetic + communication profile |
| 2 | How do we get honest answers? | Mixed format — scenarios for psychology/values, preferences for aesthetics/taste. No mid-assessment open-text except one optional free-form reflection at the end |
| 3 | Bank structure | Shape-aware sectioned banks. 3 shapes × question framing variants = multiple bank sets. Same signal tags across all |
| 4 | Section count and themes | 5 sections: Aesthetic Identity, Communication DNA, Values & Instincts, Creative Compass, Brand Aspiration. ~15–18 questions per section |
| 5 | Options per MC question | 4 options, consistently. Even number forces a lean, no safe centre pick |
| 6 | Open-text questions | One optional free-form reflection at the end, before the reveal. Not mid-assessment |
| 7 | Signal tag taxonomy | Two-level hierarchy: domain → tag. Each tag in exactly one domain. ~40–60 unique tags, ~8–12 per domain |
| 8 | Answer → tag mapping | Each option maps to 1–3 tags, unweighted. Frequency across answers does the weighting naturally |
| 9 | Profile output format | Structured tags JSON + Opus-generated prose portrait (500–800 words) + first impression paragraph (2–3 sentences) |
| 10 | Multi-stakeholder blending | Individual profiles + Claude-blended company profile. Equal weight. Divergence flagged explicitly. Blend regenerated when stakeholders change |
| 11 | Assessment tracks | Three tracks routed by an alignment gate question. Founder mode ("you" framing), Business mode ("we/the brand" framing), Founder + Supplement mode |
| 12 | Alignment gate | Single question before the assessment: "does your business represent your personality?" Three answers route to the three tracks |
| 13 | Question differentiation | ~60–70% shared core (pronoun-swap), ~30–40% track-exclusive. Easily adjustable post-content-session |
| 14 | Between-section insights | Live Opus call after each section (×4). Perceptive, human-register observations — never AI-narration voice |
| 15 | Reveal structure | Cinematic: Opus "first impression" lead-in (2–3 sentences), then section-by-section profile build with tags + prose |
| 16 | Free-form reflection placement | Before the reveal. Feeds into profile generation. Conscious-vs-indirect contrast is a signal layer |
| 17 | Profile versioning | Full retake from scratch. Side-by-side comparison with Claude-highlighted shifts on reveal |
| 18 | Access paths | Authenticated portal + tokenised invite links. Trial shoot clients nudged (optional). No public teaser |
| 19 | Downstream prompt injection | Tiered: full profile (tags + prose + first impression + reflection) for Opus calls, tags-only JSON for Haiku calls |
| 20 | Assessment UI | Card-per-question with section-driven ambient visual evolution. Each section has its own visual world |
| 21 | Option presentation | Text-primary. ~20–30% of questions (Aesthetic Identity + Creative Compass sections) include autonomously generated visual elements |
| 22 | SuperBad's own profile | Andy takes the assessment as SuperBad, cross-references against existing brand skills, resolves conflicts. Phase 5 milestone |
| 23 | Data model | 4 tables: `brand_dna_profiles`, `brand_dna_answers`, `brand_dna_blends`, `brand_dna_invites` |
| 24 | Absent profile fallback | Outbound always reads SuperBad's profile. Client-specific conditioning only when profile exists. No nudges — portal gate handles it |
| 25 | Onboarding gate | Hard lock with visible preview. Portal doesn't unlock until assessment is complete (retainer/SaaS). Optional for trial shoot |
| 26 | Time framing | Honest total upfront (~35 min), framed as "the deepest brand profile you'll ever complete." Section progress during, no clock |
| 27 | Motion treatment | One new Tier-2 slot for cinematic reveal. Between-section insights inherit Intro Funnel's synthesis reveal slot. One new sound: `sound:brand_dna_reveal` |
| 28 | Voice & delight | Ambient slots: empty states, loading copy, placeholder text. Sprinkle: browser tab titles. Full hidden-egg suppression during assessment |
| 29 | Cost architecture | ~$0.80–1.20 per completed assessment. All Opus. No Haiku prompts in this spec |
| 30 | Insight voice register | Between-section insights must sound like a perceptive person, not an AI. Admin-roommate register per brand voice. No "I notice", no "it's interesting that", no self-congratulation about having observed |

---

## 3. End-to-end journey

### 3.1 Access and entry

**Four access paths converge on the same assessment:**

1. **Retainer client onboarding** — Deal transitions to Won with `won_outcome = 'retainer'`. Portal created, locked behind Brand DNA. Assessment is the first and only thing available. Required.
2. **SaaS customer onboarding** — After Stripe payment success. Portal created, locked behind Brand DNA. Required.
3. **Trial shoot client** — Portal created at Intro Funnel section 1 submit. Brand DNA surfaces as an optional nudge alongside questionnaire progress, calendar booking, and deliverables. Not required, but strongly encouraged.
4. **Tokenised invite** — Andy generates a one-time link from a contact record. The invitee clicks, gets a temporary session scoped to the assessment. Results attach to the contact record.

### 3.2 Alignment gate

Before the assessment begins, one question:

*"Does your business represent your personality?"*

Three options (exact wording locked in content mini-session):
- **"Yes, the business is an extension of me"** → routes to **Founder mode** ("you" framing)
- **"Somewhat — the brand has its own flavour but it starts from me"** → routes to **Founder + Supplement mode** (Founder questions first, then ~10–15 supplement questions capturing where the brand diverges)
- **"Not at all — the brand and my personality are completely separate"** → routes to **Business mode** ("we/the brand" framing)

The gate answer is stored on the profile record (`alignment_gate` enum).

**Existing-profile skip.** If a completed `brand_dna_profiles` row already exists for this account (e.g. completed during the trial-shoot phase or via an Onboarding-issued invite — see onboarding-and-segmentation.md §15.4), the gate does not re-prompt. Entry routes straight to the existing profile's view surface; the user-initiated **Retake flow** (§3.4) is the only path to re-answer. Prevents the "client onboarded with a profile already in hand and got asked to do it again" failure mode.

### 3.3 The assessment flow

1. **Intro screen.** "About 35 minutes. Five sections. The deepest brand profile you'll ever complete. Everything we create for you starts here." Section titles visible. Start button.

2. **Section 1 — Aesthetic Identity** (~15–18 questions). Card-per-question. Four options. Each answer saves immediately. Section-specific ambient visual treatment. Progress shows "Section 1 of 5."

3. **Section 1 → 2 transition.** Loading shimmer (2–4 seconds while Opus generates). Transition card appears with the between-section insight — a dry, human-register observation about what the person just revealed. Never "I notice that..." — just the observation, delivered flat. Then section 2 title card, visual environment shifts.

4. **Sections 2–4** follow the same pattern. Opus insight between each.

5. **Section 5 — Brand Aspiration** completes. No between-section insight after section 5 — the next moment is bigger.

6. **Optional free-form reflection.** A single text box: the specific prompt is locked in the content mini-session, but the purpose is: "tell us directly, in your own words." Prominent "Skip" affordance. Optional. If completed, feeds into profile generation as a contrast signal.

7. **For Founder + Supplement track only:** supplement questions (~10–15) appear after the reflection, before the reveal. Same card-per-question format. No between-section insight — the supplement is a coda, not a section.

8. **Profile generation loading.** A brief intentional pause (5–8 seconds). Ambient loading copy via `generateInVoice()`. The `sound:brand_dna_reveal` fires as the reveal begins.

9. **The reveal.** The flagship moment:
   - **First impression** — 2–3 sentences. The sharpest, most irreducible thing Opus can say about this person. Not a summary. An insight. Fades in alone.
   - **Beat.** 2–3 seconds of stillness.
   - **Cinematic profile build.** Section by section, the profile materialises. Each domain's tags appear alongside the corresponding prose. The person watches their identity being assembled. Total reveal duration: 15–20 seconds.
   - New Tier-2 motion moment. Distinct from anything else in Lite.

10. **Profile page.** After the reveal completes, the full profile remains as a permanent, revisitable page in the portal. Tags organised by domain. Prose portrait. First impression. Reflection (if provided).

### 3.4 Retake flow

- Retakes are full assessments from scratch. No pre-population, no anchoring.
- On completion, the reveal includes a side-by-side comparison: old profile vs new, with Claude-highlighted shifts ("your aesthetic hasn't moved but your values have sharpened").
- Previous version archived (`is_current = false`). New version becomes the active perpetual context.
- Blend regenerated for multi-stakeholder companies when any stakeholder retakes.

### 3.5 Multi-stakeholder flow

- Each stakeholder takes the Founder-mode assessment independently (or Business-mode / Supplement, per their own alignment gate answer).
- When a stakeholder completes their assessment, if the company has ≥2 completed profiles, Opus generates (or regenerates) the company blend.
- The blend captures shared signals and explicitly flags divergences.
- Downstream prompts choose which layer to read: individual profile for one-to-one comms to a specific contact, blended company profile for company-wide work (brand content, proposals, creative briefs).

---

## 4. Sections and question design

### 4.1 Five sections

| # | Section | Domain | Measures | Format emphasis |
|---|---|---|---|---|
| 1 | Aesthetic Identity | `aesthetic` | Visual taste, sensory world, cultural touchpoints (film, music, design) | Preference-heavy, ~20–30% visual options |
| 2 | Communication DNA | `communication` | How they write, speak, respond, handle conflict in words | Scenario-heavy |
| 3 | Values & Instincts | `values` | What drives decisions, what frustrates, risk appetite, gut reactions | Scenario-heavy |
| 4 | Creative Compass | `creative` | Taste in others' creative work, what they admire vs what they'd never do | Preference-heavy, ~20–30% visual options |
| 5 | Brand Aspiration | `aspiration` | How they want their business to feel to others, the gap between current and ideal | Mixed |

### 4.2 Question anatomy

- **4 options per question.** Always. No exceptions.
- **Each option maps to 1–3 signal tags.** Unweighted. The tag set per option is defined in the question bank content files.
- **~15–18 questions per section.** Total ~75–90 per track.
- **Mixed format:** scenarios for Values & Instincts and Communication DNA (catches behaviour). Preferences for Aesthetic Identity and Creative Compass (catches taste). Mixed for Brand Aspiration.

### 4.3 Three tracks

**Alignment gate routes to one of three tracks:**

1. **Founder mode** — all questions framed as "you." 5 sections × ~15–18 questions = ~75–90 total.
2. **Business mode** — all questions framed as "we / the brand / the business." Same section count, same signal tags. ~60–70% of questions are shared core with pronoun/context swap. ~30–40% are track-exclusive (questions that only make sense for one track).
3. **Founder + Supplement** — full Founder mode assessment, then ~10–15 supplement questions capturing where the brand intentionally diverges from the founder's personal style. Supplement is not shape-varied.

**Track-exclusive examples:**

- *Founder-only:* personal decision-making under pressure, relationship to own reputation, personal taste questions only relevant when founder IS the brand.
- *Business-only:* brand vs competitor positioning, consistency across multiple people writing for the brand, market positioning that doesn't make sense directed at a person.

**Shared/exclusive ratio is easily adjustable** — moving a question between shared and exclusive is a content change, not an architectural change. The ratio will be refined during the content mini-session and calibrated after real test runs.

### 4.4 Shape-aware framing

Within each track, question wording varies by shape classification (from the Intro Funnel or set during the assessment for non-Intro-Funnel entries):

- `solo_founder` — "when you face a decision..."
- `founder_led_team` — "when your team faces a decision..."
- `multi_stakeholder_company` — "when the business faces a decision..."

Same signal tags out the back. Only the question wording differs per shape.

**Question bank count:** 5 sections × 3 shapes × 2 core framings (Founder + Business) = **30 core banks** + **1 supplement bank** (not shape-varied) = **31 total banks.**

The wording difference between Founder and Business framing is systematic enough that many questions can be derived from a shared template with pronoun swaps + context adjustments. The content mini-session writes the master questions, then generates the shape × track variants.

### 4.5 Visual options

~20–30% of questions in Aesthetic Identity and Creative Compass sections include visual elements alongside text:

- **Colour palette swatches** — generated programmatically from defined colour arrays
- **Typography samples** — rendered from the typeface options themselves
- **Reference imagery** — generated via image generation API during the content mini-session, reviewed once by Andy, stored as static assets
- **Film/photography style references** — same approach

All visual assets generated autonomously and locked at build time. No per-assessment image generation. No manual sourcing. Andy reviews and approves in one pass during the content mini-session.

---

## 5. Signal tag taxonomy

### 5.1 Structure

Two-level hierarchy: **domain → tag**. Each tag belongs to exactly one domain.

Five domains matching the five sections:

| Domain | Example tags (illustrative — final list locked in content mini-session) |
|---|---|
| `aesthetic` | `warmth`, `symmetry`, `organic_shapes`, `analogue`, `minimalism`, `maximalism`, `muted_palette`, `high_contrast`, `cinematic`, `tactile` |
| `communication` | `directness`, `dry_humour`, `brevity`, `formality`, `storytelling`, `confrontation_comfort`, `jargon_tolerance`, `metaphor_use` |
| `values` | `authenticity`, `risk_embracing`, `risk_cautious`, `patience`, `perfectionism`, `pragmatism`, `loyalty`, `independence`, `transparency` |
| `creative` | `admires_restraint`, `admires_boldness`, `admires_craft`, `rejects_trend_following`, `rejects_minimalism`, `genre_mixing`, `nostalgia` |
| `aspiration` | `premium_positioning`, `underdog_positioning`, `community_building`, `thought_leadership`, `quiet_confidence`, `category_creation` |

**Target: 40–60 unique tags total, ~8–12 per domain.** Final tag list defined alongside the questions in the content mini-session.

### 5.2 Tag aggregation

Each completed profile produces a tag frequency map:

```json
{
  "aesthetic": { "warmth": 5, "analogue": 3, "cinematic": 4 },
  "communication": { "directness": 6, "dry_humour": 4, "brevity": 3 },
  ...
}
```

Frequency = how many answers produced that tag. Higher frequency = stronger signal. No manual weighting.

### 5.3 Supplement tags

Supplement questions (Founder + Supplement track only) produce tags in a sixth pseudo-domain: `brand_override`. These tags represent where the brand intentionally diverges from the founder.

Example: founder profile has `communication.casual` at frequency 5. Supplement produces `brand_override.communication.formal`. Downstream prompts reading the profile for brand-facing work see the override; prompts generating personal comms to the founder use the founder signals.

---

## 6. Profile output

### 6.1 Structured tags

The full domain → tag → frequency JSON object (§5.2). Stored as `tags_json` on `brand_dna_profiles`. For multi-stakeholder blends, stored as `tags_json` on `brand_dna_blends`.

### 6.2 Prose portrait

500–800 words. Generated by Opus on profile completion. Reads: all raw answers, the tag frequency map, the optional reflection text, and the alignment gate answer.

The portrait is a rich human-readable narrative — not a list of traits, but a coherent description of who this person or brand is. It captures nuance that tags alone miss: the tension between contradictory signals, the through-lines across domains, the personality that emerges from the pattern.

Stored as `prose_portrait` on `brand_dna_profiles`.

### 6.3 First impression

2–3 sentences. Generated by Opus on profile completion. Separate prompt from the prose portrait — different purpose. The first impression is the sharpest, most irreducible thing Claude can say. It's the emotional peak of the reveal, not a compressed version of the portrait.

Stored as `first_impression` on `brand_dna_profiles`.

### 6.4 Between-section insights

Four insights, one after each of sections 1–4. Generated live by Opus during the assessment. Each reads the section's answers + tags + all prior section answers/tags.

**Voice register is critical.** These must sound like a perceptive person — dry, observational, flat delivery. Admin-roommate register per the brand voice. Never:
- "I notice that..."
- "It's interesting that..."
- "What stands out is..."
- Any framing that draws attention to the act of observing
- Any self-congratulation about having noticed something

Just the observation itself. Like a sharp friend who watched you for an hour and says one thing. The content mini-session must calibrate the insight prompt against real answer sets before locking it. This is the single highest-leverage prompt in the entire spec.

Stored as `section_insights_json` on `brand_dna_profiles` (for retake comparison).

### 6.5 Company blend

For multi-stakeholder companies with ≥2 completed individual profiles. Generated by Opus. Reads all individual profiles (tags + prose + first impressions).

The blend is a synthesis, not an average. It captures:
- **Shared signals** — where stakeholders agree
- **Divergences** — where they disagree, described as tensions rather than averaged away
- **Combined narrative** — a company voice that acknowledges its composite nature

Stored on `brand_dna_blends` with `divergences_json` for structured access to disagreements.

### 6.6 Retake comparison

When a retake completes, Opus generates a comparison reading both the previous and current profiles. Highlights what changed, what didn't, and interprets the shift ("your aesthetic hasn't moved but your values have sharpened"). Shown during the retake reveal as a side-by-side.

---

## 7. Downstream consumption

### 7.1 Tiered injection

Every downstream Claude call that touches a contact reads the Brand DNA profile. Injection depth scales with call tier:

| Call tier | What's injected | Token budget |
|---|---|---|
| Opus (drafts, content, replies, creative work) | Full profile: tags JSON + prose portrait + first impression + reflection | ~1,500–2,000 tokens |
| Haiku (summaries, action items, braindump parsing, entity matching) | Tags JSON only | ~200 tokens |

### 7.2 Absent profile fallback

- **Retainer/SaaS clients:** profile is never absent — portal gate enforces completion before access.
- **Trial shoot clients:** profile may be absent (optional). Outbound comms to them read SuperBad's own profile for voice. No client-specific conditioning. No nudge UX — the portal nudge handles it.
- **Prospects/contacts:** outbound is always in SuperBad's voice. No prospect-specific Brand DNA exists.

No degradation logic, no fallback prompts, no nudge banners. The gate handles it.

### 7.3 Which profile to read

| Context | Profile used |
|---|---|
| One-to-one comms to a specific contact (email, reply, follow-up) | That contact's individual profile |
| Company-wide work (proposals, brand content, creative briefs) | Company blend (if exists), else primary contact's individual profile |
| SuperBad's own output (outreach, morning brief, content engine, ambient voice) | SuperBad's own Brand DNA profile |
| Drift check grading (§11.5) | The relevant profile — client's for client-facing output, SuperBad's for SuperBad-facing output |

---

## 8. Data model

### 8.1 `brand_dna_profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | text (CUID) | PK |
| `contact_id` | text, nullable | FK to contacts. Null for SuperBad's own profile |
| `company_id` | text, nullable | FK to companies |
| `version` | integer | Auto-incremented per contact. Starts at 1 |
| `is_current` | boolean | Only one current profile per contact. Previous versions archived |
| `alignment_gate` | text enum | `founder` / `business` / `founder_supplement` |
| `shape` | text enum | `solo_founder` / `founder_led_team` / `multi_stakeholder_company`. **Historical snapshot only** — captures the shape at profile-generation time. Canonical source is `companies.shape` (Sales Pipeline §4.1). On profile completion, if this value disagrees with `companies.shape`, write `activity_log.kind = 'shape_mismatch_flagged'` — never silently overwrite. Added 2026-04-13 Phase 3.5 Step 11 F1.b. |
| `needs_regeneration` | boolean | Default false. Set `true` by the `company_shape_updated` activity hook when `companies.shape` changes while `is_current = true`. Surfaces a "shape changed since this was generated — retake recommended" banner on the Brand DNA surface; next Brand DNA read/regeneration resets it to false. Added 2026-04-13 Phase 3.5 Step 11 F1.b. |
| `tags_json` | text (JSON) | Full domain → tag → frequency map |
| `prose_portrait` | text | 500–800 word Opus-generated narrative |
| `first_impression` | text | 2–3 sentence lead-in |
| `reflection_text` | text, nullable | Optional free-form response |
| `section_insights_json` | text (JSON) | Array of 4 between-section insights |
| `supplement_completed` | boolean | True if Founder + Supplement track and supplement was completed |
| `created_at` | integer | UTC epoch ms |
| `completed_at` | integer, nullable | UTC epoch ms. Null if in progress |
| `current_section` | integer | 1–5 (or 6 for supplement). For save/resume |

### 8.2 `brand_dna_answers`

| Column | Type | Notes |
|---|---|---|
| `id` | text (CUID) | PK |
| `profile_id` | text | FK to brand_dna_profiles |
| `question_id` | text | String key referencing the question bank content file |
| `section` | integer | 1–5 for core sections, 6 for supplement |
| `selected_option` | text | `a` / `b` / `c` / `d` |
| `tags_awarded` | text (JSON) | Array of tags this answer produced |
| `answered_at` | integer | UTC epoch ms |

### 8.3 `brand_dna_blends`

| Column | Type | Notes |
|---|---|---|
| `id` | text (CUID) | PK |
| `company_id` | text | FK to companies |
| `source_profile_ids` | text (JSON) | Array of individual profile IDs blended |
| `tags_json` | text (JSON) | Blended tag frequency map |
| `prose_portrait` | text | Blended narrative |
| `divergences_json` | text (JSON) | Structured divergence flags |
| `created_at` | integer | UTC epoch ms |

### 8.4 `brand_dna_invites`

| Column | Type | Notes |
|---|---|---|
| `id` | text (CUID) | PK |
| `contact_id` | text | FK to contacts |
| `token_hash` | text | Hashed token. One-time-use |
| `created_by` | text | FK to users (Andy) |
| `expires_at` | integer | UTC epoch ms. ~30 day expiry |
| `used_at` | integer, nullable | UTC epoch ms. Set on first use |
| `created_at` | integer | UTC epoch ms |

### 8.5 Question banks

**Not database tables.** Static content files (TypeScript or JSON) versioned in the codebase. Each file defines:

- Question ID (string key)
- Question text (per shape variant)
- Four options with text (and optional visual asset reference)
- Tag mapping per option (1–3 tags each)
- Section assignment
- Track (shared / founder-exclusive / business-exclusive)

The content mini-session produces these files. The mapping from question → tags lives here, not in the database.

---

## 9. Claude prompts

| Prompt file | Tier | When | Input | Output |
|---|---|---|---|---|
| `generate-section-insight.ts` | Opus | After each section (×4) | Section answers + tags, all prior answers + tags, alignment gate, shape | 1–2 sentences. Human register, flat delivery. See §6.4 voice constraints |
| `generate-first-impression.ts` | Opus | On completion (×1) | All answers, full tag map, reflection text, alignment gate, shape | 2–3 sentences. The sharpest possible insight |
| `generate-prose-portrait.ts` | Opus | On completion (×1) | All answers, full tag map, reflection text, first impression, alignment gate, shape | 500–800 words. Coherent narrative portrait |
| `generate-company-blend.ts` | Opus | When ≥2 stakeholder profiles exist (×1 per regeneration) | All individual profiles (tags + prose + first impressions) | Blended tags JSON + narrative + divergences |
| `generate-retake-comparison.ts` | Opus | On retake completion (×1) | Previous profile + current profile | Comparison narrative highlighting shifts |

**Cost per completed assessment:** ~$0.80–1.20 (4 section insights + first impression + portrait). Company blend and retake comparison are additional but rare.

**All prompts read SuperBad's Brand DNA profile** for voice calibration on the insight and impression outputs. The assessment's own outputs pass the drift check (§11.5).

---

## 10. Assessment UI

### 10.1 Card-per-question

Each question occupies the full screen. One question, four options, nothing else visible. Tap an option, the card transitions to the next question. Predictable rhythm — read, scan four, pick, next.

Progress indicator: "Section 2 of 5" — never "Question 34 of 87."

### 10.2 Section-driven ambient visual evolution

Each section has its own visual treatment — colour temperature, texture, background atmosphere. The shift between sections marks the thematic transition. Art direction for each section's visual world is locked in the content mini-session.

The visual environment changes by *section*, not by *answer*. Predetermined, reliable, art-directable. No answer-reactive visual adaptation.

### 10.3 Visual option elements

~20–30% of questions in Aesthetic Identity and Creative Compass sections include visual elements alongside text options:

- Colour swatches (programmatic)
- Typography specimens (rendered from typefaces)
- Reference imagery (generated autonomously, reviewed by Andy, stored as static assets)

All generated at build time. No per-assessment image generation.

### 10.4 Between-section transition cards

After each of sections 1–4:
1. Loading shimmer (2–4 seconds, Opus generating)
2. Transition card with the insight — dry, human, flat
3. Section title card for the next section
4. Visual environment shifts to the new section's treatment

Inherits the Intro Funnel's "Claude synthesis reveal" Tier-2 motion slot.

### 10.5 Reveal sequence

After section 5 (and optional reflection + optional supplement):

1. Loading pause (5–8 seconds). Ambient loading copy via `generateInVoice()`
2. `sound:brand_dna_reveal` fires
3. **First impression** fades in alone. 2–3 sentences. Stillness.
4. **Beat.** 2–3 seconds.
5. **Cinematic profile build.** Section by section. Tags materialise alongside prose. ~15–20 seconds total. New Tier-2 motion moment.
6. Full profile page remains as permanent, revisitable portal page.

### 10.6 Portal gate (pre-assessment)

**Hard lock with visible preview.** Before assessment completion:
- Portal login works
- The only content is the assessment itself + a blurred/outlined preview of what the full portal contains
- Preview creates anticipation, not frustration
- The assessment is the entrance, not a barrier

### 10.7 Save and resume

Every answer saves immediately. `current_section` on the profile record tracks progress. Closing the browser mid-section resumes at the next unanswered question in that section. Closing between sections resumes at the next section's title card.

---

## 11. SuperBad's own profile

**Phase 5 milestone, not a content mini-session task.**

1. Brand DNA feature ships and is verified working
2. Andy takes the assessment as SuperBad ("yes, the business is me" → Founder mode)
3. The resulting profile is cross-referenced against the `superbad-brand-voice` and `superbad-visual-identity` skill definitions
4. Conflicts are resolved — either the assessment revealed something the skills missed, or the assessment needs prompt calibration
5. The resolved profile becomes the canonical SuperBad Brand DNA, read by the drift check (§11.5) and all SuperBad-voiced LLM output

**Silent dependency for Surprise & Delight:** the S&D spec cannot be built until this milestone completes.

### 11.1 First-Login Brand DNA Gate (F2.b, 2026-04-13 Phase 3.5 Step 11 Stage 2)

Andy completing SuperBad's own profile is the **platform-unlock event**. Until it exists, Lite is non-functional for Andy.

**Gate behaviour.** A Next.js middleware (foundation primitive — see FOUNDATIONS §11.8) runs on every admin route. It checks for a `brand_dna_profiles` row where `subject_type = 'superbad_self'` AND `status = 'complete'`. If absent, every admin route 302-redirects to `/lite/onboarding`, which mounts the standard Brand DNA Assessment with Andy as the subject (Founder mode, per §3.1). No skip option exists in the UI.

**Why a hard gate, not a nudge.** Per project memories `project_brand_dna_as_perpetual_context.md` and `project_two_perpetual_contexts.md`, every downstream LLM call on behalf of SuperBad reads this profile. Without it, every Brand-DNA-consuming feature (Intro Funnel synthesis, retainer-fit recommendation, Lead Gen drafts, Outreach reply intelligence, brand-voice drift checks, Cockpit briefs) would either fail or fall back to lower-quality output. The platform makes a stronger commitment by refusing to operate without its perpetual context, rather than tolerating a degraded mode.

**Removed by this gate.** No stub primitive, no `loadSuperBadPerpetualBrandDna()` indirection helper, no `brand_dna.use_superbad_stub` settings flag, no stub markdown file. Consumer prompts read the profile directly.

**Implementation safety net.** A `BRAND_DNA_GATE_BYPASS=true` env var (off by default; not surfaced in any UI) lets Andy bypass the gate manually if a bug in the gate ever locks him out of his own platform. Foundation session implements; documented in INCIDENT_PLAYBOOK.md.

**Onboarding voice.** First-login experience frames the gate as "Lite needs to know who you are before it can do anything for you." Single-paragraph framing. Motion-treated reveal. This is also the moment that establishes the bar for the full Brand DNA Assessment quality (per `project_brand_dna_flagship_experience.md`) — Andy's own first run is the proof point.

**Build-order implication for Phase 4.** Brand DNA Assessment (at minimum the SuperBad-self path + the gate middleware) must build before any Brand-DNA-consuming feature can ship. Specifically blocks: Intro Funnel synthesis (§13.3) + retainer-fit (§13.4), Lead Gen draft generation, Outreach reply intelligence, brand-voice drift checks, Cockpit briefs that reference perpetual voice. The full client-facing Brand DNA Assessment surface can ship later in Phase 5 — only the SuperBad-self slice is gating.

**Post-completion handoff into Setup Wizards critical flight.** On SuperBad-self profile completion, the post-reveal exit routes Andy directly into the Setup Wizards critical flight (`docs/specs/setup-wizards.md` §8.1). The two gates run as one continuous first-run admin onboarding arc with no cockpit detour between them: Brand DNA reveal settles → motion transitions into the first critical-flight wizard (`stripe-admin`) → Resend → Graph API → critical-flight capstone ("SuperBad is open for business.") → cockpit. `hasCompletedCriticalFlight(user)` detection runs in the same middleware layer as the Brand DNA gate: if the Brand DNA gate passes but critical flight is incomplete, the middleware 302-redirects admin routes to `/lite/setup/critical-flight/[nextWizardKey]` instead of cockpit, until the capstone fires. Once both gates clear, the middleware falls through to normal routing. This is the one-time bootstrap sequence — the critical-flight middleware check self-terminates per user once `wizard_completions` has rows for all three critical wizards. F1.d / post-Stage 3 sequencing lock (2026-04-13). Mirror lock in Setup Wizards §8.1.

---

## 12. Voice & delight treatment

### 12.1 Ambient surface categories applied

- **Empty states** — portal locked-preview state, assessment intro screen
- **Loading copy** — Opus generation waits (between-section + reveal), section loading
- **Placeholder text** — free-form reflection text box prompt

All routed through `generateInVoice()` with drift check against SuperBad's Brand DNA profile.

### 12.2 Sprinkle claimed

**§2 Browser tab titles** (from `docs/candidates/sprinkle-bank.md`), scoped to the assessment surface:
- During assessment: "SuperBad — Section 3 of 5"
- On reveal: "SuperBad — here you are"
- On completed profile page: "SuperBad — [Client Name]'s Brand DNA"

Mark `[CLAIMED by brand-dna-assessment]` in the sprinkle bank.

### 12.3 Hidden-egg suppression

**Full suppression during the assessment flow.** The assessment is a serious, focused experience. Mid-assessment eggs would break immersion. Same hard-gate category as mid-payment and wizards in the S&D spec.

The completed profile page (post-reveal, revisitable) is eligible for future eggs but none proposed here.

### 12.4 No new ambient surface categories or hidden eggs proposed

No brainstorm gate triggered.

---

## 13. Cross-spec flags

### 13.1 Onboarding + Segmentation (#6)
- Brand DNA is a hard gate in retainer and SaaS onboarding. This spec defines the assessment primitive; Onboarding composes it into the flow and defines the full portal locked-preview state.

### 13.2 Client Context Engine (#7)
- Reads Brand DNA as one of two perpetual contexts. Tiered injection: full profile for Opus, tags-only for Haiku.

### 13.3 Intro Funnel (LOCKED)
- Trial shoot clients get nudged to complete Brand DNA from the portal. Not a retrofit — the nudge lives in the portal layer. Between-section insights inherit Intro Funnel's "Claude synthesis reveal" Tier-2 motion slot.

### 13.4 Client Management (#8)
- Client profile page shows Brand DNA completion status. Multi-stakeholder companies show individual + blend status.

### 13.5 Surprise & Delight (LOCKED)
- Silent build dependency: S&D cannot be built until Brand DNA ships AND Andy takes SuperBad's own assessment.

### 13.6 Content Engine (#10)
- Blog/newsletter/social generation reads client Brand DNA for voice. SuperBad's own profile for SuperBad-authored content.

### 13.7 Daily Cockpit (#12)
- Morning brief narrative reads SuperBad's Brand DNA for tone. May surface "X clients haven't completed Brand DNA" as a passive count.

### 13.8 Sales Pipeline (LOCKED)
- `contacts` may need a `brand_dna_status` field (`not_started` / `in_progress` / `completed`) for pipeline card visibility. Non-breaking addition.

### 13.9 Design System Baseline (LOCKED)
- One new Tier-2 motion slot: cinematic reveal. Tier-2 list grows by 1 (10 → 11 at the owed revisit).
- One new sound registry entry: `sound:brand_dna_reveal`. Registry grows by 1 (8 → 9 at the owed revisit).

### 13.10 Foundations
- No new primitives. All §11 cross-cutting constraints apply. Tiered profile injection is a consumption convention, not a Foundations addition.

### 13.11 `activity_log.kind` gains ~8 values
- `assessment_started`, `section_completed`, `assessment_completed`, `profile_generated`, `blend_generated`, `invite_created`, `invite_used`, `retake_started`

---

## 14. Content mini-session scope

The largest and most important content session in the entire project. Must not be rushed.

**Produces:**
- Alignment gate question — final wording for the three options
- 30 core question banks (5 sections × 3 shapes × 2 framings) with shared/exclusive split
- 1 supplement bank (~10–15 questions for the "somewhat" track, ~15–20 for the "not at all" track)
- Signal tag taxonomy — final list of 40–60 tags across 5 domains
- Tag mappings — which tags each option awards
- Visual asset generation — colour swatches, typography specimens, reference imagery for the ~20–30% visual questions
- Between-section insight prompt — calibrated against real test answer sets. The single highest-leverage prompt in the spec
- First impression prompt
- Prose portrait prompt
- Company blend prompt
- Retake comparison prompt
- Free-form reflection prompt wording
- Section visual world art direction (5 treatments)
- Intro screen copy
- Assessment time framing copy
- All ambient voice copy (empty states, loading, placeholder)
- Browser tab title treatments

**Must run before Phase 5 build sessions for Brand DNA.** Recommended as a dedicated session with `superbad-brand-voice` and `superbad-visual-identity` skills loaded.

---

## 15. Open questions (to resolve in content mini-session or Phase 5)

1. **Exact question count per section.** Spec targets ~15–18. Content mini-session may land higher or lower once the tag taxonomy is finalised and questions are mapped.
2. **Supplement depth for "somewhat" vs "not at all."** Spec targets ~10–15 and ~15–20 respectively. May converge to a single supplement length if the questions work for both.
3. **Shape detection for non-Intro-Funnel entries.** Trial shoot and SaaS clients enter via the Intro Funnel which already classifies shape. Tokenised invite links need to capture shape — either Andy sets it when generating the link, or the assessment asks as a pre-gate question alongside the alignment gate.
4. **Visual asset generation tooling.** Which API for reference imagery generation. Resolve in Phase 5 infra.
5. **Reveal motion choreography.** Exact timing, easing, sequence. Phase 5 build session C with iteration headroom.

---

## 16. Risks

1. **Between-section insight quality.** If these sound like AI, the flagship experience is dead. Mitigation: the prompt is calibrated against real answer sets in the content mini-session with multiple test runs. Voice register constraints (§6.4) are non-negotiable.
2. **Question bank quality.** Bad questions produce thin profiles. Mitigation: content mini-session is dedicated, not rushed, and includes test runs of complete assessment paths.
3. **Multi-stakeholder blend coherence.** Blending 3 divergent profiles into something useful is hard. Mitigation: the blend prompt captures tensions rather than averaging. Test with synthetic diverse profiles before real clients.
4. **Assessment abandonment.** 35 minutes is a real ask. Mitigation: section 1 (Aesthetic Identity) is the most engaging section — front-load the "this is different" feeling. Save-anywhere means no progress loss. The between-section insights create "just one more section" pull.
5. **Profile feels wrong.** The person reads the reveal and thinks "that's not me." Mitigation: retake path exists. The optional reflection gives the person a voice. The first impression prompt is the highest-stakes prompt — calibrate it thoroughly.

---

## 17. Reality check

**Hardest parts:** insight prompt voice calibration, question bank design, cinematic reveal choreography, multi-stakeholder blend quality.

**What could go wrong:** abandonment at section 3, profile that feels generic, insights that sound like AI, supplement track feeling like extra homework.

**Doable?** Yes. Architecture is clean — four tables, five Opus prompts, card UI with section transitions, token invites reusing existing patterns. The hard work is creative (question design, insight prompts, reveal choreography), not technical. The content mini-session is the critical path.

**Phase 5 sizing:** 3–4 sessions minimum.
- **Session A:** Data model + invite system + alignment gate + section save/resume
- **Session B:** Card UI + section transitions + ambient visual evolution + between-section insight calls
- **Session C:** Profile generation + cinematic reveal + first impression + sound + motion
- **Session D:** Multi-stakeholder blend + retake comparison + portal gate integration

Sessions A and B can run in parallel. C depends on B. D depends on A and C.

**Phase 5 milestone (post-build):** Andy takes SuperBad's own assessment. Cross-reference against brand skills. Resolve conflicts. Unlocks Surprise & Delight build.
