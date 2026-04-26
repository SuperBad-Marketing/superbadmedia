# SuperBad BlackBox — Landing Pages Spec

**Brainstorm output. Locked 2026-04-22.**

Five landing pages for the BlackBox product line: one main BlackBox page and four standalone product pages. Every page is demo-first — the visitor experiences the product before they see a price. The pages don't describe what BlackBox does; they do it, live, for the visitor's own business.

---

## 1. Page inventory

| Page | URL | Product | Demo scope |
|------|-----|---------|------------|
| BlackBox | `/blackbox` | Full BlackBox (3 tiers) | Full audit + content preview + mock homepage |
| Outreach | `/outreach` | Automated Outreach ($497/mo) | Qualified prospects + sample outreach email |
| Content Engine | `/content-engine` | Content Engine ($397/mo) | Keyword analysis + blog post + social posts |
| Living Website | `/living-website` | Living Website ($247/mo) | Mock homepage rendered with their brand |
| Review Responses | `/review-responses` | Review Responses ($97/mo) | Actual reviews with AI-drafted responses |

---

## 2. The BlackBox landing page (`/blackbox`)

### 2.1 Core principle

The landing page IS the demo. The page doesn't try to convince you first — it hands you the input and says "enter your business." The experience itself is the pitch.

### 2.2 Page flow

#### Hero

Headline that names the pain. One line. Demo input sits right in the hero — no scrolling required to start.

**Demo inputs:**

| Path | When | Fields |
|------|------|--------|
| Has a website | Default | Website URL + industry (dropdown or free text) |
| No website | Toggle or fallback | Business name + industry + location |

The no-website path exists because many of the businesses who need BlackBox most are exactly the ones without a website.

#### Demo generation (30–60 seconds)

The progress screen is the first selling moment. Two phases:

**Phase 1 — Live narration.** As the platform scrapes and analyses, findings stream onto the page in real time. Each finding is a micro-hook:

- "Found your Instagram — last post was 43 days ago."
- "Your homepage loads in 3.8 seconds on mobile."
- "Identified 6 unanswered Google reviews."
- "Your top competitor posted 12 times this week."

Early findings (website scrape, social check, reviews) are fast and keep the visitor engaged.

**Phase 2 — Page builds itself.** As heavier generation completes (blog post, social posts, mock homepage), those elements start appearing on the page. The narration becomes the page. Audit scores animate in. The mock homepage renders. Social posts fade in. By the time it's done, the visitor has been engaged the entire time and is already looking at their results.

The whole experience should feel like watching someone brilliant work on your problem in real time.

#### The demo results

Once generation completes, the visitor is looking at a page that's no longer a landing page — it's a preview of their BlackBox. The page has transformed around their business:

**Audit section — five areas scored:**

| Audit area | What we check | Source |
|------------|---------------|--------|
| Website health | Load speed, mobile-friendliness, SSL, basic SEO | URL scrape + PageSpeed API |
| Social presence | Last post date, posting frequency, follower count, engagement | Social profile scrape |
| Review reputation | Average rating, total reviews, unanswered reviews, sentiment | Google/Facebook reviews |
| Search visibility | Ranking for obvious keywords in industry + location | SerpAPI |
| Content freshness | Blog exists? Last updated? Frequency? | URL scrape |

Each area gets a status: healthy / needs work / critical. No arbitrary scores out of 100.

For the no-website path, website health becomes "You don't have a website — here's what you're missing" — arguably more powerful than a bad score.

**Content preview section:**

- One full blog post — keyword-targeted, written in a generated brand voice derived from their existing online presence.
- Three social post variations — repurposed from the blog, formatted for feed, stories, and LinkedIn.
- Mock website homepage — their business name, inferred brand colours, real content, rendered as a living website preview.

**The reveal:** "We just did more for your marketing in 60 seconds than your last agency did in a month."

#### Pricing

Three tier cards, Growth highlighted as the recommended tier. Popcorn layout. Standard commitment toggle per `saas-subscription-billing.md`.

Below the tiers: "Only need one piece?" section with the four standalone products listed with prices. Links to their respective pages.

One job: make the decision easy, not clever.

#### For scrollers who skip the demo

Below the fold, a condensed version of the pitch for visitors who scroll past the hero without trying the demo:

- The spiral — the five problems reinforcing each other. "Sound familiar?"
- What BlackBox does — brief, visual, show don't list.
- Demo CTA repeat — catch them here.
- Pricing (same section as above).
- FAQ — objection handling.
- Final CTA.

This content is secondary. The page is designed demo-first.

### 2.3 Conversion path

1. **Demo** — visitor enters their business, sees the audit + content preview + mock homepage.
2. **Account creation** — "Save your results and turn BlackBox on." Demo output persists to their account.
3. **Payment** — tier selection and checkout per `saas-subscription-billing.md`.

---

## 3. Standalone product pages

### 3.1 Core principle

Same demo-first pattern as BlackBox, scoped to each product's problem. Every page lets the visitor experience the product before seeing a price.

### 3.2 Demo inputs

Same two-path input as BlackBox: website URL + industry (default) or business name + industry + location (no-website fallback).

### 3.3 Per-page demo scope

**Outreach (`/outreach`):**
- Sample of qualified prospects the platform found for their market.
- ICP scoring breakdown — why each prospect was selected.
- Preview of a personalised outreach email the platform would send on their behalf.

**Content Engine (`/content-engine`):**
- Keyword analysis for their industry + location.
- One full blog post targeting a high-value keyword.
- Social posts repurposed from the blog in multiple formats.

**Living Website (`/living-website`):**
- Mock homepage rendered with their inferred brand (colours, name, voice, real content).
- If they have an existing website, a before/after comparison.

**Review Responses (`/review-responses`):**
- Their actual Google/Facebook reviews displayed.
- AI-drafted brand-voice responses alongside each review.
- Sentiment summary.

### 3.4 Progressive BlackBox reveal

Every standalone page runs the full BlackBox demo behind the scenes, but shows only the relevant standalone results first.

After the standalone results: "We also looked at the rest of your marketing. Want to see?" One click expands the full audit and content preview. The visitor opted in to seeing more — it doesn't feel pushed.

If they click, they're now looking at a full BlackBox demo they didn't plan on seeing, and the upgrade math does itself. If they don't click, they still had a great standalone experience.

### 3.5 Pricing on standalone pages

The standalone product's price card, followed by one targeted BlackBox comparison — the single most relevant BlackBox tier, not all three:

| Standalone page | BlackBox tier shown |
|-----------------|---------------------|
| Outreach ($497) | Growth ($597) — "Add a living website, content engine, review responses, and SEO for $100 more" |
| Content Engine ($397) | Growth ($597) — "Add outreach, lead follow-up, a living website, and review responses for $200 more" |
| Living Website ($247) | Entry ($197) — "Get the living website plus blog content, social posts, review responses, and SEO for less" |
| Review Responses ($97) | Entry ($197) — "Add a living website, blog content, social posts, and SEO for $100 more" |

One card, one comparison, one "you could have all of this" moment.

Note: Living Website and Review Responses standalone prices are higher than or close to BlackBox Entry, which includes both. This is intentional — it makes Entry an obvious upgrade from either standalone, and the popcorn effect pulls them further into Growth.

### 3.6 Conversion path

Same as BlackBox: demo → account creation (results persist) → payment.

If a visitor has already run a demo on another page, their account already has those results. Multiple demo runs across pages compound into a richer pre-populated account.

---

## 4. Shared demo infrastructure

All five pages share the same underlying demo engine:

- **One scrape, one analysis** — the platform runs the full audit regardless of which page the visitor entered from. Results are cached per business URL/name.
- **Scoped display** — each page filters and displays the relevant subset of the full analysis.
- **Progressive reveal** — standalone pages show their scope first, full results on opt-in.
- **Account persistence** — all demo results persist to the visitor's account on signup. Multiple demo runs (across pages or repeat visits) accumulate.
- **No email gate** — demos are fully open per `saas-subscription-billing.md` §Q12.

---

## 5. Relationship to existing specs

| Spec | Relationship |
|------|-------------|
| `blackbox.md` | Product definition, tiers, pricing, features. Landing pages sell this product. |
| `saas-subscription-billing.md` | Checkout flow, commitment toggle, account creation before payment, no-email-gate demo policy. |
| `content-engine.md` | Powers the blog + social content preview in demos. Content Engine standalone page sells this as an independent product. |
| `lead-generation.md` | Powers the outreach demo (prospect sourcing, ICP scoring, email generation). Outreach standalone page sells this as an independent product. |
| `brand-dna-assessment.md` | Onboarding runs Brand DNA after signup. Demo infers a preliminary brand voice from scraping. |
| `intro-funnel.md` | BlackBox landing pages are a separate acquisition path from the retainer intro funnel. Visitors may arrive from either. |
