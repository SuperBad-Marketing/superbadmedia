# Intro Funnel — Signal Tag Mapping

**Spec reference:** `docs/specs/intro-funnel.md` §9.3
**Taxonomy source:** `docs/content/brand-dna/signal-tags.md` (79 tags, 5 domains)
**Purpose:** Maps each Intro Funnel questionnaire answer to 1–3 signal tags from the shared Brand DNA taxonomy. Haiku extracts these after each section completes.

The Intro Funnel questionnaire is lighter than Brand DNA — it captures business-context and ambition signals, not deep psychological profiling. Most tags awarded here land in the `aspiration`, `values`, and `communication` domains. Aesthetic and creative domain tags are rare (those are Brand DNA's territory).

---

## Extraction approach

The Haiku-tier signal-tag extraction call (`lib/intro-funnel/prompts/signal-tag-extraction.ts`) reads:
1. The raw answers for the just-completed section
2. The prospect's shape
3. The full tag taxonomy (79 tags with descriptions)
4. Any tags already awarded from prior sections

It returns `{ tags: string[], reasoning: string }` where reasoning is internal-only (for audit, never shown to prospect).

The mappings below are **guidance for the prompt, not hard rules**. The prompt instructs Haiku to use these as the primary mapping but allows soft-override when the combination of answers across a section tells a different story than any single answer would.

---

## Section 2 — Business Context (representative mappings)

| Answer pattern | Primary tags |
|---|---|
| Long tenure (5+ years) | `patience`, `resilience` |
| Short tenure (< 1 year) | `risk_appetite`, `proving_ground` |
| "Word of mouth mostly" | `quiet_confidence`, `loyalty` |
| "I'm not sure" (any discovery Q) | `pragmatism` (they're here despite not knowing) |
| At capacity / selective | `premium_positioning`, `control_need` |
| "Marketing eats into everything" | `conscientiousness`, `independence` |
| "Doesn't feel like me" (online presence) | `authenticity`, `taste_as_identity` |

## Section 3 — Photography & Content (representative mappings)

| Answer pattern | Primary tags |
|---|---|
| "Phone photos, whatever I can grab" | `pragmatism` |
| "I've been burned by photographers/agencies" | `thick_skin`, `independence` |
| "Absolutely not" (on camera) | `introversion` |
| "I'm good, just need someone to point the camera" | `quiet_confidence`, `extraversion` |
| "What I've got doesn't look like me" | `authenticity`, `taste_as_identity` |
| "It looks fine but doesn't do anything" | `achievement_orientation`, `pragmatism` |
| Admires specific brands (free text) | Haiku infers from the named reference |

## Section 4 — Ambitions (representative mappings)

| Answer pattern | Primary tags |
|---|---|
| "Steady flow of the right customers" | `premium_positioning`, `patience` |
| "Stop worrying about where the next job comes from" | `resilience`, `proving_ground` |
| "Charge what I'm worth" | `quiet_confidence`, `conviction` |
| "Someone who just does it" | `control_need` (inverse — letting go) |
| "Show me what to do, I'll run it" | `independence`, `pragmatism` |
| "I've been burned before" | `risk_caution`, `independence` |
| "I want to build something that lasts" | `legacy_drive`, `patience` |
| "Be the obvious choice in our space" | `category_creation`, `ambition` |

## Practical supplement (Q6–Q7, all shapes)

| Answer pattern | Tags | Notes |
|---|---|---|
| No email list | `practical_signal:no_email_list` | Prefixed — practical, not psychological |
| Has email list, doesn't use it | `practical_signal:dormant_email_list` | |
| Never run ads | `practical_signal:no_ad_experience` | |
| Tried ads, didn't stick | `practical_signal:lapsed_ad_experience` | |
| Running ads now | `practical_signal:active_ads` | |

*Practical-signal tags use a `practical_signal:` prefix to distinguish them from psychological tags. They feed the Six-Week Plan Generator's infrastructure awareness but do NOT enter the Brand DNA profile. The Haiku extraction prompt is instructed to emit these as a separate `practical_tags` array.*

---

## Tag frequency expectations

A completed Intro Funnel questionnaire (all 4 sections, ~18–20 answered questions) typically produces:
- 8–15 distinct tags (vs Brand DNA's 30–50 from 50+ questions)
- Strongest signal density in `values` and `aspiration` domains
- Sparse coverage in `aesthetic` and `creative` domains (those require Brand DNA's visual questions)
- 2–5 practical-signal tags

The retainer-fit recommendation prompt reads these alongside Brand DNA tags (if available) to make its assessment. Low tag count from Intro Funnel alone is expected and doesn't reduce recommendation confidence — the enrichment profile and reflection answers provide complementary signal.
