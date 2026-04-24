# Social Media Design

Visual best practices for creating social media content that performs — specifically Instagram feed posts, carousels, stories, and reel covers.

## Format Specifications

### Instagram Feed Post
- **Square:** 1080 × 1080px (1:1) — universal, safe default
- **Portrait:** 1080 × 1350px (4:5) — takes up more screen real estate in feed, best for engagement
- **Landscape:** 1080 × 566px (1.91:1) — least feed real estate, avoid unless content demands it

**Recommended default: 4:5 portrait.** Occupies ~30% more screen space than square, which directly correlates with engagement.

### Carousel
- Same dimensions as feed posts (all slides must match)
- 2-10 slides (Instagram limit)
- Sweet spot: 7-10 slides for educational content, 3-5 for portfolio showcase
- First and last slides matter most — first stops the scroll, last earns the save/share

### Story
- 1080 × 1920px (9:16)
- Safe zone: keep critical content within centre 1080 × 1420px (top 250px and bottom 250px are covered by UI)
- Tap targets: don't place interactive elements where the "reply" bar or story navigation overlaps

### Reel Cover
- 1080 × 1920px (9:16) for full reel
- Feed thumbnail crops to centre 1080 × 1350px (4:5)
- **Critical:** design the cover so it reads well both at 9:16 (in Reels tab) and when cropped to 4:5 (in profile grid)

## Safe Zones

Every format has areas where Instagram's UI overlays the content:

```
┌──────────────────┐
│  Username / Time │ ← Top 200px: handle, timestamp, close button
│                  │
│                  │
│   SAFE ZONE      │ ← Keep all critical text/visuals here
│                  │
│                  │
│  Like/Comment/   │ ← Bottom 280px: engagement buttons, caption preview
│  Share/Save      │
└──────────────────┘
```

### Feed Posts (1:1 and 4:5)
- Bottom 60px may be cropped by caption overlay in some views
- Keep text away from edges — 40px padding minimum on all sides

### Carousels
- Swipe indicator area: bottom-centre, ~40px. Don't place key info there.
- Swipe cue: subtle arrow or visual continuation from slide edge encourages swiping. Don't use text like "SWIPE →" — it's dated.

## Text-to-Image Ratio

### The 20% Rule
Meta's ad system historically penalised images with more than 20% text coverage. While this is less strictly enforced for organic posts, it still matters:
- **Organic posts:** Instagram doesn't hard-penalise text-heavy images, but engagement is lower. The feed is visual — text-heavy posts feel like ads and get scrolled past.
- **Boosted/promoted posts:** the 20% rule still affects ad delivery and cost. If a post might be boosted later, keep text minimal.

### Text Hierarchy on Social
- **One statement per slide** — don't stack multiple ideas
- **Max 8-10 words for a headline** — if it can't be read in 1 second, it's too long
- **Body text: 25-35 words max per slide** — mobile screen, small type
- **Minimum font size: 24px at 1080px width** — anything smaller is unreadable on mobile

## Thumb-Stopping Patterns

The first frame has 0.3 seconds to earn attention in a scroll. What stops thumbs:

### Visual Techniques
1. **High contrast** — dark background + bright focal point, or vice versa. The eye goes to the brightest or most contrasted element.
2. **Face close-up** — human faces stop scrolls. Even partial faces, eyes, or expressions.
3. **Unexpected colour** — if the feed is mostly muted, a saturated colour pops. If the feed is colourful, a stark monochrome stands out.
4. **Pattern interrupt** — if your grid has a consistent style, occasionally break it. The interruption draws attention to that post.
5. **Negative space** — a mostly empty frame with one small focal element is arresting because it's different from the visual noise of a typical feed.
6. **Typography as image** — a single word or short phrase in a distinctive typeface can be more arresting than a photograph.

### What Doesn't Stop Thumbs
- Stock photography (brain filters it as "ad")
- Busy, detailed images with no clear focal point
- Low contrast / washed out colours
- Text on text on text (visual noise)
- Generic gradients or abstract backgrounds

## Carousel Design Principles

### Narrative Arc
Every carousel should tell a micro-story:
1. **Slide 1 — Hook:** statement, question, or image that creates curiosity
2. **Slides 2-N-1 — Development:** deliver on the hook's promise, one idea per slide
3. **Slide N — Landing:** conclusion, insight, or CTA. This is where saves happen.

### Visual Continuity
- Use a consistent colour palette and typography across all slides
- Maintain the same margins, text positioning, and spacing
- Visual elements can bleed from one slide to the next (encouraging swipe)
- Slide numbers or progress indicators help orientation on long carousels (6+ slides)

### Slide Transitions
- Avoid dramatic style shifts between slides — it feels disjointed
- Subtle variation is good (alternate between text-primary and image-primary slides)
- Keep the brand consistent: same fonts, same colour ratios, same design language

## Accessibility

### Contrast
- Text on image: WCAG AA minimum (4.5:1 for body text, 3:1 for large text)
- Use a semi-transparent overlay or solid background panel behind text on photos
- Don't rely on thin or light-weight fonts on busy backgrounds

### Alt Text
- Instagram supports alt text on posts. Always fill it in.
- Describe the content, not the design: "Carousel comparing before and after website redesign for a dental clinic" not "SuperBad branded carousel with pink and charcoal colour scheme"

### Colour Blindness
- Don't use red/green as the only differentiator
- Use shape, pattern, or labels alongside colour to convey meaning
- Test designs in a deuteranopia simulator when using colour to communicate data

### Motion
- Animated content (Reels, GIFs) should not rely solely on motion to convey information
- Flashing content: never exceed 3 flashes per second (seizure risk, and Instagram may suppress)

## Brand Application on Social

When applying a brand identity (like SuperBad's) to social content:

### Grid Cohesion
- The profile grid (3-column layout) is a portfolio. Every 3-6-9 posts, step back and check how it looks as a whole.
- Alternate content types in the grid to create rhythm (carousel, single, carousel, reel cover)
- Use a consistent treatment for the same content type (all quote posts look the same, all portfolio posts have the same framing)

### Template System
- Build 4-6 templates that cover the content pillars
- Each template should be instantly recognisable as "yours" in someone's feed
- Variation within templates (different copy, images) keeps it fresh without losing recognition
- Templates should enforce brand constraints (colours, fonts, spacing) automatically

### Watermarking
- Don't watermark feed posts — it looks amateur and doesn't prevent screenshots
- Logo placement: bottom corner, small, semi-transparent if at all. The design itself should be the brand signal, not a stamp.
