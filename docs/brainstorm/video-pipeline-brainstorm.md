# Video Pipeline — Content Studio Extension Brainstorm

**Date locked:** 2026-04-28
**Status:** Foundational decisions locked; spec + build to follow.
**Phase:** Post-v1.0 (Content Studio extension, not v1.0 scope).
**Dependencies:** Content Studio (locked), Content Studio Motion spec (locked), Video Studio (built), Higgsfield API (integrated), Remotion (installed).
**Supersedes:** Video Studio as a standalone creation surface — creation moves into Content Studio; Video Studio becomes library/management only.

---

## What it is (one line)

A unified video creation pipeline inside Content Studio that combines Higgsfield (AI cinematic footage) and Remotion (brand overlays, motion graphics) into a single workflow — type a brief, get a finished branded video.

---

## 23 foundational decisions

### Q1 — Primary producer: **All three audiences, sequenced A → C → B**
- **A) SuperBad's own marketing** — first priority. Proving ground, portfolio builder, product demo.
- **C) SaaS subscriber self-serve** — second. Scalable revenue, platform stickiness.
- **B) Client deliverables** — third. Retainer clients already get bespoke production; tools augment, don't replace.

SuperBad's own use comes first because every video made for the feed doubles as a product demo for the platform itself.

### Q2 — Video formats: **All three**
- Animated social posts (Remotion) — template-driven, the daily workhorse.
- Cinematic hero clips (Higgsfield) — standalone mood pieces for site, Reels, outreach thumbnails.
- Composite branded Reels (Higgsfield + Remotion) — cinematic footage with brand overlay. The anchor content.

### Q3 — Day-to-day workhorse: **Animated posts as volume, composites as anchor**
Animated social posts are the daily bread — low friction, brand-consistent, batch-producible. Composite Reels are the weekly anchor pieces that build the brand and demonstrate platform capability. Hero clips are raw material feeding into both.

Workflow implication: Content Studio default path optimises for quick animated post production, with a "go cinematic" escalation for bigger pieces.

### Q4 — Cinematic input mode: **Both, default to reference-driven (image-to-video)**
- Reference-driven (default): feed a photograph and Higgsfield generates motion from it. Every shoot automatically has a video pipeline behind it — no second camera needed.
- Prompt-driven (fallback): describe what you want for abstract content, mood pieces, or when no source photo exists.

Trial shoot implication: prospect's stills immediately generate video content they didn't ask for — a genuine "how did you do that" moment.

### Q5 — Composite assembly: **Fully autonomous default with guided escape hatch**
- Autonomous: write a brief, platform picks footage, selects overlay template, applies Brand DNA palette, renders the composite. Review and publish.
- Guided (escape hatch): for flagship pieces, drop into a mode where you pick which footage + overlay combination to render.

Scales to SaaS subscribers who can't be expected to understand layers and compositing.

### Q6 — Creation entry point: **Everything in Content Studio**
Video is another content type alongside stills and carousels. One door. User describes what they want, platform determines the format. Video Studio survives as library/management only — not a creation surface.

Drafts, WIP, and history all live in one unified timeline.

### Q7 — Drafts and WIP: **Auto-save with named projects**
- Every state change auto-saves. Close the tab, come back tomorrow, it's there.
- When a piece moves past the brief stage (footage generating), platform prompts for a name (pre-filled with a smart suggestion).
- Unnamed experiments auto-expire after 7 days.
- WIP section at the top of Content Studio showing named projects with thumbnail, status badge (brief / generating / ready to edit / exported), and last-touched timestamp.

### Q8 — Brief input: **Single text field with smart assists**
- One text box, plain English.
- As you type, platform detects signals contextually:
  - Client name → auto-attaches Brand DNA
  - "Reel" / "cinematic" → surfaces reference image uploader
  - Stat mention → suggests stat-counter overlay
- Form adapts to what you're describing without structured fields.

### Q9 — Reference images: **Smart suggestions from media library + manual upload fallback**
- When a client or visual is mentioned, platform searches Cloudinary media library and suggests matching images ranked by visual quality (composition, lighting, sharpness).
- Manual upload available when no gallery exists for the subject.
- Cloudinary image analysis metadata (colour, brightness, sharpness) powers quality ranking at launch; LLM vision refinement later.
- Every new shoot upload enriches the pool of available footage seeds.

### Q10 — Brand overlay intensity: **Contextual defaults by content type**
| Content type | Overlay default | Description |
|---|---|---|
| Social posts / Reels (feed) | Integrated | Typography, stat callouts, brand colour accents woven throughout |
| Hero clips (website / outreach) | Light touch | Small logo watermark, footage is the star |
| Portfolio / case study | Bookended | Logo sting intro, clean showcase, CTA closer |

Brief builder auto-applies the right default. Overridable.

### Q11 — Default format mapping by content type:
| Content type | Default format | Engine | Notes |
|---|---|---|---|
| Anti-motivation typography | Animated post | Remotion | Kinetic text is the identity of these |
| Portfolio showcase | Composite Reel | Higgsfield + Remotion | Shoot stills → cinematic footage + brand overlay |
| Testimonial quote | Animated post | Remotion | Quote reveal animation |
| Behind-the-scenes | Composite Reel | Higgsfield + Remotion | On-set photo → cinematic clip + light brand |
| Tips / value post | Static (default) | — | Readability over motion; list cascade animation as option |
| Announcement | Animated post | Remotion | Short, punchy, headline-driven |
| Case study / results | Composite Reel | Higgsfield + Remotion | Client footage + stat counter overlay |
| Logo sting / intro | Animated clip | Remotion | Brand animation, reusable across pieces |

Platform suggests the natural format; user can override.

### Q12 — Higgsfield model selection: **Platform auto-selects, "try another model" to re-render**
- Brief builder selects the best model for the job automatically. No model names shown.
- If the result isn't right, "try another model" re-renders with the next-best model.
- User judges output, not technical choices.
- Matches LLM model registry philosophy: name the job, not the model.

### Q13 — Post-render editing: **Both layers independent + trimming**
- Overlay editable: swap typography, change palette, adjust timing, pick different template. Footage stays.
- Footage regenerable: new Higgsfield render with tweaked prompt or different model. Overlay settings preserved.
- Trim: set in/out points on footage, adjust where overlay elements appear.
- No full timeline editor. No keyframing, no multi-track, no effects. Mouse-friendly.

### Q14 — Output and distribution: **Download + scheduling + direct publish (internal)**
- Export to device (download).
- Scheduling queue with date/time and caption.
- Direct publishing to Instagram and Facebook via Meta API (internal accounts only, long-lived token — no App Review needed).
- SaaS subscriber publishing deferred until App Review is worthwhile.
- LinkedIn publishing scoped separately.

### Q15 — Website video: **Hero loop + motion portfolio**
- Homepage hero: Higgsfield-generated cinematic loop, atmospheric, auto-playing muted.
- Portfolio / case study pages: short composite Reels showing work in motion.
- Served via Cloudinary optimised video. Repurposed from social production, not extra work.

### Q16 — Outreach: **No video in cold outreach**
Video in unsolicited cold email devalues the work. Nobody asked for it. Outreach stays text + static as specced.

### Q17 — Retainer client deliverables: **Between-shoot content + bonus pack, manually delivered**
- Between shoots: platform generates animated posts and composite Reels from shoot stills to keep client feed active.
- At delivery: auto-generated bonus content pack alongside edited stills/video from the shoot.
- All output reviewed and delivered manually by Andy. No auto-publishing to client accounts.
- Quality gatekeeping is non-negotiable at this stage.

### Q18 — Cost tracking: **Inline cost tags + monthly dashboard**
- Each render in the library shows what it cost to generate.
- Separate admin page with monthly summary: total renders, cost per engine, cost per client, cost per content type, trend lines.
- Cost visibility in the creation flow — if it ends up expensive for low value, naturally self-regulates usage.

### Q19 — Multi-scene Reels: **Single-scene default, multi-scene unlocked**
- Standard workflow is single-scene (one Higgsfield clip + one Remotion overlay).
- "Add scene" button unlocks multi-scene sequencing for flagship pieces.
- Transitions between scenes handled by Remotion.
- Cost tags keep multi-scene spending self-regulated.

### Q20 — Audio: **SFX on day one, self-curated music library over time**
- Remotion SFX (whoosh on text entrance, soft thud on stat landing, ambient tone) ships with motion templates. SFX timeline component already exists.
- Music via a self-curated library: upload royalty-free tracks to Cloudinary, tag with mood/energy/tempo, optional per-render. Same pattern as SFX library.
- No stock royalty-free library (generic corporate uplift would undermine the aesthetic).
- No user-uploaded audio from SaaS subscribers (DMCA risk).
- Andy's taste is the quality filter on the music library.

### Q21 — Multi-variant rendering: **Optional, not default**
- For pieces that really matter, option to render 3 parallel variants (same prompt, different seeds/models).
- Presented as options — pick the best.
- Not the default workflow. Cost triples per generation, only justified for flagship content.
- Standard flow remains: one render, "try another model" if needed.

### Q22 — Prompt optimisation: **Behind-the-scenes step before Higgsfield**
- Before any prompt is sent to Higgsfield, an LLM optimisation step rewrites the user's brief into a Higgsfield-optimised prompt.
- Adds camera direction, lighting cues, composition guidance, model-specific keywords.
- Invisible to the user — they write naturally, the platform translates to the engine's language.
- Builds on the existing brief builder pattern but with a dedicated Higgsfield prompt-crafting step.

### Q23 — Prompt library: **Save and reuse known-good prompts**
- When a generation produces great output, save the optimised prompt + settings as a reusable recipe.
- Library of proven prompts builds over time, tagged by content type / mood / subject.
- Reduces experimentation cost on repeat formats.
- Accessible from the brief input — "use a recipe" option alongside free-text.

---

## Risk mitigations

### Higgsfield output quality
- Multi-variant rendering (optional) for flagship pieces.
- Prompt library for proven recipes reduces experimentation.
- Behind-the-scenes prompt optimisation before every Higgsfield call.
- Image-to-video as default constrains the AI to strong source material.

### Smart assist parsing accuracy
- Confidence indicators: detected signals shown as editable chips (`[Glow Aesthetic]` `[Composite Reel]` `[clinic interior]`). Confirm or correct in 2-5 seconds.
- Learn from corrections: overrides are logged; parser improves on personal vocabulary over time.
- Graceful fallback: if parser can't confidently detect, asks one clarifying question rather than guessing wrong.

### Composite pipeline reliability
- Stage-based status with per-stage retry: `Brief ✓ → Footage generating... → Overlay → Export → Publish`. Retry just the failed stage.
- Decoupled stages: each writes output to database before the next starts. Browser close mid-pipeline → picks up from last completed stage.
- Timeout and fallback: Higgsfield non-response at 90 seconds → clear message with options (wait, retry, switch to Remotion-only).

---

## Honest reality check

**This is a significant extension to Content Studio.** It unifies two engines (Higgsfield + Remotion), adds a compositing pipeline, smart brief parsing, media library integration, prompt optimisation, multi-scene support, audio, direct publishing, and cost tracking. It touches nearly every layer of the platform.

### Three hardest parts
1. **Smart assist parsing** — inferring content type, client, mood, and format from natural language. When it works it's magic; when it misses it's annoying. The editable-chip mitigation reduces the cost of misses.
2. **Composite rendering pipeline** — four systems in sequence (Higgsfield → Remotion → Cloudinary → Meta). Stage-based retry and decoupled persistence mitigate but don't eliminate fragility.
3. **UI/UX for a complex workflow** — auto-save, named projects, WIP section, smart assists, editable chips, preview, trim, overlay editing, multi-scene, scheduling, publishing. Must feel simple despite the complexity underneath. This is the highest priority.

### What could derail it
- **Higgsfield API instability.** Thin docs, undocumented auth flows, unknown rate limits. Budget debugging time.
- **Cost at volume.** 20+ clips/week with experimentation = $40-80/week in Higgsfield. Visible cost tags self-regulate, but worth monitoring.
- **Scope creep toward video editor.** Trim + multi-scene + overlay editing + music approaches a timeline editor. The line must be actively guarded.

### Verdict
Doable. Build in waves: animated posts (Remotion only, lowest risk) → single-scene Higgsfield clips → composites → multi-scene → audio → publishing. Each wave validates the next. UI, navigation, and usability are the top priority throughout.

---

## SaaS tier decisions — PARKED

SaaS subscriber tier splits (which video features at which price point) are parked for the proper SaaS product brainstorm. This scoping covers internal use only. SaaS decisions will be made when those products are brainstormed.

---

## Build priority

**UI, navigation, and usability first.** The creation flow must feel simple and intuitive despite the complexity underneath. Every technical decision serves the experience, not the other way around.
