---
spec: docs/specs/content-engine.md
status: calibrated
populated-by: CMS-3 Content Engine content mini-session (2026-04-18)
---

# Content Engine prompts (10)

All prompts reference `docs/content/content-engine/` for voice calibration. All Opus prompts read the full Brand DNA profile as system context. All Haiku prompts read Brand DNA signal tags only. Both layers follow the tiered injection pattern locked in `docs/specs/brand-dna-assessment.md`.

All externally-destined output passes `checkBrandVoiceDrift()` (§11.5) before entering the review queue or send pipeline.

---

## `content-score-keyword-rankability`

**Tier:** Haiku. **Registry key:** `content-score-keyword-rankability`. **Intent:** domain-authority heuristic scoring + content-gap identification from scraped top-3 SERP results.

### System prompt

```
You are a keyword research analyst. Given a target keyword, SERP data (top 10 results with titles, URLs, snippets), and scraped content from the top 3 results, produce a rankability assessment.
```

### Input

```ts
{
  keyword: string
  serpResults: Array<{ position: number, title: string, url: string, snippet: string }>
  scrapedContent: Array<{ url: string, headings: string[], wordCount: number, topics: string[] }>
  highAuthorityDomains: string[]  // static list from /data/high-authority-domains.json
  ownerVertical: string
  ownerLocation: string | null
}
```

### Output (structured JSON)

```ts
{
  rankabilityScore: number        // 0–100. Higher = more rankable.
  authorityAssessment: string     // one sentence: how many high-authority domains dominate this SERP
  contentGaps: Array<{
    angle: string                 // underserved angle in 1 sentence
    evidence: string              // what the top results miss or under-cover
    snippetOpportunity: boolean   // true if this angle could target a featured snippet
  }>
  recommendation: 'pursue' | 'consider' | 'skip'
  reasoning: string               // 2–3 sentences justifying the score
}
```

### Scoring rubric (calibration)

- **80–100:** No high-authority domains in top 5. Clear content gaps. Low word-count competition. Local intent matches owner's location.
- **60–79:** 1–2 high-authority domains but thin content. Gaps exist. Moderate word-count competition.
- **40–59:** Mixed. Some high-authority presence. Gaps exist but competition is decent.
- **20–39:** Heavy high-authority presence. Limited gaps. High word-count competition.
- **0–19:** Dominated by Wikipedia, .gov, major brands. No realistic path to page 1.

### Brand DNA injection

Tags only. Used to weight vertical-relevance scoring — a keyword in the owner's vertical scores higher than an adjacent one.

---

## `content-generate-topic-outline`

**Tier:** Haiku. **Registry key:** `content-generate-topic-outline`. **Intent:** structured outline from keyword + content gaps + Brand DNA tags.

### System prompt

```
You are a content strategist. Given a keyword, its content gaps, and the brand's signal tags, produce a structured blog post outline. The outline must address the identified gaps and be written from the brand's perspective.
```

### Input

```ts
{
  keyword: string
  contentGaps: Array<{ angle: string, evidence: string, snippetOpportunity: boolean }>
  brandDnaTags: Record<string, number>   // domain → tag → weight
  vertical: string
  location: string | null
  existingPostSlugs: string[]             // to suggest internal links
}
```

### Output (structured JSON)

```ts
{
  title: string
  slug: string                             // URL-safe, lowercase, hyphenated
  sections: Array<{
    heading: string
    keyPoints: string[]                    // 2–4 per section
    targetWordCount: number
    snippetTarget: boolean                 // true if this section targets a featured snippet
  }>
  totalWordCount: number                   // sum of section targets
  internalLinkSuggestions: string[]         // slugs from existingPostSlugs that are topically related
  metaDescriptionDraft: string             // ≤160 chars
  aiSearchNote: string                     // reminder to lead with direct answer per spec §2.1 Stage 3
}
```

### Calibration

- 4–7 sections typical. Fewer for focused topics, more for comprehensive guides.
- Total word count: 1,200–2,500 words. Not padding — each section earns its place.
- Internal link suggestions: max 3. Only if genuinely related.
- The `aiSearchNote` is a passthrough to the blog generation prompt: "Lead each section with a direct factual answer before expanding."

### Brand DNA injection

Tags only. Influences topic angle (a `directness`-heavy brand gets straight-to-point outlines; a `storytelling`-heavy brand gets narrative-structured outlines), section ordering (data-first vs story-first), and tone hints passed to the generation prompt.

---

## `content-generate-blog-post`

**Tier:** Opus. **Registry key:** `content-generate-blog-post`. **Intent:** full blog post from outline + Brand DNA full profile + SERP data + content gaps.

### System prompt

```
You are a blog writer for {businessName}. You write in their voice — not a generic professional voice, not your own voice, THEIR voice. You have their full Brand DNA profile. Every word choice, every sentence structure, every piece of punctuation should feel like them.

Your job is to write a complete, publishable blog post that:
1. Addresses the content gaps the research identified
2. Leads each section with a direct factual answer before expanding (for AI search citation)
3. Sounds like the brand, not like "AI content"
4. Is genuinely useful to the reader — not keyword-stuffed, not thin, not padded
5. Includes natural internal linking opportunities

The post will be reviewed by the brand owner. If it doesn't sound like them, it gets rejected.
```

### Input

```ts
{
  outline: TopicOutline                    // from content-generate-topic-outline
  brandDnaProfile: FullBrandDnaProfile     // full profile: tags, portrait, first impression, reflections
  serpData: SerpSnapshot                   // top 10 results at research time
  contentGaps: ContentGap[]               // gaps being addressed
  existingPosts: Array<{ slug: string, title: string }>  // for internal linking
  ownerVertical: string
  ownerLocation: string | null
}
```

### Output (structured JSON)

```ts
{
  title: string
  body: string                             // markdown, full post
  metaDescription: string                  // ≤160 chars
  slug: string
  structuredData: object                   // JSON-LD Article schema
  internalLinks: Array<{ slug: string, anchorText: string, context: string }>
  snippetTargetSection: string | null      // the section heading that targets a featured snippet
  suggestedOgLine: string | null           // dry one-liner for OG image (SuperBad's own posts only)
}
```

### Voice calibration

The prompt reads the full Brand DNA profile, including:
- **Signal tags with weights:** these shape vocabulary choice, sentence length, tone
- **Prose portrait:** this is the voice reference document — if the portrait says "speaks in short declaratives with dry asides," the post should read that way
- **Aesthetic tags:** influence metaphor choice (a `cinematic_eye` brand gets visual descriptions; a `data_driven_persuasion` brand gets statistics-forward structure)

**Anti-patterns to explicitly instruct against:**
- "In today's fast-paced digital landscape…" — banned opening structure
- Rhetorical questions as transitions — only if the brand has `storytelling` or `warmth_in_voice` tags
- Excessive hedging ("it's important to note that…") — trim unless `diplomacy` tag is strong
- Lists of three adjectives — one is enough
- "In conclusion" — just end

### Drift check

Output passes `checkBrandVoiceDrift()` before entering review queue. Below-threshold drafts are auto-regenerated once with the addition of `"The previous draft didn't match the brand voice closely enough. Pay closer attention to: {driftNotes}"` in the prompt. Second failure surfaces a "voice drift flagged" warning.

---

## `content-rewrite-for-newsletter`

**Tier:** Haiku. **Registry key:** `content-rewrite-for-newsletter`. **Intent:** blog → newsletter format (standalone or digest, based on post count).

### System prompt (standalone variant)

```
Rewrite this blog post for email. Make it conversational, scannable, and shorter. The reader should get the key value from the email and click through to read the full post only if they want depth. Keep the brand's voice.
```

### System prompt (digest variant)

```
Write a brief editorial introduction tying these {postCount} posts together. Not a summary of each — a 2-3 sentence editorial thread that makes this collection feel intentional. Then write a headline + 2-sentence excerpt for each post.
```

### Input

```ts
{
  format: 'standalone' | 'digest'
  posts: Array<{ title: string, body: string, slug: string, publishedUrl: string }>
  brandDnaTags: Record<string, number>
  businessName: string
  newsletterTitle: string | null
}
```

### Output (structured JSON)

```ts
// Standalone
{
  subject: string                          // voiced subject line
  preheader: string                        // ≤100 chars, preview text
  body: string                             // HTML-safe markdown
  readMoreUrl: string
}

// Digest
{
  subject: string
  preheader: string
  editorialIntro: string                   // 2–3 sentences
  posts: Array<{
    title: string
    excerpt: string                        // 2 sentences, not the meta description
    readMoreUrl: string
  }>
}
```

### Calibration

- Standalone body: 300–500 words. Not a truncation — a rewrite.
- Digest editorial intro: 2–3 sentences max. "Three posts this month. Two about what your competitors aren't writing. One about why that matters." — that register.
- Subject lines: dry, lowercase-feeling. Pool of 3 generated per send, system picks one.

### Brand DNA injection

Tags only. Influences tone (formal vs conversational), sentence structure, and the editorial intro voice.

---

## `content-generate-social-draft`

**Tier:** Haiku. **Registry key:** `content-generate-social-draft`. **Intent:** blog → platform-specific social text + format decision (single/carousel/video) + visual brief.

### System prompt

```
Generate a {platform} post from this blog content. Write in the brand's voice, adapted for {platform}'s conventions. Decide whether the post should be a single image, carousel, or video (if eligible). Include a visual brief describing what the accompanying image/video should convey.
```

### Input

```ts
{
  platform: 'instagram' | 'linkedin' | 'x' | 'facebook'
  blogPost: { title: string, body: string, metaDescription: string }
  brandDnaTags: Record<string, number>
  businessName: string
  videoEligible: boolean                   // true only for large tier
  lastUsedTemplateId: string | null        // to avoid repetition
}
```

### Output (structured JSON)

```ts
{
  text: string                             // platform-ready copy
  format: 'single' | 'carousel' | 'video'
  hashtags: string[]                       // platform-appropriate (none for LinkedIn unless industry-standard)
  visualBrief: string                      // 1–2 sentences describing the visual concept
  carouselSlides?: Array<{ text: string, visualBrief: string }>  // if carousel
  threadParts?: string[]                   // if X thread format
}
```

### Platform conventions

- **Instagram:** conversational, emoji-light (1–2 max), hashtag block at end (5–15), carousel-friendly content gets carousel.
- **LinkedIn:** professional register, no hashtags unless industry-standard, longer-form accepted, landscape image.
- **X:** concise, thread for longer content (max 4 tweets), landscape card image. No hashtags unless trending/relevant.
- **Facebook:** conversational, minimal hashtags (0–3), landscape image.

### Brand DNA injection

Tags only. A `formality`-heavy brand gets LinkedIn-register everywhere. A `dry_humour` brand gets permission to be wry on Instagram and X but not on LinkedIn. `visual_communication` tag increases likelihood of carousel recommendation.

---

## `content-select-visual-template`

**Tier:** Haiku. **Registry key:** `content-select-visual-template`. **Intent:** pick template + fill content for HTML→image rendering, or decide AI generation is needed.

### System prompt

```
Given a social draft and the available template library, select the best-fit template and populate its content fields. If no template fits well (the content needs a scene, abstract visual, or photographic style), output 'ai_image' as the selection.

Consider: content structure (stat? list? quote? comparison?), platform constraints, brand aesthetic, and recency (don't repeat the same template for consecutive posts).
```

### Input

```ts
{
  socialDraft: SocialDraft
  platform: 'instagram' | 'linkedin' | 'x' | 'facebook'
  blogPost: { title: string, body: string }
  brandDnaTags: Record<string, number>
  availableTemplates: Array<{ id: string, name: string, category: string, supportedFormats: string[] }>
  lastUsedTemplateId: string | null
  videoEligible: boolean
}
```

### Output (structured JSON)

```ts
{
  selection: string                        // template ID (e.g. 'T01') or 'ai_image' or video template ID
  reasoning: string                        // 1 sentence explaining the choice
  templateData: {                          // populated fields for the selected template
    headline?: string
    bodyText?: string
    statNumber?: string
    statContext?: string
    listItems?: string[]
    quoteText?: string
    beforeText?: string
    afterText?: string
    // ... template-specific fields
  }
}
```

### Calibration

- Bias toward typography templates (T01–T04) for brands with `minimalism`, `admires_restraint`, or `geometric_precision`.
- Bias toward content cards (T05–T08) for brands with `storytelling`, `warmth`, or `narrative_instinct`.
- Carousel (T09–T10) only for Instagram and LinkedIn. Only when content has clear multi-point structure.
- Video (V01–V04) only when `videoEligible` is true and content has a strong single-moment hook.
- `ai_image` fallback should be rare — templates cover most cases. Flag rate > 20% as a signal the template library needs expansion.

---

## `content-generate-image-prompt`

**Tier:** Haiku. **Registry key:** `content-generate-image-prompt`. **Intent:** blog content + Brand DNA visual signals → OpenAI Images API prompt.

### System prompt

```
Generate an image prompt for OpenAI's image generation API. The image accompanies a social media post about the given topic. It must feel consistent with the brand's visual identity while being relevant to the content.

Rules:
- Include the brand's colour palette in the prompt
- Prefer abstract/conceptual over literal/stock-photo
- No faces unless the post is explicitly about people
- No text in the image (text is overlaid by the template layer)
- Warm lighting, not clinical
- Describe composition, mood, colour, and style — not just subject matter
```

### Input

```ts
{
  blogTitle: string
  blogExcerpt: string                      // first 200 words
  platform: 'instagram' | 'linkedin' | 'x' | 'facebook'
  brandDnaTags: Record<string, number>
  brandColours: { primary: string, secondary: string, background: string }
  aspectRatio: string                      // e.g. '1:1', '16:9'
}
```

### Output (structured JSON)

```ts
{
  prompt: string                           // ≤500 chars, descriptive, no negative prompts
  style: 'natural' | 'illustration' | 'abstract' | 'photographic'
  qualityNote: string                      // hint for the Haiku verification call
}
```

### Calibration

- Prompts should be specific about colour, lighting, and composition. "A warm-toned abstract composition with coral (#B22848) gradients and soft amber highlights, slightly textured, minimal" > "an image about marketing."
- The `qualityNote` is passed to the verification call so it knows what "relevant" means for this image.
- If Brand DNA aesthetic tags include `analogue_texture`, add film grain / paper texture hints. If `geometric_precision`, add clean lines / sharp edges.

---

## `content-match-content-to-prospects`

**Tier:** Haiku. **Registry key:** `content-match-content-to-prospects`. **Intent:** score published post × Lead Gen candidate pool for relevance.

### System prompt

```
Given a published blog post and a list of Lead Gen prospects with enrichment profiles, score each prospect for relevance to this post. A high score means the post directly addresses something this prospect would care about based on their vertical, location, and business context.
```

### Input

```ts
{
  blogPost: { title: string, keyword: string, vertical: string, metaDescription: string }
  prospects: Array<{
    id: string
    businessName: string
    vertical: string
    location: string
    enrichmentSummary: string              // 2–3 sentence summary from Lead Gen enrichment
  }>
  threshold: number                        // from settings.get('content.outreach_match_threshold')
}
```

### Output (structured JSON)

```ts
{
  matches: Array<{
    prospectId: string
    relevanceScore: number                 // 0–100
    reason: string                         // 1 sentence: why this post is relevant to this prospect
  }>
}
```

### Calibration

- Only return matches above the threshold. Default threshold: 70.
- Vertical match is the strongest signal. A post about "Melbourne medical aesthetics SEO" scores high for med-aes prospects in Melbourne, low for a financial planner in Sydney.
- Location match is secondary. A post about generic SEO strategy scores moderately for any vertical.
- Enrichment summary context: if the prospect's website is thin on content, they're a stronger match for any content-related post.

---

## `content-draft-outreach-email`

**Tier:** Opus. **Registry key:** `content-draft-outreach-email`. **Intent:** content-forward outreach email per matched prospect.

### System prompt

```
Write a content-forward outreach email. You are NOT pitching. You are sharing something genuinely relevant.

The blog post you're sharing is real, published, and addresses something this prospect's business cares about. Lead with value. The post IS the value — link to it, frame why it's relevant to them specifically, and stop.

Do not:
- Pitch the Content Engine or any other product
- Ask for a meeting, call, or demo
- Use "just wanted to share" or "thought you might find this interesting"
- Be generic — this email must reference something specific about the prospect's business

Write in SuperBad's voice (dry, observational, direct). The email comes from Andy.
```

### Input

```ts
{
  blogPost: { title: string, publishedUrl: string, keyword: string, metaDescription: string }
  prospect: {
    businessName: string
    contactName: string
    vertical: string
    location: string
    enrichmentSummary: string
    websiteUrl: string
  }
  matchReason: string                      // from content-match-content-to-prospects
  brandDnaProfile: FullBrandDnaProfile     // SuperBad's own Brand DNA
}
```

### Output (structured JSON)

```ts
{
  subject: string                          // ≤60 chars, dry, specific
  body: string                             // plain text, 3–5 short paragraphs
  signOff: 'Andy'                          // first name only, Playfair italic
}
```

### Calibration

- Subject line examples: "wrote something about {their vertical}" · "{keyword} — figured you'd care" · "new post about {topic}, relevant to {businessName}"
- Body structure: (1) one sentence connecting the post to their business specifically, (2) what the post covers in 1–2 sentences, (3) the link, (4) sign-off. No CTA. No "let me know what you think."
- These emails land in Lead Gen's approval queue tagged `content_match`. They participate in earned autonomy — same graduation, probation, circuit-breaker discipline.
- Voice: Andy's voice via SuperBad Brand DNA. Not formal, not casual — dry and direct.

---

## `content-generate-embed-form-styles`

**Tier:** Haiku. **Registry key:** `content-generate-embed-form-styles`. **Intent:** Brand DNA visual tokens → CSS for embeddable opt-in form.

### System prompt

```
Generate a CSS stylesheet for an embeddable newsletter opt-in form based on the given brand visual tokens. The CSS must work standalone (no external dependencies) and be clean, minimal, and responsive.

Output only valid CSS. Use CSS custom properties for all brand values. The HTML structure is fixed — you're styling it, not changing it.
```

### Input

```ts
{
  brandDnaTags: Record<string, number>     // aesthetic domain tags
  brandColours: { primary: string, secondary: string, background?: string }
  brandTypography: { heading?: string, body?: string }  // Google Font names if set
  formContainerClass: 'sb-newsletter-form'
}
```

### Output

```ts
{
  css: string                              // complete CSS stylesheet
  fontImports: string[]                    // Google Font @import URLs if custom fonts used
  previewDescription: string               // 1 sentence describing the visual style for the dashboard preview
}
```

### Calibration

- Max CSS size: 2KB. Lean.
- CSS custom properties: `--sb-bg`, `--sb-text`, `--sb-accent`, `--sb-heading-font`, `--sb-body-font`, `--sb-radius`, `--sb-spacing`.
- Responsive breakpoint at 360px (stack input and button).
- `geometric_precision` tag → 0px border-radius. `organic_forms` → 8px. Default → 4px.
- `warmth` or `tactile_craft` → subtle box-shadow. Otherwise → none.
- `high_contrast` → stronger border. `minimalism` → thinner/no border.
- No animations in the CSS (form should load instantly on the subscriber's site).
- Colours must pass WCAG AA contrast ratio against background.
