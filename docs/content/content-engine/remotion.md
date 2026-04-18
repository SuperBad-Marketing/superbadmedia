# Content Engine — Remotion Motion Template Art Direction

**Surface:** Video social assets for large-tier subscribers. **Spec:** `docs/specs/content-engine.md` §5.2 (video path), §16. **Author:** Claude (CMS-3). Large tier only.

---

## Purpose

Animated social video content generated from blog posts. Not filmed video — kinetic typography, animated text, motion graphics rendered by Remotion from templates + Brand DNA tokens + blog content.

---

## Format targets

| Platform | Aspect | Duration | Notes |
|----------|--------|----------|-------|
| Instagram Reel | 9:16 (1080×1920) | 15–30s | Vertical, sound optional |
| LinkedIn video | 16:9 (1920×1080) | 15–30s | Landscape, auto-captions expected |
| X video | 16:9 (1920×1080) | 15–20s | Short, punchy |
| Facebook | 16:9 (1920×1080) | 15–30s | Shares LinkedIn render |

---

## Motion template types (4)

### V01 — Kinetic pull quote

One sentence from the post, revealed word-by-word or phrase-by-phrase with kinetic typography. Final frame holds the full sentence + business name.

- **Motion:** words enter with spring easing (houseSpring equivalent). Each word or phrase arrives 100–200ms after the previous. Light parallax shift on the background colour.
- **Typography:** display font from Brand DNA, large. Warm Cream on dark or inverted.
- **Duration:** 10–15s.
- **Sound:** optional subtle type-click per word (muted, not distracting). Default: silent.
- **End card:** business name + domain, 3s hold.

### V02 — Stat counter

A key number from the post counts up from 0 to the target value. Context line appears after the counter lands.

- **Motion:** counter uses easeOut timing — fast at start, slow approach to the target. Slight scale pulse on landing. Context line fades in 500ms after counter stops.
- **Typography:** number in display font, context in body font.
- **Duration:** 8–12s.
- **Background:** Brand DNA primary colour, full bleed.
- **End card:** as V01.

### V03 — Takeaway scroll

3–5 key takeaways scroll vertically through the frame, each pausing for 3–4s. Think teleprompter pacing.

- **Motion:** smooth vertical scroll, each takeaway snaps to centre. Subtle fade-in on enter, fade-out on exit. Active takeaway at full opacity, adjacent at 30%.
- **Typography:** body font, generous size (readable on mobile at 9:16).
- **Duration:** 15–25s (scales with takeaway count).
- **Numbering:** Brand DNA accent colour on the number, body colour on the text.
- **End card:** "Read the full post" + domain, 3s hold.

### V04 — Before/after split

Two-panel animation. "Before" panel slides in from left, holds 3s. "After" panel slides in from right, holds 3s. Both visible together for 3s. End card.

- **Motion:** panels slide in with spring easing. Slight overshoot on entry (playful, not mechanical).
- **Left panel:** muted colour, "before" state (the gap or problem).
- **Right panel:** Brand DNA primary colour, "after" state (what the post addresses).
- **Typography:** DM Sans or subscriber body font, centred per panel.
- **Duration:** 12–15s.
- **End card:** as V01.

---

## Brand DNA token injection

All Remotion templates accept:

| Token | Source | Default (SuperBad) |
|-------|--------|---------------------|
| `primaryColour` | Brand DNA aesthetic signals | #B22848 |
| `secondaryColour` | Brand DNA secondary | #F4A0B0 |
| `backgroundColor` | aesthetic tags (dark/light) | #1A1A18 |
| `textColour` | contrast against bg | #FDF5E6 |
| `displayFont` | Brand DNA typography mood | Black Han Sans |
| `bodyFont` | default | DM Sans |
| `springConfig` | house spring | { tension: 170, friction: 26 } |

---

## Selection logic

Claude (`content-select-visual-template` prompt) chooses the video template when:
1. The post has a strong single stat → V02
2. The post has a provocative pull quote → V01
3. The post has 3–5 clear takeaways → V03
4. The post addresses a gap or before/after contrast → V04

Video is only generated for large-tier subscribers. The template selection prompt knows the subscriber's tier and only considers video templates when eligible.

---

## Production notes for Phase 5

- Remotion compositions defined at `/templates/video/` alongside social templates.
- Rendered via Remotion Lambda for production (server-side, no browser dependency).
- Output stored in Cloudflare R2. CDN-served.
- Each video render takes 10–30s depending on complexity and Lambda cold start.
- Renders queued via `scheduled_tasks` as part of the fan-out pipeline — not blocking the approval flow.
- No audio by default. Sound effects are a future enhancement (requires audio licensing or generation).
