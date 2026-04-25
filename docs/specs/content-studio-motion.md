# Content Studio — Motion Graphics

**Status:** locked (2026-04-26)
**Owner:** this spec
**Consumers:** Content Studio (post creation), Video Studio (library/export), Content Engine (distribution)
**Dependencies:** Remotion (npm), Cloudinary (media storage), existing Content Studio templates, Brand DNA

---

## User story

Andy opens Content Studio, writes a brief, and generates a post as usual. A new "Motion" toggle lets him render the same content as an animated Remotion composition instead of a static PNG. The preview plays inline. A hybrid editor panel appears: text fields in a side panel, visual colour swatches above the preview, and a mini timeline strip below it for animation timing. He can tweak copy, swap colour palettes, and adjust timing without re-prompting.

For things that only make sense animated — stat counter overlays, kinetic text reveals, logo stings — he picks from a library of motion-only templates. These can export with transparent backgrounds for compositing over video.

Before generating, Andy can paste Instagram links or drag-drop screenshots as style references. The system scrapes or reads them and feeds the visual context into the LLM prompt. References can be saved to a persistent library for reuse across posts.

At export, Andy picks a primary aspect ratio for editing (1:1, 3:4, 4:5, 9:16, 16:9), then selects which additional ratios to render alongside. Motion posts export as MP4 or WebM-with-alpha (for overlays). Rendered outputs land in both Content Studio history and Video Studio library.

---

## §1 Template system

### §1.1 Paired animation variants

Every existing static template gets a motion counterpart. The static template's layout is preserved — elements animate in using entrance animations (fade, slide, scale, count-up for numbers). The Remotion composition receives the same `SlideCopy` data as the static template.

Paired templates for v1:
| Static template | Motion variant | Key animations |
|---|---|---|
| announcement-bold | announcement-bold-motion | Headline slides up, detail fades in, gradient pulses |
| announcement-minimal | announcement-minimal-motion | Headline character reveal, tagline fade |
| anti-motivation-typography | anti-motivation-typography-motion | Kinetic text entrance, letter-spacing breathe |
| tips-value | tips-value-motion | Headline drops in, detail typewriter |
| testimonial-quote | testimonial-quote-motion | Quote marks scale in, text fade, attribution slide |
| bts-caption | bts-caption-motion | Headline blur-to-sharp, tagline slide |
| portfolio-showcase | portfolio-showcase-motion | Label wipe, headline slide, detail fade |

### §1.2 Motion-only templates

Templates designed specifically for animation with no static equivalent:

| Template ID | Name | Description | Overlay-capable |
|---|---|---|---|
| stat-counter | Stat Counter | Large number counts up with label. For statistics/metrics posts. | Yes |
| text-reveal | Text Reveal | Kinetic typography — words appear in sequence with emphasis animations. | Yes |
| logo-sting | Logo Sting | SuperBad logo animation with tagline. Intro/outro for video. | Yes |
| quote-kinetic | Kinetic Quote | Quote text animates word-by-word with emphasis on key phrases. | Yes |
| split-stat | Split Stat Comparison | Two stats side-by-side, both count up, with vs. divider. | Yes |
| list-cascade | List Cascade | Bullet points cascade in one-by-one with stagger delay. | No |
| cta-closer | CTA Closer | Closing slide with animated CTA button + contact details. | No |

### §1.3 Template definition interface

```typescript
interface MotionTemplateDef {
  id: string;
  name: string;
  category: "paired" | "motion-only";
  staticCounterpart: string | null;  // links to TemplateDef.id for paired
  overlayCapable: boolean;
  copySlots: string[];
  animationParams: AnimationParamDef[];
  defaultDuration: number;  // frames at 30fps
  minDuration: number;
  maxDuration: number;
}

interface AnimationParamDef {
  key: string;
  label: string;
  type: "timing" | "easing" | "toggle";
  default: number | string | boolean;
}
```

### §1.4 Remotion composition structure

Each motion template is a React component registered as a Remotion `<Composition>`. Props:

```typescript
interface MotionTemplateProps {
  copy: Record<string, string>;  // slot name → text value
  palette: ColourPalette;
  aspectRatio: AspectRatio;
  transparent: boolean;  // strips background at render
  animationParams: Record<string, number | string | boolean>;
}
```

---

## §2 Aspect ratios

| Label | Ratio | Dimensions (px) | Primary use |
|---|---|---|---|
| Square | 1:1 | 1080 × 1080 | Instagram feed, LinkedIn |
| Portrait | 3:4 | 1080 × 1440 | Instagram feed (tall) |
| Tall portrait | 4:5 | 1080 × 1350 | Instagram feed (max height) |
| Story / Reel | 9:16 | 1080 × 1920 | Instagram/TikTok Stories & Reels |
| Landscape | 16:9 | 1920 × 1080 | YouTube, LinkedIn video |

User picks one primary ratio for the editing preview. At export, selects which additional ratios to render. Templates must be responsive — Remotion compositions receive width/height as props and adapt layout.

---

## §3 Colour palettes

### §3.1 SuperBad brand presets

| Preset name | Background | Primary | Accent | Text |
|---|---|---|---|---|
| Default Dark | #0F0F0E | #B22848 | #F28C52 | #FDF5E6 |
| Pink Forward | #0F0F0E | #F4A0B0 | #B22848 | #FDF5E6 |
| Cream Invert | #FDF5E6 | #B22848 | #F28C52 | #0F0F0E |
| Monochrome | #0F0F0E | #FDF5E6 | #807F73 | #FDF5E6 |
| Orange Warm | #0F0F0E | #F28C52 | #FDF5E6 | #FDF5E6 |

### §3.2 Client Brand DNA palettes

When generating for a client (company_id attached to the post), the system reads the client's Brand DNA colour values and auto-generates 2-3 palettes:
1. **Client primary** — client's primary colour as accent on dark background
2. **Client inverted** — client's primary as background with contrasting text
3. **Client + SuperBad** — client's primary + SuperBad pink as dual accent

Palette generation is deterministic from Brand DNA hex values — no LLM needed.

### §3.3 Palette data shape

```typescript
interface ColourPalette {
  id: string;
  name: string;
  source: "brand" | "client-dna";
  background: string;  // hex
  primary: string;
  accent: string;
  text: string;
}
```

---

## §4 Hybrid editor

### §4.1 Text editing (side panel)

Right-side panel, always visible when editing a motion post. Shows:
- One text field per copy slot (labelled by slot name)
- Slide selector for carousels (tabs or dropdown)
- Changes update the Remotion preview in real time via prop updates

### §4.2 Colour/style swatches (above preview)

Horizontal row of palette swatches rendered as small colour-block chips above the preview viewport. Click to switch palette. Active palette has a ring indicator. SuperBad presets first, then client DNA presets (if applicable).

### §4.3 Mini timeline (below preview)

Horizontal strip showing the composition duration with:
- Playhead scrubber (drag or click to seek)
- Play/pause button
- Duration display (e.g. "3.0s")
- Per-element timing markers (if the template exposes timing params) — draggable to adjust entrance delays

### §4.4 Preview viewport

Remotion `<Player>` component rendering the composition at the selected primary aspect ratio. Scales to fit the available space with letterboxing. Shows checkerboard background only when "Overlay preview" is toggled (for transparent templates).

---

## §5 Inspiration references

### §5.1 Input methods

- **Paste link** — Instagram post URL (or any public URL). System fetches OG image + meta description. For Instagram, extracts post image via oEmbed endpoint.
- **Upload image** — drag-drop or file picker. Accepts PNG, JPG, WebP. Uploaded to Cloudinary under `superbad/inspiration/{postId|library}`.

### §5.2 Per-post references

Each post can have 0-5 inspiration references attached. Shown in a collapsible "Inspiration" section on the creation form, above the brief textarea. References are passed to the LLM as vision inputs (images) or text descriptions (scraped metadata) when generating copy.

### §5.3 Saved inspiration library

Persistent table of references that can be reused across posts.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | UUID |
| `source_type` | text | `link` or `upload` |
| `source_url` | text | Original URL or Cloudinary URL |
| `thumbnail_url` | text | OG image or upload thumbnail |
| `title` | text | OG title or user label |
| `description` | text | OG description or user note |
| `tags` | text | Comma-separated for filtering |
| `created_at_ms` | integer | |

Library is browseable from the creation form — click "From library" to attach a saved reference.

---

## §6 Export

### §6.1 Export formats

| Format | Extension | Use case | Alpha support |
|---|---|---|---|
| MP4 (H.264) | .mp4 | Standard video post | No |
| WebM (VP9) | .webm | Transparent overlay | Yes |

### §6.2 Export flow

1. User clicks "Export" on a motion post
2. Modal shows:
   - Primary ratio (already selected, shown as confirmation)
   - Checkboxes for additional ratios
   - Format toggle: "Video (MP4)" or "Overlay (WebM alpha)"
   - Overlay option only enabled for overlay-capable templates
3. User confirms → Remotion renders each ratio × format combination server-side
4. Rendered files upload to Cloudinary under `superbad/content-studio/{postId}/motion/`
5. Rows inserted into `content_studio_renders` with `render_type = 'motion'`
6. Completed renders appear in both Content Studio post history and Video Studio library

### §6.3 Rendering

Server-side Remotion rendering via `@remotion/renderer`. Each render is a background job tracked in `video_jobs` (engine = `remotion`, linked to content_studio post via metadata).

---

## §7 Data model changes

### §7.1 Alter `content_studio_posts`

Add columns:
| Column | Type | Notes |
|---|---|---|
| `motion_enabled` | integer | 0 or 1, default 0 |
| `motion_template_id` | text | Remotion template ID, null for static-only |
| `palette_id` | text | Selected colour palette ID |
| `animation_params_json` | text | JSON of animation parameter overrides |
| `primary_aspect_ratio` | text | Selected primary ratio for editing |
| `inspiration_refs_json` | text | JSON array of attached reference IDs |

### §7.2 New table: `inspiration_library`

See §5.3 for columns.

### §7.3 Alter `content_studio_renders`

Add columns:
| Column | Type | Notes |
|---|---|---|
| `render_type` | text | `static` or `motion`, default `static` |
| `format` | text | `png`, `mp4`, `webm` |
| `video_job_id` | text | FK to video_jobs for motion renders |

### §7.4 Extend `video_jobs`

Add column:
| Column | Type | Notes |
|---|---|---|
| `content_studio_post_id` | text | FK back to content_studio_posts, null for standalone video jobs |

---

## §8 Integration points

### §8.1 Content Studio toggle

The post creation form gains a "Motion" toggle (pill switch). When enabled:
- Template picker shows motion templates (paired variants + motion-only)
- Preview switches from iframe/srcDoc to Remotion `<Player>`
- Editor panel appears (text + swatches + timeline)
- Export options change from PNG ratios to video formats

### §8.2 Video Studio library

Motion renders appear in Video Studio's video library alongside Higgsfield-generated videos. Filtered by `engine = 'remotion'` and `content_studio_post_id IS NOT NULL`. Users can re-export or preview from either location.

### §8.3 LLM generation

Copy generation prompt gains:
- Inspiration reference context (image descriptions or vision inputs)
- Motion-aware instructions ("write for animation — lead with the hook word, keep stat numbers clean for count-up")

---

## §9 Build phases

| Phase | Scope | Sessions |
|---|---|---|
| **M-1** | Schema migrations, Remotion setup, template infrastructure, first 2 paired templates | 1-2 |
| **M-2** | All paired templates, motion-only templates (stat-counter, text-reveal, logo-sting) | 1-2 |
| **M-3** | Hybrid editor (text panel, colour swatches, timeline), preview with Remotion Player | 1-2 |
| **M-4** | Inspiration library (upload, link paste, saved library, LLM integration) | 1 |
| **M-5** | Export pipeline (MP4, WebM alpha, multi-ratio, Cloudinary upload) | 1 |
| **M-6** | Video Studio integration, aspect ratio picker, polish | 1 |

---

## §10 Success criteria

- Andy can generate a motion post from the same Content Studio flow as static posts
- All 7 existing templates have working animation variants
- At least 3 motion-only templates ship (stat-counter, text-reveal, logo-sting)
- Text, colour, and timing are editable without re-prompting
- Instagram links and uploaded images work as inspiration references
- Transparent overlay export (WebM alpha) works for overlay-capable templates
- All five aspect ratios render correctly (1:1, 3:4, 4:5, 9:16, 16:9)
- Motion renders appear in both Content Studio and Video Studio
