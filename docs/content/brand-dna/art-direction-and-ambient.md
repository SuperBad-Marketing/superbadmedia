# Brand DNA Assessment — Art Direction, Ambient Copy & Experience

**Locked:** CMS-1 content mini-session, 2026-04-17.
**Spec ref:** `docs/specs/brand-dna-assessment.md` §10.2 (visual evolution), §10.4 (transitions), §10.5 (reveal), §14 (content mini-session scope).

---

## 1. Section visual worlds

Per spec §10.2: each section has its own visual treatment — colour temperature, texture, background atmosphere. Changes by section, not by answer. Predetermined, art-directable.

All treatments use the SuperBad palette (Dark Charcoal #1A1A18, SuperBad Red #B22848, Warm Cream #FDF5E6, Retro Pink #F4A0B0, Retro Orange #F28C52) as the foundation, with section-specific modulation.

### Section 1 — Aesthetic Identity
**Visual world:** *The gallery*
- Background: Dark Charcoal base with a subtle warm grain texture — not smooth, slightly tactile
- Accent warmth: Warm Cream (#FDF5E6) at ~10% opacity as a vignette around the card edges
- Card surface: Slightly lifted, soft shadow, the question card feels like a mounted photograph
- Ambient movement: None. Stillness is the aesthetic. The question cards are the only objects
- Colour accent: Retro Pink appears in the progress indicator and selected-option state
- Atmosphere: Quiet, considered, gallery-like — as if the questions are exhibits

### Section 2 — Communication DNA
**Visual world:** *The conversation*
- Background: Dark Charcoal, slightly warmer than Section 1 (shifted 2° toward brown)
- Accent: Warm Cream type becomes the dominant text colour — feels like ink on warm paper
- Card surface: Tighter to the background, less lift — the separation narrows, more intimate
- Ambient movement: Subtle breathing animation on the card — 6s inhale/exhale scale at 0.2%
- Colour accent: Retro Orange appears in selected-option state — warmer than Section 1's pink
- Atmosphere: Intimate, conversational, like being across a table from someone who's listening

### Section 3 — Values & Instincts
**Visual world:** *The interior*
- Background: Dark Charcoal at full depth — the darkest section
- Accent: Reduced. Warm Cream at lower brightness. The visual world pulls inward
- Card surface: Minimal shadow. The card almost melts into the background — less object, more thought
- Ambient movement: Very slow pulse on the background grain — imperceptible unless you look, 12s cycle
- Colour accent: SuperBad Red on selected-option state — the most direct, least decorated section
- Atmosphere: Serious, internal, quiet. This is the section where people pause longest

### Section 4 — Creative Compass
**Visual world:** *The studio*
- Background: Dark Charcoal with the most visible texture — visible grain, almost photographic
- Accent: Warm Cream returns to full brightness. Visual questions get generous framing
- Card surface: Varied — text-only questions use Section 2's intimate card; visual questions use a wider, more cinematic card with image areas
- Ambient movement: Return of stillness. But transitions between questions are slightly more elastic — a 10% longer spring, a 5% wider overshoot
- Colour accent: Retro Pink and Retro Orange alternate across visual question options
- Atmosphere: Engaged, curious, tactile. The section that feels most like browsing

### Section 5 — Brand Aspiration
**Visual world:** *The horizon*
- Background: Dark Charcoal beginning to warm — the lightest version, shifted toward the SuperBad Red end
- Accent: Warm Cream at full brightness. The world is opening up
- Card surface: Maximum lift from background — the cards float, the future feels spacious
- Ambient movement: Very slow upward drift of background grain — 0.5px per second. Almost imperceptible but creates a sense of forward movement
- Colour accent: SuperBad Red in a softer application — lower opacity (60%), wider stroke, less sharp
- Atmosphere: Aspirational but grounded. Looking forward, not up. The assessment is ending and the world is about to open

### Supplement (founder_supplement track only)
**Visual world:** *The split*
- Background: Same as Section 5 but with a subtle vertical divide — a 1px hairline in Retro Pink at ~20% opacity, centred
- Accent: Left half of background very slightly warmer, right half very slightly cooler — the two sides of the founder/brand split
- Card surface: Same lift as Section 5
- Ambient movement: None. Return to stillness
- Colour accent: Retro Pink throughout — the soft, secondary register for the supplement
- Atmosphere: Reflective, honest. "We're asking you to separate yourself from the thing you built"

---

## 2. Browser tab titles

Per spec §14: ambient delight via browser tab titles. These cycle based on assessment state.

| State | Tab title |
|---|---|
| Alignment gate | SuperBad — Before we begin |
| Section 1 in progress | SuperBad — How you see the world |
| Section 1 → 2 transition | SuperBad — We noticed something |
| Section 2 in progress | SuperBad — How you land in a room |
| Section 2 �� 3 transition | SuperBad — Still watching |
| Section 3 in progress | SuperBad — What moves under the surface |
| Section 3 → 4 transition | SuperBad — Getting warmer |
| Section 4 in progress | SuperBad — What you can't stop looking at |
| Section 4 → 5 transition | SuperBad — Almost there |
| Section 5 in progress | SuperBad — Where you're going |
| Supplement in progress | SuperBad — The version that isn't you |
| Reflection prompt | SuperBad — One more thing |
| Profile generating (loading) | SuperBad — Building your profile |
| Reveal in progress | SuperBad — There you are |
| Profile page (permanent) | SuperBad — Your Brand DNA |

---

## 3. Intro screen

Per spec §3.3 step 1. The first thing they see after the alignment gate.

**Headline:** Your Brand DNA

**Body:**
> Five sections. About 35 minutes.
> The deepest brand profile you'll ever complete.
> Everything we create for you starts here.

**Section list** (visible, non-interactive):
1. Aesthetic Identity
2. Communication DNA
3. Values & Instincts
4. Creative Compass
5. Brand Aspiration

**Button:** Begin

**Design notes:**
- Headline in Black Han Sans (display font)
- Body in DM Sans italic at Retro Pink — the mutter register
- Section list in Righteous uppercase with generous letter-spacing
- Button in SuperBad Red, full width on mobile, centered on desktop
- Dark Charcoal background, no section visual treatment yet — neutral

---

## 4. Section title cards

Shown at the start of each section. Full-screen moment.

**Format:**
- Section number in Righteous uppercase, Retro Pink, small: `SECTION 1 OF 5`
- Title in Black Han Sans, Warm Cream, large: `Aesthetic Identity`
- Subtitle in DM Sans italic, Retro Pink: `How you see the world.`
- Auto-advance after 3 seconds, or tap to continue

| Section | Title | Subtitle |
|---|---|---|
| 1 | Aesthetic Identity | How you see the world. |
| 2 | Communication DNA | How you land in a room. |
| 3 | Values & Instincts | What moves under the surface. |
| 4 | Creative Compass | What you can't stop looking at — and what you'd never make. |
| 5 | Brand Aspiration | The gap between where you are and where you're going. |
| Supplement | Where the Brand Splits From You | The version of this that isn't you. |

---

## 5. Between-section transition cards

Per spec §10.4. After sections 1–4 (not after section 5).

**Sequence:**
1. Loading shimmer (2–4s while Opus generates) — soft pulse animation on a minimal card
2. Insight text fades in — DM Sans, Warm Cream, centred, generous line height
3. Tap or auto-advance (5s) to next section's title card

**Loading copy** (shown during the 2–4s shimmer, rotated randomly):
- "Processing..."
- "Reading between the lines..."
- "Connecting the dots..."
- "One moment..."

**Design notes:**
- The insight card uses the departing section's visual world (not the arriving section's)
- Text appears word-by-word at 40ms intervals — not character-by-character, not all-at-once
- Maximum 3 lines on mobile at the body font size — insight prompts are constrained to produce this

---

## 6. Free-form reflection prompt

Per spec §3.3 step 6. Appears after Section 5 (and before Supplement if applicable).

**Prompt text:**
> Before we show you what we've found — is there anything you want to say?
> About your brand, your work, what you're building, or who you're becoming.
> In your own words. Or skip this — we've got plenty to work with.

**Design notes:**
- Full-screen card, dark background
- Prompt in DM Sans, Warm Cream
- Text area: large, generous padding, no character count, no placeholder text
- "Skip" as a text link below the text area, not a button — Retro Pink, understated
- "Continue" button appears only after first keystroke — SuperBad Red
- No section visual treatment — neutral dark, a pause between the assessment and the reveal
- Tab title: "SuperBad — One more thing"

---

## 7. Profile generation loading

Per spec §10.5 step 1. The pause before the reveal.

**Duration:** 5–8 seconds (actual Opus generation time, not artificial delay).

**Loading copy** (shown one at a time, cycling every 2s):
- "Building your profile..."
- "Finding the through-lines..."
- "Naming the tensions..."
- "Almost ready..."

**Design notes:**
- Full dark screen, centred text
- DM Sans italic, Retro Pink
- Each line fades in/out softly (300ms)
- No progress bar, no spinner — just the text, breathing
- `sound:brand_dna_reveal` fires as the loading copy fades and the first impression appears

---

## 8. Reveal sequence copy

Per spec §10.5. The flagship moment.

**Step 1 — First impression**
- First impression text fades in alone, centred
- Playfair Display italic, Warm Cream, generous size
- Stillness. 2–3 seconds of nothing else on screen

**Step 2 — Beat**
- 2–3 seconds. The first impression remains. Nothing changes.
- The stillness IS the design

**Step 3 — Cinematic profile build**
- First impression moves to the top of the screen (animated)
- Section-by-section, the profile materialises below
- Each section: domain label (Righteous uppercase, Retro Pink) → tags fade in (DM Sans, small, Warm Cream at 60% opacity) → prose paragraph fades in (DM Sans, Warm Cream)
- Timing: ~3 seconds per section, 15–20 seconds total
- The visual world transitions through all 5 section treatments in sequence during the build

**Step 4 — Profile complete**
- All sections visible
- Reflection text (if provided) appears last, in its own block, DM Sans italic, Retro Pink
- The page is now the permanent profile view — scrollable, revisitable

---

## 9. Empty states and error copy

**Profile not started:**
> Your Brand DNA is waiting. Five sections, about 35 minutes, and everything we create for you starts from what you tell us here.
> [Begin Assessment]

**Profile in progress (resumed):**
> You left off in Section {n}. Pick up where you were.
> [Continue]

**Opus generation failed (section insight):**
> *(silently omit the transition card and advance to the next section — no error shown to the user)*

**Opus generation failed (profile):**
> Something went wrong building your profile. We're looking at it. Try again in a few minutes.
> [Retry]

**Retake available (profile page):**
> Things change. If your brand has shifted, you can retake the assessment and we'll show you what moved.
> [Retake Assessment]

---

## 10. Visual asset descriptions

Per spec §4.5 + §14. Static assets generated at build time, reviewed once by Andy.

### Section 1 visual questions

**S1-Q04 — Colour palettes** (4 swatch strips)
- a) Warm earth: terracotta #C2714F, sage #8B9E7B, cream #F5F0E1, clay #B8926A
- b) Monochrome + accent: black #1A1A18, white #FAFAFA, grey #6B6B6B, sharp red #D42B2B
- c) Desaturated quiet: dusty rose #C9A0A0, muted blue #8FA4B3, warm grey #B0A99F, off-white #F2EDE6
- d) Saturated bold: deep navy #1B2A4A, burnt orange #CC6B2C, mustard #D4A843, forest green #2D5A3D

**S1-Q07 — Typeface specimens** (render "The work speaks for itself")
- a) Serif: rendered in a classic editorial serif (e.g. Playfair Display)
- b) Sans-serif: rendered in a clean geometric sans (e.g. DM Sans)
- c) Handwritten: rendered in a warm script (e.g. Caveat or similar)
- d) Monospace: rendered in a technical mono (e.g. JetBrains Mono)

**S1-Q11 — Decade moodboards** (3 small reference images per option, option d has no image)
- a) 1970s: warm colour photography, textured paper, rounded type, record sleeve aesthetic
- b) 1990s: high-contrast B&W, raw typography, grunge-adjacent, anti-polish
- c) 2020s: clean digital, intentional whitespace, geometric sans, considered colour

**S1-Q16 — Image treatments** (same photograph processed 4 ways)
- Base image: a street scene or still life with natural light — the subject doesn't matter, only the treatment
- a) Film grain, warm colour cast, slightly overexposed
- b) High contrast black and white, deep shadows
- c) Soft focus, muted tones, dreamy
- d) Sharp, saturated, modern editorial

### Section 4 visual questions

**S4-Q04 — What you can't stop looking at** (4 reference photographs)
- a) Product photography: single object on clean surface, studio lit, no context
- b) Street photography: layered, crowded, overlapping textures, urban
- c) Landscape photography: cinematic scale, one small human figure, vast frame
- d) Documentary photography: close-up of hands working, tools, material, process

**S4-Q09 — Old vs new** (4 reference images)
- a) A real or realistic 1970s album cover — warm colours, illustration, hand-lettering
- b) A brutalist web interface screenshot — monospace, minimal, raw function
- c) A hand-bound artist's book — stitching visible, printed, one-of-a-kind
- d) A motion graphic still or GIF — fluid, generative, never still

**S4-Q14 — Creative influence** (4 archetype portraits — NOT real named people)
- a) Master craftsperson: older hands, workshop, decades of tools, warm light
- b) Provocateur: stark, confrontational framing, direct eye contact, sharp
- c) Quiet obsessive: profile view, focused, surrounded by work, dim room
- d) Genre-breaker: mixed media, collage-adjacent, defies single categorisation

### Supplement visual questions

**SUP-Q04 — Brand colour temperature** (4 swatch strips)
- a) Cool and precise: slate #6B7B8D, white #FAFAFA, ice blue #B3D4E6, silver #C0C0C0
- b) Warm and grounded: clay #B8926A, cream #F5F0E1, olive #7A8B5C, aged wood #8B6F4E
- c) Bold and saturated: deep charcoal #2A2A2A, electric teal #00B8A9, deep navy #1B2A4A
- d) Muted and quiet: soft lavender #C5B8D4, pale sage #B8C9B0, warm fog #D4CFC7

**SUP-Q11 — Brand photography direction** (same base photograph processed 4 ways, same approach as S1-Q16)
- a) Clean and controlled: bright, sharp, every element placed
- b) Warm and candid: natural light, soft focus, real moments
- c) Dramatic and cinematic: strong directional light, deep shadow, theatrical
- d) Raw and textured: grain, imperfection, visible process
