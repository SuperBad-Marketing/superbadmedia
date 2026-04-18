# Content Engine — Demo Landing Page Copy

**Surface:** `/get-started/content-engine` (public). **Spec:** `docs/specs/content-engine.md` §3.4, §10, §16. **Author:** Claude (CMS-3). Voice: dry, convention-breaking. The demo page IS the product demo — the copy should feel like discovering something, not being sold something.

---

## Page metadata

- **Title:** `Content Engine Demo — SuperBad`
- **Description:** `A keyword-researched blog post outline for your vertical. No email, no signup, no catch.`
- **OG title:** `SuperBad Content Engine — free demo`
- **OG description:** `Pick your vertical. We'll research your competitors, find the gaps, write an outline, and show you an excerpt. No email gate.`

---

## Hero section

- **Eyebrow:** `Content Engine`
- **Headline:** `See what we'd write about your business.`
- **Supporting line:** `Pick your vertical and whether you're tied to a location. We'll do the keyword research, find what your competitors missed, and write a sample — right now, in front of you.`

---

## Demo input

- **Vertical selector label:** `What do you do?`
- **Vertical selector placeholder:** `Select your vertical`
- **Location toggle label:** `Are you location-locked?`
- **Location toggle hint:** `If your clients come from a specific area, we'll research that geography. If not, we go broad.`
- **Location input label (when toggled on):** `Where?`
- **Location input placeholder:** `e.g. Melbourne, Inner East`
- **Run demo button:** `Show me`
- **Run demo button (processing):** `Researching…`

---

## Convention-break callout

Renders immediately above or after the demo result. The defining copy of the page.

> This is usually where we'd ask for your email before showing you anything. We'd rather just show you.

Single line. Warm Cream on Dark Charcoal. Playfair Display italic. No link, no CTA. The line earns the trust that the tier cards below need.

---

## Demo result section

### Result header

- **Eyebrow:** `Here's what we found`
- **Keyword line:** `Target keyword: "{keyword}" — rankability score: {score}/100`
- **Content gap summary heading:** `What's missing from the top results`

### Outline preview

- **Heading:** `Draft outline`
- **Section list:** rendered from the Haiku-generated outline (same format as the real topic queue)
- **Word count line:** `~{wordCount} words`
- **Snippet flag (if applicable):** `Featured snippet opportunity detected.`

### Excerpt preview

- **Heading:** `Opening excerpt`
- **Subhead:** `Written in SuperBad's voice. Imagine this in yours.`
- **Excerpt body:** Opus-generated 200–300 word excerpt from the outline, in SuperBad's Brand DNA voice.

---

## Automation pitch

Renders below the demo result. The bridge from "look at this" to "imagine this running automatically."

- **Headline:** `Now imagine this running while you sleep.`
- **Body:** `The Content Engine researches keywords, writes full posts, generates newsletters and social content, publishes to your blog, and sends to your list — all in your voice, because it reads your Brand DNA. What you just saw was one post. Imagine {tierLimit} a month.`
- **Fine print:** `The demo used SuperBad's voice. Once you complete Brand DNA, everything sounds like you.`

---

## Tier cards section

- **Section heading:** `Pick your pace.`
- **Section subhead:** `All plans include keyword research, blog publishing, newsletter sends, and social drafts. The difference is volume.`

Tier cards render from `saas_tiers` data for the Content Engine product. Same card structure as the pricing page (rank eyebrow, name, price, dimensions, features, CTA).

- **CTA on each card:** `Get started`
- **Below cards:** `All prices include GST. Annual waives the setup fee.`

---

## Result persistence note

Small text below the tier cards, visible only after the demo has run.

- **Text:** `Your demo result transfers to your account on signup. The keyword research you just ran becomes real data — not a throwaway.`

---

## Footer

Same structure as pricing page: GST footnote, questions line with andy@superbadmedia.com.au, privacy/terms links, copyright.
