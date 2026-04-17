# Supplement — Brand Override Bank

**Purpose:** Surface where the brand intentionally diverges from the founder's personal wiring. These questions fire *only* in the `founder_supplement` track (alignment gate option B: "It's me — but the brand needs to work without me").
**Spec ref:** `docs/specs/brand-dna-assessment.md` §4.1, §14.
**Tag convention:** Every tag in this section is prefixed `brand_override.<domain>.<tag>`. When a brand_override tag conflicts with the founder's personal tag, the override wins for brand-facing outputs; the personal tag is retained for founder-facing insights.

---

## Section metadata

**Title:** Where the Brand Splits From You
**Subtitle:** The version of this that isn't you.
**Question count:** 15
**Trigger:** Appears after Section 5 for founder_supplement track only.
**Visual questions:** 2 (Q4, Q11)

---

## Preamble copy (shown before Q1)

> You've told us who you are. Now tell us who the brand is — specifically where it's *not* you. Some of these will feel like the same answer. That's fine. We're listening for the differences.

---

## Questions

### SUP-Q01 — Brand personality vs yours

> If your brand walked into a room without you, how would it carry itself differently?

a) More polished. You're rough around the edges — the brand can't be.
   → `brand_override.communication.formality`, `brand_override.aesthetic.geometric_precision`

b) Warmer. You hold back — the brand should reach out.
   → `brand_override.communication.warmth_in_voice`, `brand_override.communication.extraversion`

c) Quieter. You're the energy — the brand should be the substance.
   → `brand_override.communication.introversion`, `brand_override.communication.brevity`

d) No differently. The brand IS the way I carry myself.
   → *(no override tags — confirms alignment)*

---

### SUP-Q02 — Brand tone vs your tone

> Your natural tone and the brand's ideal tone — are they the same?

a) Close. The brand is a slightly more composed version of me.
   → `brand_override.communication.tonal_awareness`, `brand_override.communication.formality`

b) Not really. I'm direct and informal — the brand needs more polish.
   → `brand_override.communication.formality`, `brand_override.aesthetic.minimalism`

c) I'm warmer in person than the brand should be on paper. The brand should have more edge.
   → `brand_override.communication.directness`, `brand_override.communication.confrontation_comfort`

d) They're identical. The brand sounds like me because it should.
   → *(no override tags — confirms alignment)*

---

### SUP-Q03 — Brand visual taste vs yours

> Your personal visual taste and what the brand needs to look like — same thing?

a) My taste is warmer and more textured. The brand needs to be cleaner.
   → `brand_override.aesthetic.minimalism`, `brand_override.aesthetic.geometric_precision`

b) My taste is minimal. The brand needs more warmth and humanity than I'd naturally choose.
   → `brand_override.aesthetic.warmth`, `brand_override.aesthetic.organic_forms`

c) My taste is bolder than what the brand should project. The brand needs restraint I don't have.
   → `brand_override.aesthetic.muted_palette`, `brand_override.creative.admires_restraint`

d) Same thing. My taste IS the brand's visual identity.
   → *(no override tags — confirms alignment)*

---

### SUP-Q04 — Brand colour temperature 🎨

> Your brand needs to live in one of these colour worlds. Which one — even if it's not what you'd pick for yourself?

a) 🎨 *Cool and precise — slate, white, ice blue, silver.*
   → `brand_override.aesthetic.minimalism`, `brand_override.aesthetic.geometric_precision`, `brand_override.aesthetic.high_contrast`

b) 🎨 *Warm and grounded — clay, cream, olive, aged wood.*
   → `brand_override.aesthetic.warmth`, `brand_override.aesthetic.organic_forms`, `brand_override.aesthetic.analogue_texture`

c) 🎨 *Bold and saturated — deep tones with one electric accent.*
   → `brand_override.aesthetic.high_contrast`, `brand_override.aesthetic.maximalism`

d) 🎨 *Muted and quiet — soft tones, low contrast, nothing shouts.*
   → `brand_override.aesthetic.muted_palette`, `brand_override.creative.admires_restraint`

**Visual:** Four colour swatch strips — no labels.

---

### SUP-Q05 — Brand risk appetite

> You know your own appetite for risk. What about the brand's?

a) The brand should take fewer risks than I do. I can recover from a bad call — the brand can't.
   → `brand_override.values.risk_caution`, `brand_override.values.prudence`

b) The brand should take more risks than I naturally would. Playing it safe is how brands die.
   → `brand_override.values.risk_appetite`, `brand_override.creative.admires_boldness`

c) Same appetite. The brand's risk tolerance IS my risk tolerance.
   → *(no override tags — confirms alignment)*

d) The brand should be strategic about risk. Bold where it counts, cautious everywhere else.
   → `brand_override.values.pragmatism`, `brand_override.values.head_first`

---

### SUP-Q06 — Brand conflict style

> A customer is publicly unhappy with the brand. What should the brand's instinct be — even if yours would be different?

a) Acknowledge it fast. The brand doesn't have the luxury of sitting with it.
   → `brand_override.communication.directness`, `brand_override.communication.confrontation_comfort`

b) Respond warmly. Even if I'd be defensive, the brand needs to lead with empathy.
   → `brand_override.communication.warmth_in_voice`, `brand_override.communication.agreeableness`

c) Say less. The brand should be measured where I might be reactive.
   → `brand_override.communication.brevity`, `brand_override.values.patience`

d) Handle it the way I'd handle it. My instinct IS the brand's instinct.
   → *(no override tags — confirms alignment)*

---

### SUP-Q07 — Brand vulnerability

> How much of the messy, uncertain, human stuff should the brand show?

a) Less than I show. The brand needs to project confidence I don't always feel.
   → `brand_override.aspiration.quiet_confidence`, `brand_override.communication.formality`

b) More than I show. I hold back — the brand should be braver about being real.
   → `brand_override.communication.selective_vulnerability`, `brand_override.values.authenticity`

c) About the same. The brand's relationship with vulnerability mirrors mine.
   → *(no override tags — confirms alignment)*

d) Strategically. Show enough to be human, never enough to look uncertain.
   → `brand_override.communication.tonal_awareness`, `brand_override.communication.selective_vulnerability`

---

### SUP-Q08 — Brand ambition vs yours

> Your personal ambition and the brand's ambition — do they match?

a) I'm more ambitious than the brand needs to be. I push — the brand should feel settled.
   → `brand_override.aspiration.quiet_confidence`, `brand_override.values.patience`

b) The brand should project more ambition than I feel. The market expects it.
   → `brand_override.values.ambition`, `brand_override.aspiration.achievement_orientation`

c) Same drive. The brand's ambition is mine.
   → *(no override tags — confirms alignment)*

d) I want the brand to feel purposeful, not ambitious. Drive without hustle.
   → `brand_override.aspiration.legacy_drive`, `brand_override.values.authenticity`

---

### SUP-Q09 — Brand community stance

> You personally — are you a community person? Now: should the brand be?

a) I'm not, but the brand should be. Community builds something I can't build alone.
   → `brand_override.aspiration.community_building`, `brand_override.aspiration.affiliation`

b) I am, but the brand shouldn't lean on it. The work should stand alone.
   → `brand_override.aspiration.quiet_confidence`, `brand_override.values.independence`

c) We're aligned. The brand's community stance matches mine.
   → *(no override tags — confirms alignment)*

d) The brand should be selective. Not a community — a club.
   → `brand_override.creative.curation_instinct`, `brand_override.aspiration.premium_positioning`

---

### SUP-Q10 — Brand authority vs approachability

> You — the person — lean more toward authority or approachability. What about the brand?

a) I'm approachable. The brand needs more authority than I naturally project.
   → `brand_override.aspiration.thought_leadership`, `brand_override.aspiration.premium_positioning`

b) I'm authoritative. The brand needs to be warmer than I am.
   → `brand_override.communication.warmth_in_voice`, `brand_override.aspiration.affiliation`

c) Same balance. The brand sits where I sit.
   → *(no override tags — confirms alignment)*

d) The brand should be neither. It should be trusted — that's a different thing.
   → `brand_override.values.authenticity`, `brand_override.aspiration.quiet_confidence`

---

### SUP-Q11 — Brand photography direction 🎨

> For the brand's photography — not what you personally love, but what the brand needs:

a) 🎨 *Clean and controlled. Every element placed.*
   → `brand_override.aesthetic.minimalism`, `brand_override.aesthetic.geometric_precision`

b) 🎨 *Warm and candid. Real moments, not staged ones.*
   → `brand_override.aesthetic.warmth`, `brand_override.aesthetic.organic_forms`

c) 🎨 *Dramatic and cinematic. Strong light, strong shadow.*
   → `brand_override.aesthetic.cinematic_eye`, `brand_override.aesthetic.high_contrast`

d) 🎨 *Raw and textured. Imperfection is the point.*
   → `brand_override.aesthetic.tactile_craft`, `brand_override.creative.anti_polish`

**Visual:** Same photograph processed four ways (mirrors S1-Q16 but asks for the brand, not the person).

---

### SUP-Q12 — Brand creative process

> Your creative process is yours. What should the brand's be?

a) More structured than mine. I can improvise — the brand needs systems.
   → `brand_override.values.conscientiousness`, `brand_override.values.head_first`

b) Looser than mine. I over-plan — the brand should feel more spontaneous.
   → `brand_override.creative.improviser`, `brand_override.values.gut_first`

c) Same process. My way of working IS the brand's way.
   → *(no override tags — confirms alignment)*

d) More collaborative. I work alone — the brand should feel like it has a team behind it.
   → `brand_override.aspiration.affiliation`, `brand_override.communication.extraversion`

---

### SUP-Q13 — Brand relationship to trends

> You have your own relationship to trends. What should the brand's be?

a) The brand should be more current than I am. I ignore trends — the brand can't afford to.
   → `brand_override.creative.innovation_pull`, `brand_override.values.openness`

b) The brand should be more timeless than I am. I get pulled by new things — the brand shouldn't.
   → `brand_override.creative.rejects_trend`, `brand_override.creative.admires_craft`

c) Same relationship. The brand and I respond to trends the same way.
   → *(no override tags — confirms alignment)*

d) The brand should acknowledge trends without following them. Aware, not reactive.
   → `brand_override.values.pragmatism`, `brand_override.creative.curation_instinct`

---

### SUP-Q14 — Brand pricing confidence

> Your personal comfort with pricing and the brand's positioning — aligned?

a) I undercharge. The brand should project more premium confidence than I feel.
   → `brand_override.aspiration.premium_positioning`, `brand_override.aspiration.quiet_confidence`

b) I'm comfortable with premium. But the brand should feel more accessible than I'd naturally set.
   → `brand_override.communication.warmth_in_voice`, `brand_override.values.agreeableness`

c) Aligned. My pricing instinct is the brand's pricing instinct.
   → *(no override tags — confirms alignment)*

d) The brand should avoid the pricing conversation entirely. Compete on something else.
   → `brand_override.aspiration.category_creation`, `brand_override.values.independence`

---

### SUP-Q15 — The brand without you

> Last one. If you stepped away tomorrow, what's the one thing the brand must keep — the thing that's you but also bigger than you?

a) The standard. Never let the quality drop, no matter who's doing the work.
   → `brand_override.creative.admires_craft`, `brand_override.values.perfectionism`

b) The honesty. Don't start saying what people want to hear.
   → `brand_override.values.authenticity`, `brand_override.values.transparency`

c) The feeling. There's something about this brand that people feel. Don't lose that.
   → `brand_override.creative.emotional_resonance`, `brand_override.aesthetic.warmth`

d) The independence. Don't start following. Keep making the path.
   → `brand_override.values.independence`, `brand_override.values.conviction`

**Notes:** The closing question. Surfaces the founder's non-negotiable for the brand's identity independent of them.

---

## Override coverage

| Domain | Override tags surfaced | Count |
|---|---|---|
| aesthetic (12) | minimalism, geometric_precision, warmth, organic_forms, muted_palette, high_contrast, maximalism, analogue_texture, cinematic_eye, tactile_craft | 10/12 |
| communication (16) | formality, warmth_in_voice, directness, brevity, tonal_awareness, confrontation_comfort, selective_vulnerability, introversion, extraversion, agreeableness | 10/16 |
| values (21) | risk_caution, risk_appetite, prudence, pragmatism, head_first, patience, authenticity, ambition, independence, conscientiousness, gut_first, openness, perfectionism, transparency, conviction, agreeableness | 16/21 |
| creative (13) | admires_restraint, admires_boldness, admires_craft, anti_polish, improviser, innovation_pull, rejects_trend, emotional_resonance, curation_instinct | 9/13 |
| aspiration (15) | quiet_confidence, premium_positioning, community_building, affiliation, thought_leadership, achievement_orientation, legacy_drive, category_creation | 8/15 |

**Total unique override tags surfaced:** ~53 of 79. The "confirms alignment" options (d in most questions) produce no overrides — the absence is the data point.

---

## Design notes

1. **Every question offers a "same as me" option.** This is critical — the supplement should not force divergence where none exists. A founder who picks "same" on 12 of 15 questions has told us something valuable: the brand IS the founder.
2. **Questions mirror core bank angles.** SUP-Q04 mirrors S1-Q04, SUP-Q11 mirrors S1-Q16 — same visual stimuli, different framing. The delta between personal pick and brand pick is the override signal.
3. **No section structure.** The supplement is a single run of 15 questions, not split into sub-sections. It comes after the main 5 sections and before the reflection prompt.
4. **Override weight.** A brand_override tag is not a replacement — it's a layer. The Opus prompt builders should read both the founder's personal tag and the override tag, and use the tension between them as a characterisation insight ("You're naturally reserved, but you want the brand to reach out").
