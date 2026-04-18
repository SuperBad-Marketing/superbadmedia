# Content Engine — Newsletter Email Template Design

**Surface:** Newsletter emails sent to subscriber lists. **Spec:** `docs/specs/content-engine.md` §4.4, §16. **Author:** Claude (CMS-3). Two variants: standalone (single post) and digest (multiple posts).

---

## Design principles

1. **Brand DNA drives the visual identity.** Colours, typography preferences, and mood from the subscriber's Brand DNA profile inform the template rendering. The template is a frame; the Brand DNA fills it.
2. **Readable in every client.** Progressive enhancement: rich in Apple Mail/Gmail, graceful in Outlook. No JavaScript. No web fonts in fallback — system font stack as backup.
3. **One column, generous whitespace.** Newsletter content is meant to be read, not navigated. No sidebar, no multi-column grids.
4. **Images are optional.** The OG image appears if available, but the email works without it. Alt text always present.

---

## Standalone variant (single post)

Used when one post has been approved since the last send.

### Structure

```
┌─────────────────────────────────────────┐
│  [Logo / wordmark — subscriber brand]   │
│                                         │
│  Eyebrow: newsletter title (if set)     │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Post title (Playfair Display or        │
│  subscriber's headline font)            │
│                                         │
│  Haiku-rewritten body                   │
│  (conversational, scannable,            │
│   ~300–500 words)                       │
│                                         │
│  [Read the full post →]                 │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Footer: business name · city           │
│  Unsubscribe · Manage preferences       │
│                                         │
└─────────────────────────────────────────┘
```

### Copy elements

- **Eyebrow:** subscriber's newsletter title (set in config), or business name if no title set.
- **"Read the full post" CTA:** links to the full blog post on the subscriber's domain.
- **Footer business name:** from `companies.name`.
- **Footer location:** from `companies.location` or subscriber's timezone-derived city.
- **Unsubscribe line:** `Unsubscribe from {businessName}'s newsletter` — single click, permanent.

### Visual tokens (from Brand DNA)

- **Background:** derives from Brand DNA aesthetic tags. Default: light (#FAFAFA) for most, dark (#1A1A18) if `monochrome_comfort` or `high_contrast` tags are dominant.
- **Heading colour:** primary brand colour from Brand DNA, or subscriber-set brand colour.
- **Body text:** #333333 on light, #E8E0D0 on dark. DM Sans or system fallback.
- **Accent:** secondary brand colour for the CTA button and horizontal rules.
- **OG image (if present):** full-width, rounded corners (4px), below the title.

---

## Digest variant (multiple posts)

Used when 2+ posts have been approved since the last send. Haiku drafts a brief editorial intro tying the posts together.

### Structure

```
┌─────────────────────────────────────────┐
│  [Logo / wordmark — subscriber brand]   │
│                                         │
│  Eyebrow: newsletter title              │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Editorial intro (Haiku-generated,      │
│  2–3 sentences, ties posts together)    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Post 1: title + excerpt + [Read →]     │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Post 2: title + excerpt + [Read →]     │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  (Post 3, if applicable)               │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Footer: business name · city           │
│  Unsubscribe · Manage preferences       │
│                                         │
└─────────────────────────────────────────┘
```

### Copy elements — digest-specific

- **Editorial intro:** Haiku-generated via `content-rewrite-for-newsletter` prompt with `format: 'digest'`. 2–3 sentences. Not a summary of each post — a brief that makes the collection feel intentional. E.g., "Three posts this month. Two about what your competitors aren't writing. One about why that matters."
- **Per-post block:** title (linked) + 2-sentence excerpt (Haiku-generated, not the meta description) + "Read →" link.
- **Post order:** chronological (oldest first). The editorial intro provides the narrative thread.

---

## SuperBad's own newsletter

SuperBad's newsletter uses the same template infrastructure but with SuperBad's Brand DNA tokens:

- **Background:** Dark Charcoal (#1A1A18)
- **Heading:** Warm Cream (#FDF5E6), Black Han Sans (web font with system fallback)
- **Body:** Warm Cream, DM Sans
- **Accent:** SuperBad Red (#B22848) for CTA button, Retro Pink (#F4A0B0) for dividers
- **Eyebrow:** `SuperBad` (Righteous, uppercase, letter-spaced)
- **Footer:** `SuperBad Marketing · Melbourne`

### SuperBad blog CTA in newsletter

At the bottom of every SuperBad newsletter, above the footer:

- **Line:** `This newsletter was written by the Content Engine. It does this for other businesses too.`
- **Link:** `See how →` linking to `/get-started/content-engine`
- **Styling:** Retro Pink, small, DM Sans italic. Footnote register — noticed, not shouted.

---

## Technical notes for Phase 5

- Template rendered as HTML email (inline styles, table layout for Outlook compatibility).
- Brand DNA visual tokens injected at render time via `generateEmbedFormStyles` pattern (same infrastructure as the embeddable opt-in form).
- Web fonts loaded via `@import` with system fallback stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- Max width: 600px centred. Responsive below 480px (padding adjusts, images stack).
- Preheader text (hidden preview line in email clients): first sentence of the body or editorial intro.
- `List-Unsubscribe` header with one-click unsubscribe URL per RFC 8058.
- All images served from Cloudflare R2 with CDN caching.
