# SuperBad Marketing Site — Visual & Experiential Brief

_Generated from the Phase 1 visual/experiential brainstorm. Seventeen decisions, each with a one-line rationale._

---

## Scope

### 1. Site purpose — three layered doors
Work, Thinking, Start-a-Trial. Each is a first-class mini-site under a shared homepage. Chosen over portfolio-only / essays-only / storefront-only because SuperBad's conversion story needs all three, shown with hierarchy.

### 2. Homepage hierarchy — Work is the hero
Work door gets full-bleed hero treatment. Thinking and Start-a-Trial are second and third acts on the homepage, with full nav parity. Rejected equal-peers (menu feeling), sequential scroll (too long on v1), personalised (premature).

### 3. Work content — creative only
Video primary, stills secondary. **Performance marketing** does not appear in the Work portfolio — it lives inside the Services page within the Trial funnel, inside the 6-week plan Andy generates for trial shoots, and eventually as case studies in Thinking. Performance imagery doesn't sit next to cinematic brand films without undercutting both.

### 4. Sitemap — four doors, rich funnel interior
Home · Work · Thinking · Start a Trial. Services, pricing, About-style trust content, and booking all nest inside the Start-a-Trial interior. Contact lives in the footer.

---

## Feel

### 5. Hero shape — composed frame
Static composed frame on first paint: Black Han Sans headline bleeding across a still or paused video frame (typography-as-graphic, per brand rules). **Video enters on first scroll**, not on landing. References: Penguin paperbacks, Brenton Wood album covers.

### 6. Motion language — hybrid, two registers
- **UI spring** (fast, tight, ~280ms) — buttons, hovers, menu opens, form fields. Feels 2026.
- **Narrative spring** (slow, weighted, 600–900ms) — section transitions, scroll reveals, grid-to-detail transitions. Carries the retro soul.

House spring tokens defined once, reused everywhere.

### 7. Pace — dense homepage, slow interior
Homepage: 5–6 tight sections, scannable in ~60 seconds (serves cold visitors). Interior (Work detail, Thinking essays, Trial funnel): spacious, one idea per screen, 3–4 minutes to traverse (serves committed visitors).

### 8. Texture — grain only
Subtle film grain on full-bleed imagery and Dark Charcoal backgrounds. **No paper, no ink-bleed, no halftone, no registration offset.** Retro soul comes from palette, typography, composition, pacing, and motion — not skeuomorphic surface effects. Grain ages like cinematography; paper ages like a Photoshop filter.

### 9. Sound — opt-in on the work
Silent by default everywhere. Unmute toggle on the homepage hero video (when it replaces the composed frame) and on Work detail pages. No ambient UI sounds anywhere.

### 10. Navigation — hide on scroll down, return on scroll up
Top bar visible on arrival, hides as visitor scrolls into content, returns on any upward scroll. Menu-as-moment overlay style is preserved for the open-state of the menu itself.

### 11. Mobile — reinterpreted, not translated
Every section spec produces two compositions: desktop and mobile. Same soul, native body. No scaled-down desktop compositions. Mobile hero is a tall portrait crop with repositioned type; film-strip transitions become vertical slides; homepage density compresses from five sections to four.

### 12. Entry moment — deliberate curtain-up, under 1s
Charcoal paints first, composed-frame image fades up, headline settles using the narrative spring. Paint-sequence driven (not fixed-duration) — slow connections get a graceful stagger, warm/cached visits get effectively nothing.

### 13. Colour grade — Warm Filmic (Portra 400)
Warm highlights, gently lifted blacks, faithful skin tones, 0.92 saturation, gentle S-curve. LUTs generated in `luts/` (apply to Rec.709 footage; stack on camera LUT for log). Signature grade for all creative imagery.

### 14. Voice moments — everywhere, calibrated
All utility surfaces (loading, 404, empty states, form errors, form successes, email confirmations) carry dry-voice copy. Calibrated per context. **All strings centralised in a `voice/` file** so tone stays consistent under a year of edits.

### 15. Work detail — tiered
- **Anchor pieces** (3–4 on launch): video hero + scrolling narrative (brief, stills, outcome paragraph, pull quote, earned Start-a-Trial CTA at the bottom).
- **Supporting pieces**: fullscreen video + thin Righteous credits strip (client, year, one-line description, next-piece affordance).
- Grid visually signals which is which (anchor tiles are larger).

### 16. Thinking typography — editorial magazine default
- **Default (B)**: asymmetric editorial — Black Han Sans headlines bleeding off-left, narrower body column offset right, Playfair Display italic pull quotes breaking out full-width, drop caps on first paragraph.
- **Occasional (D)**: tight utilitarian single-card format for short posts (anti-motivation, quick takes).
- **Opt-in (C)**: cinematic essay format — available per-essay for high-ambition long-form; mirrors the anchor Work pattern.

### 17. Grid-to-detail transition — zoom + projector shutter flash
Shared-element zoom carries the clicked tile into the hero position (fast, UI spring, ~280ms). A one-frame Dark Charcoal flash mid-zoom references the projector shutter without imposing a full wipe. Reduced-motion fallback: crossfade.

---

## Emergent locks (fell out of the above)

- **House spring tokens** — two springs, defined once, referenced everywhere.
- **Anchor pattern** — applies to both Work pieces and Thinking essays; signals where the site's ambition concentrates.
- **Voice file** — single source of truth for every utility string.
- **Two-composition rule** — every section spec includes desktop and mobile compositions.
- **LUT delivery** — web displays the CSS/SVG approximation; actual footage uses the `.cube` LUT.
- **Reduced-motion fallbacks required everywhere motion is signature.**
