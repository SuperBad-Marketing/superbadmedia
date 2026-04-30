# SuperBad SuperEdits — Scope

## What this is

A standalone desktop app that puts a Claude-powered chat interface on top of DaVinci Resolve Studio. The primary way you interact is by typing what you want. The app handles the tedious, technical, and administrative side of video editing so you can focus on storytelling, pacing, and emotion.

SuperEdits connects to the SuperBad platform for client intelligence (brand DNA, briefs, context) and delivery (Cloudinary upload, client portal notification). It is not part of the platform — it's a personal editing tool that happens to be smarter because it knows your clients.

## Core philosophy

Emotion and psychology over polish. SuperEdits should never optimise for technical perfection at the expense of how something feels. Every automated decision is a suggestion that can be manually overridden, never a locked result.

---

## Architecture

### Desktop shell
- **Tauri** — lightweight, native feel, low memory footprint
- Runs alongside DaVinci Resolve Studio (must be open for scripting API access)
- Local Python bridge process that receives commands from the app and executes them against Resolve's scripting API

### AI brain
- **Claude API** — interprets natural language requests and generates Resolve scripting commands
- Skill files provide domain knowledge: Resolve API patterns, editorial craft, sound design, colour science
- Connected to SuperBad platform for client context (brand DNA, briefs, past deliverables)

### Integrations
- **DaVinci Resolve Studio** — scripting API (Python) for timeline, colour, Fusion, Fairlight, media pool, render
- **Epidemic Sound API** — music and SFX search, stems, download, licensing
- **SuperBad Platform API** — client data, brand DNA, briefs, Cloudinary delivery
- **Cloudinary** — backup storage for original footage, final delivery

---

## UI layout

### Left panel — Project & media
- Client info (pulled from SuperBad platform)
- Clip contact sheet / media browser
- Footage thumbnails with quality ratings and content tags from analysis
- Drag-and-drop file management

### Centre panel — Main stage (swaps between views)
- **Ingest view** — transfer progress, analysis results, contact sheet
- **Storyboard view** — visual rough cut builder with music waveform, drag-and-drop clip sequence, preview playback
- **Preview view** — before/after for grading, thumbnail builder, still export, export preview

### Right panel — Chat + tools
- Claude chat (always visible, primary interaction method)
- Epidemic Sound browser with visual player, waveform scrubbing, preview playback
- Recent actions log
- Undo history

### Bottom bar
- Project name
- Resolve connection status
- Export progress
- Storage health

---

## Workflow stages

### 1. Ingest

**Two entry points:**
- **Import from card** — plug in SD/CF Express, SuperEdits detects it
- **Import from folder** — point at existing footage on SSD

**What happens automatically:**
- Prompts: "Which client?" (from SuperBad client list, or type a name for personal projects)
- Creates structured folder on SSD: client / date / footage / audio / graphics / project
- Copies and verifies every file (skipped for import-from-folder)
- Renames clips with sensible naming convention (client_date_cam_001)
- Multi-card / multi-camera detection and merge
- Separate audio file detection and auto-sync (waveform matching)
- Duplicate detection (skips already-ingested files)
- Sony S-Log detection, auto-applies correct input transform
- Generates proxies for large shoots
- Pushes originals to Cloudinary as backup
- SSD storage health check before transfer starts
- Pulls client brief from SuperBad platform and attaches to project

**Clip analysis (runs during ingest):**
- Sharpness, exposure, focus quality
- Face detection, movement/energy levels
- Audio quality assessment
- Content tagging (what's in the clip)
- Quality rating per clip
- Generates visual contact sheet with thumbnails, ratings, one-line descriptions, issue flags

**Shoot notes field:**
- Optional text box: "Any notes from the shoot?"
- E.g. "second half was stronger, ignore first 10 minutes" or "owner in blue shirt is the hero"
- Context feeds into clip analysis and rough cut assembly

**Creates Resolve project:**
- From template based on content type
- Pre-built track layout, bins, export presets
- Imports everything into correct bins

### 2. Music selection

**Happens before assembly starts. Four options:**

1. **Claude picks** — you provide the vibe (cinematic / dynamic / moody / upbeat / raw, or free text). Claude uses vibe + client brand DNA + brief + shoot notes + clip analysis to search Epidemic Sound. Presents 3-5 tracks in the music player with waveforms. Also suggests the best section of each track for your edit length. You listen, pick the winner.

2. **Search** — type what you want in chat, Claude searches Epidemic Sound, results appear in the music player.

3. **Browse** — lightweight Epidemic Sound browser built into the UI. Visual player, scrubbing, category/mood/tempo filters.

4. **Import your own** — drop in your own track.

Music is locked before assembly begins. You mark the section of the track to use. Claude won't build the rough cut until the music decision is confirmed.

### 3. Rough cut assembly

**Chat-powered with storyboard preview.**

You kick it off: "build me a rough cut — cinematic brand piece, high energy, 30 seconds."

Claude uses:
- Client brand DNA and brief (from SuperBad platform)
- Shoot notes
- Clip analysis (content, energy, quality ratings)
- Selected music (tempo, structure, energy curve)
- Content type and platform target

Builds a narrative arc: establishing shot → introduce subject → build energy → peak moment → resolution → close. Places high-energy footage at musical peaks, quieter moments in valleys. Weights clip selection based on brief requirements (e.g. "client wants to highlight teamwork" → clips with multiple people and high movement).

**Storyboard preview (in-app, before Resolve):**
- Visual sequence of thumbnails laid against the music waveform
- Drag-and-drop reordering
- Swap clips, approve or reject suggestions
- Preview playback in the app
- "Send to timeline" pushes the approved structure to Resolve

You see the rough cut as a visual storyboard, feel whether the arc works, make quick swaps, then push to Resolve when the bones are solid. Resolve is for refinement, the app is for story structure.

### 4. Edit refinement (in Resolve, chat-assisted)

This is where your creative instincts take over. You replay, feel it, adjust timing, add contrast. SuperEdits assists via chat:

- "Find me the best shots of [subject/moment]" — searches analysed clips, shows thumbnails
- "This clip hangs too long" — trims to the natural endpoint
- "More energy contrast here" — suggests cuts or clip swaps
- "Swap clip 4 for something with more movement" — finds alternatives from the analysed footage

The client brief is surfaced here if relevant — not as a popup, but available when Claude needs it to inform suggestions.

### 5. Transitions

**Two modes, both available:**

**Pre-built library** (default) — curated set of 30-50+ premium transition templates. Each is a Fusion composition with matched SFX baked in. Camera shake impact, light leak dissolve, whip pan with whoosh, zoom blur punch-in, film burn crossfade, etc. You say "cinematic impact transition between clips 4 and 5" and Claude picks the right one.

**Dynamic generation** — Claude builds transitions on the fly via Fusion + Epidemic Sound SFX. For when you want something specific not in the library. "Build me a glitch transition that dissolves into film grain with a low rumble" and Claude constructs it.

### 6. Title cards & motion design

**Pre-built template library + dynamic generation (Fusion).**

- **Title cards** — full-screen or partial text cards. Chapter breaks, quote cards, opening titles. "Add a title card before clip 3 — 'The Process'" builds it in Fusion with project-matched styling.
- **Lower thirds** — name/title overlays. "Add a lower third for 'James, Head Chef' at 8 seconds."
- **Logo reveals** — animated logo intro/outro.
- **Kinetic typography** — animated text sequences.
- **Graphic overlays** — callouts, annotations, animated elements.

Template library ships with the app. Claude generates custom elements via Fusion on request.

### 7. Captions

**Auto-generated from audio transcription, fully customisable.**

- Claude transcribes audio and generates timed captions
- Manual overrides on:
  - Length (word count per caption, display duration)
  - Font selection (curated set matching SuperBad aesthetic + custom font import)
  - Styling: size, colour, position, background/no background
  - Animation style (pop-in, fade, typewriter, etc.)

### 8. Audio & SFX

**Chat-powered mixing and SFX placement.**

- **SFX layering** — Claude analyses the timeline, identifies transition points, impacts, reveals, mood shifts. Pulls SFX from Epidemic Sound (or local library), places and mixes them automatically. "Layer SFX on this section" or "add impact sounds on every transition."
- **Audio mixing** — J/L cuts for pacing, dB level balancing, dialogue/music/SFX bus separation. "Duck the music under the dialogue" or "the SFX are too loud."
- **Fairlight integration** — EQ, compression, noise reduction via chat. "Clean up the audio on clip 7" or "the room tone changes between these two clips."
- Loudness targeting for platform (YouTube, Instagram, broadcast).

### 9. Colour grading

**Three layers, all available:**

1. **Scene-matched auto-grade** — runs automatically. Analyses footage across the timeline, groups shots by lighting conditions, applies consistent base grade (exposure, white balance matching). Consistency for free.

2. **Reference-based grading** — "Grade this like the Thetford shoot" or drop in a reference image. Builds a node tree in Resolve that approximates the look.

3. **Style presets** — curated look presets (actual node trees, not LUTs). Cinematic warm, moody editorial, clean commercial, etc. Claude applies based on content type.

**Manual adjustment via plain English — no technical knowledge required:**
- "Warmer" / "cooler"
- "More contrast"
- "Skin tones are too orange"
- "Darker shadows but keep the highlights"
- "Make the sky more blue without affecting everything else"
- "This shot doesn't match the others"
- "It doesn't feel right" → Claude asks clarifying questions

Before/after preview shown inline in the app. "More" / "back" / "perfect" to iterate. All technical colour science stays hidden.

### 10. Stills & thumbnails

**Cinematic stills:**
- Manual frame grab at any point on the timeline
- Claude-assisted: "Pull the best stills from this edit" — identifies frames with strongest composition, sharpest focus, best expression, most interesting lighting
- Exports at full resolution with colour grade baked in

**Video thumbnails:**
- Frame pull + thumbnail builder
- Text overlay, crop/reframe for platform dimensions
- Subtle treatments (vignette, contrast boost, border)
- "Thumbnail for YouTube from the shot at 14 seconds, add the client name" → generates options
- Claude auto-suggests thumbnail candidates from the most visually striking moments

### 11. Ad variation generator

**One edit → full ad package (video + static).**

Triggered via chat: "create ad variations — 15s and 30s, reels and feed, test 3 hooks"

**Video variations — axes:**
- **Format** — 16:9, 9:16, 1:1, 4:5 (auto-reframed with subject tracking)
- **Length** — 6s, 15s, 30s, 60s cuts (Claude picks the strongest moments for each duration)
- **Hook** — first 3 seconds swapped out. Takes best 3-5 opening moments, creates a version with each as the hook
- **CTA** — different end cards/closing frames: "Book now", "Learn more", "Limited time", custom
- **Pacing** — faster and slower cuts from the same footage, same story arc

Combinatorial: 4 formats x 3 lengths x 3 hooks x 2 CTAs = 72 variations from one edit. Generated in storyboard preview for review — approve, reject, then batch export.

**Static variations:**
- **Single image** — hero frame with text overlay (headline, CTA, logo). Auto-selects strongest frames (composition, expression, focus, dynamic moments)
- **Carousel** — 3-5 frames telling the story in stills, each with text
- **Before/after** — side-by-side or swipe-style frames if content supports it
- **Quote card** — key line from audio transcript overlaid on the strongest frame
- **Format variants** — each static in story (9:16), feed (1:1, 4:5), and landscape (16:9)

**Text overlay controls:**
- Headline, subheadline, CTA text — user-provided or Claude-generated from brief
- Font from curated set or client brand font (from Brand DNA)
- Auto-positioning based on subject location — text never covers the focal point
- Background treatments: darken, blur, solid bar — chosen automatically

**Workflow:**
1. Finish primary edit
2. "Create ad variations" via chat
3. SuperEdits generates all video and static variations in storyboard preview
4. Scroll through, reject weak ones, approve the rest
5. Export all approved variations in one batch
6. Deliver to Cloudinary / client portal

### 12. Multi-format export

**One edit, multiple outputs.**

- "Make a 9:16 version for reels" — auto-reframes with subject tracking, adjusts keyframes, handles safe zones
- "Export a 1:1 for feed" — same process, square crop
- Manual override on reframing for any clip where auto doesn't nail it
- Platform-optimised export settings (resolution, bitrate, codec per platform)
- Batch export all formats in one go

### 12. Delivery

- Renders all versions
- Uploads to Cloudinary via SuperBad platform
- Notifies client via their portal
- Starts 2 business day revision timer

### 13. Revisions

- 1 revision allowed within 2 business days of delivery
- Revision requests surfaced in the app (from platform)
- Revision timer visible — archives project when window closes
- Change tracking: what was requested, what was changed

---

## Continuous learning system

SuperEdits learns over time. Instead of a separate tool for building skill files, the learning pipeline is a native feature inside the app. You feed it knowledge, it gets better.

### Input sources (drop any of these into the chat or Knowledge tab)

- **YouTube link** — "learn from this: https://youtube.com/..." Pulls captions via yt-dlp, distills editorial/technical patterns, generates a skill file.
- **Article/blog URL** — scrapes content, extracts patterns and techniques.
- **PDF drop** — reads documentation, plugin manuals, technique guides. Great for Resolve docs.
- **Free text / personal notes** — paste your own techniques, venue-specific notes, things you've figured out. "When I shoot at this venue, the lighting is always warm and overhead — compensate in the grade."
- **Resolve project import** — analyse a finished project you're proud of. Extracts editorial patterns, transition choices, grading approach, SFX placement as learnings.

### How it works

1. Source material is ingested (captions pulled, content scraped, document read)
2. Claude distills into actionable patterns — "when X, do Y" rules and recipes
3. Summary shown to you for approval, editing, or rejection
4. Approved knowledge saved as a skill file in the local skill library
5. All future Claude interactions in SuperEdits draw from the full skill library

### Knowledge tab

- Browse everything SuperEdits has learned, organised by topic
- Edit, update, or delete any entry
- See when each skill was added and from what source
- Search across all learned knowledge

### Starter skill files (15 total)

These should be built before or during early use to give SuperEdits a strong foundation:

**Resolve Core (5):** Scripting API, Colour Grading, Fusion, Fairlight, Media Management

**Editorial Craft (7):** Editorial Pacing, Colour Grading Creative, Sound Design, Transition Language, Music Editorial, Social Format Editing, Interview & Multicam

**Integration & Workflow (3):** Epidemic Sound API, File Organisation, FFmpeg Video Operations

Full details and recommended video sources tracked in `skill-file-tracker.html`.

---

## Manual overrides

Every automated decision in SuperEdits can be manually overridden. The app is an assistant, not an autopilot. Specific override surfaces:

- Rough cut assembly: drag-and-drop reorder, swap clips, reject suggestions
- Transitions: swap type, adjust timing, replace SFX
- SFX: reposition, replace, adjust volume, remove
- Captions: edit text, adjust timing, change font/style/length/position
- Title cards & motion design: edit text, adjust animation, change styling
- Colour grade: plain English adjustments, before/after preview
- Music: import your own track at any point, override Claude's selection
- Reframing: manual keyframe adjustment for any clip in multi-format export
- Clip selection: always your final call on which clips make the cut

---

## What's NOT in scope (for v1)

- After Effects integration (Resolve/Fusion only)
- AI-generated footage or stock footage search
- Collaborative editing (single user)
- Mobile companion app
- Direct social media posting (delivery goes through SuperBad platform)
- Advanced VFX (green screen, motion tracking composites, 3D)

---

## Tech stack

- **App shell:** Tauri (Rust backend, web frontend)
- **Frontend:** React + TypeScript (likely with Tailwind for styling)
- **Resolve bridge:** Python process using DaVinciResolveScript module
- **AI:** Claude API (Anthropic SDK)
- **Music/SFX:** Epidemic Sound API
- **Delivery:** Cloudinary API via SuperBad platform
- **Skill pipeline:** Node.js + yt-dlp + Claude API
- **Local storage:** SQLite for project metadata, settings, clip analysis cache
