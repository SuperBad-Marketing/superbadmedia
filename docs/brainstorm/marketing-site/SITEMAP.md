# SuperBad Marketing Site — Sitemap & Section Spec

_Derived from the visual brief (Q1–Q17). Structural decisions that are technical/derivative are locked silently; product-judgement questions are surfaced at the end._

---

## Top-level structure

```
/                          Home
/work                      Work grid
/work/[slug]               Work detail (anchor or supporting, decided per piece)
/thinking                  Thinking index
/thinking/[slug]           Thinking essay (editorial / short / anchor-opt-in)
/start                     Start-a-Trial funnel entry     [SUB-BRAINSTORM P3]
/start/services            Services (creative + performance)
/start/pricing             Pricing / tiers
/start/book                Trial shoot booking
/404                       Voice-moment 404
```

Contact lives in the footer, not as a page. About content folds into `/start`.

---

## `/` — Home

Dense, quick. Scannable in ~60 seconds. Four sections, desktop and mobile.

| # | Section | Desktop composition | Mobile composition | Job |
|---|---|---|---|---|
| 1 | **Hero** | Composed frame: Black Han Sans headline bleeding across still/paused video frame. Video enters on first scroll, silent, opt-in unmute. | Portrait crop, type repositioned above image. | First impression — the "something started" moment. |
| 2 | **Work preview** | 4-tile grid of anchor pieces. Click → projector shutter zoom to detail. Hover → quiet unmute-state preview. | 2-column grid, 4 tiles visible, tap to play inline. | Proof of craft. Primary conversion surface. |
| 3 | **One Thinking piece** | Single featured essay card — editorial composition (Playfair italic pull quote + Black Han Sans headline + Righteous eyebrow). | Same card, vertical stack. | Proof of thinking. Door to Thinking. |
| 4 | **Start-a-Trial CTA (with service-line mention)** | Full-width composed frame. Dry-voice headline, two-line service-line mention ("We shoot it. We run it." — calibrated copy TBD), single primary CTA. Earned-CTA pattern — this is the end of the arc. | Same, portrait-cropped. | Primary conversion CTA + signals two service lines. |
| — | **Footer** | Four-col grid: nav, contact, social, a per-route dry-voice line. Grain layer subtly present. | Stacked. | Close the page. |

---

## `/work` — Work grid

Slow, immersive. Two-register grid.

- **Anchor tiles** (3–4): larger, 2:3 aspect, autoplaying muted preview on hover (desktop), tap-to-preview (mobile). Clicking triggers the Q17 shared-element zoom + projector shutter flash into `/work/[slug]`.
- **Supporting tiles**: standard size, still preview by default, autoplay on hover.
- Grid is a masonry-ish layout: anchors punctuate the grid, supporting pieces fill between.
- **Nav behaviour**: top bar visible on arrival, hides once the visitor scrolls into the grid.
- **Ordering**: **curated, anchors at rhythm points** (top, ~1/3, ~2/3, bottom). Manual `order` integer field on the Work schema; ties broken by recency. Anchors do not have to be chronologically recent.
- **Filter chips**: deferred to v1.1. On launch, a single curated grid.
- **End of grid**: earned Start-a-Trial CTA (closing moment pattern).

**Mobile**: single column. Anchors take full viewport height; supporting pieces are shorter cards. Same content, native rhythm.

---

## `/work/[slug]` — Work detail

Two templates, decided per piece at publish time.

### Template A — Anchor project page

1. **Video hero** — fullscreen autoplay, muted by default, unmute toggle top-right. Silent for ~2s then motion begins.
2. **Scroll-down chapter: "The brief"** — one paragraph, Playfair Display italic pull quote callout if present.
3. **Stills gallery** — 3–5 stills from the shoot, grain applied, Warm Filmic grade.
4. **Chapter: "What it did"** — one paragraph on outcome. No metrics unless they're honestly knockout-good — padding kills this section.
5. **Pull quote** — Playfair Display italic, display size, full-width.
6. **Credits strip** — Righteous uppercase: client, year, role, collaborators.
7. **Earned CTA** — "Start a Trial" at the bottom, softened voice.
8. **Next piece** — continuation affordance; projector shutter transition to the next anchor.

### Template B — Supporting piece

1. **Video** — fullscreen, autoplay, unmute toggle.
2. **Credits strip** — client, year, one-line description.
3. **Next piece** affordance.

No scroll-down content. Close or continue.

---

## `/thinking` — Thinking index

Editorial magazine, not a blog feed. **Flat list with a larger lead row** — no permanent "featured" slot.

- **Lead row**: the most recent essay renders at ~1.5× size with cover image visible. Title (Black Han Sans), Playfair dek, Righteous eyebrow.
- **Subsequent rows**: standard editorial list — title (Black Han Sans), one-line Playfair italic dek, Righteous eyebrow (date / category), hair-line divider between entries. No thumbnails unless the post specifically benefits.
- **Short posts** (utilitarian register) appear inline with essays, visually marked — tighter, single-card, no dek.
- **Anchor essays** (opt-in cinematic format) appear in the list at their chronological position but with a visibly distinct composed-frame cover treatment, upgraded in place.
- **No categories/tags nav on launch.** Added in v1.1 if volume justifies.

---

## `/thinking/[slug]` — Essay

Three templates, chosen per post.

### B — Editorial (default)
- Composed-frame cover (type + image).
- Asymmetric body: headline bleeds left, body column offset right at ~58ch.
- Drop cap on first paragraph (Playfair Display).
- Pull quotes break full-width (Playfair italic, display size).
- Footnotes as hover/tap reveals.
- Earned CTA at the bottom (not mid-essay).

### D — Utilitarian (short posts)
- Tight card.
- Headline + 200–500 words.
- No cover image unless the post is anti-motivation typographic content.
- Close affordance → back to `/thinking`.

### C — Cinematic essay (anchor opt-in)
- Composed frame cover.
- Essay broken into chapters separated by full-bleed visuals.
- Projector spring carries between chapters.
- End-of-essay earned CTA.

---

## `/start` — Start-a-Trial funnel

**⚠ Full sub-brainstorm required (PARKED.md P3).** The sitemap below is a provisional scaffold, not a locked structure.

Likely shape:

```
/start                 → Funnel entry — why SuperBad, the two service lines, the trial shoot pitch
/start/services        → Services detail — creative + performance — with performance proof (P2)
/start/pricing         → Tier presentation — trial + retainer + SaaS tiers
/start/book            → Booking flow — calendar / pre-fill / confirmation
```

Entry page composition, pricing depth, how-much-of-About-folds-in, pre-filled experience for outreach-arrived visitors — all to be resolved in the sub-brainstorm.

---

## `/404` and other utility surfaces

Voice-moment treatment per Q14. All strings in `voice/utility.ts` (single source of truth).

- **404**: composed frame with Black Han Sans typography and a dry-voice line. Back-to-home affordance + the projector-shutter transition.
- **Loading**: Charcoal background + thin warm-cream hair-line progress indicator. Dry-voice copy only if load exceeds 1.5s (otherwise it feels performative).
- **Form errors**: inline, Retro Pink italic (mutter register), self-deprecating about the form.
- **Form successes**: one dry-voice line, no confetti.
- **Email confirmations**: written in the same register as the on-site voice — no transactional robot tone.

---

## Navigation

- **Top bar** (Q10): hide-on-scroll-down, return-on-scroll-up. Logo left, four destinations right (Work, Thinking, Start a Trial), menu icon on mobile.
- **Menu overlay**: full-screen, projector transition, destinations laid out as a title card.
- **Footer**: quiet close. Four columns on desktop, stacked on mobile. Nav, contact (email only — no form here, the form is in `/start`), social, one ambient dry-voice line.

---

## Motion inventory

Single source of truth for what actually animates.

| Moment | Register | Spec |
|---|---|---|
| Entry paint | Narrative | Charcoal first, image fade-up, headline settle. Paint-driven. |
| Scroll reveal | Narrative | Items fade + translate-up on intersection. |
| Section transition | Narrative | Stagger between child elements; gentle weight. |
| Grid-to-detail | Hybrid | Shared-element zoom (UI spring 280ms) + one-frame projector shutter. |
| Menu open | UI | Full-screen overlay, projector wipe-in, quick release. |
| Nav hide/return | UI | Translate top bar off/on; tight spring. |
| Button hover | UI | Micro-lift, warm underline draw. |
| Opt-in unmute | UI | Toggle eases in; audio fade to avoid pop. |
| Footnote reveal | UI | Tooltip-style; fast. |
| Reduced-motion fallback | — | All narrative transitions become crossfades; UI stays responsive but without spring. |

---

## Resolved structural decisions

All five open product-judgement questions resolved in brainstorm:

1. **Homepage services strip** — folded into the final CTA section. Homepage is 4 sections, not 5.
2. **Thinking index** — flat editorial list with a larger lead row (no permanent featured slot).
3. **Work grid ordering** — curated, anchors at rhythm points; manual `order` integer.
4. **About content** — embedded inside `/start` entry page (Andy photo + voiced paragraph + quote); plus one per-route dry-voice line in the footer. No dedicated About page.
5. **Footer dry-voice line** — per-route, keyed in `voice/utility.ts` under `footerLines`. Four keys on launch (`home`, `work`, `thinking`, `start`) + utility fallback. No randomness, no rotation — each line is a signature.
