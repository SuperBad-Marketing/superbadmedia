# SuperEdits — Cinematic Effects Catalogue

This document is the LLM reference for mapping natural-language editing instructions to
concrete DaVinci Resolve effects. When a user describes a feeling, mood, or cinematic
technique, match their language against the **"When to use"** tags below, select the
appropriate ingredients, and compose them into an effect stack.

## How to use this catalogue

### Decision hierarchy

When the user describes an effect they want:

1. **Vague request?** → Trigger interactive effect discovery (see section 15). Do NOT guess.
   Vague = "make it cinematic", "make it look good", "clean this up", "add some style",
   "make it professional", "make it pop". If you can't identify a specific technique or
   mood, it's vague.
2. **Specific narrative moment?** → Check recipes first. If a recipe's trigger phrases closely
   match, use it as a starting point and customise variant intensities.
3. **Partially matches a recipe?** → Use the recipe as a skeleton, add/remove ingredients.
4. **Specific single effect?** → ("add halation", "slow this down") Apply just that ingredient.
5. **Novel combination?** → Compose from individual ingredients, max 6-8 per clip.

### Intensity calibration

Map the user's language to variant selection consistently:

| User language | Variant | Parameter adjustment |
|--------------|---------|---------------------|
| "barely", "hint", "touch", "whisper", "trace" | Lightest available | Reduce key params 30% below subtle |
| "slight", "gentle", "soft", "mild" | subtle | As specified |
| (no modifier), "standard", "normal", "some" | standard | As specified |
| "strong", "heavy", "bold", "aggressive", "obvious" | heavy | As specified |
| "extreme", "maxed", "insane", "overwhelming", "cranked" | heavy | Push key params 20% beyond heavy |

### Fusion compound script rule (CRITICAL)

Resolve allows only ONE active Fusion composition per timeline clip. When multiple `fusion`
ingredients target the same clip, they MUST be combined into a single Fusion script — one
node graph chained together:

```
MediaIn → [Effect1 tools] → [Effect2 tools] → [Effect3 tools] → MediaOut
```

The bridge's `build_compound_fusion(clip_index, ingredients[])` command handles this.
Never send multiple separate `inject_fusion_comp` calls to the same clip — the last one
will overwrite all previous ones.

### Color node ordering

When multiple `color-node` ingredients target the same clip, apply them in this fixed order
(each as a separate serial node on the Color page):

1. **Exposure / contrast** — `high-contrast`, `crush-blacks`, `lifted-shadows`
2. **Temperature / tint** — `warm-shift`, `cool-shift`, `day-for-night`
3. **Saturation** — `full-desaturation`, `desaturation-partial`, `saturation-boost`
4. **Creative look** — `teal-and-orange`, `cross-process`, `bleach-bypass`, `neon-cyberpunk`, `noir`
5. **Film stock emulation** — `film-stock-emulation`
6. **Animated colour** — `colour-pop`, `colour-temperature-drift`, `flash-to-white/black`
7. **Vignette** — `vignette-subtle`, `vignette-heavy` (applied as OFX on final node, not a separate node)

### Existing effect detection

Before applying effects, the bridge queries the clip's current state via
`get_clip_effects_state(clip_index)`. This returns:
- Existing Color page nodes and their types
- Active Fusion comp (if any) and its tools
- Current speed/retiming settings
- Any applied ResolveFX

The LLM receives this state and MUST:
- Skip ingredients that are already present (don't double-warm a warm clip)
- Modify existing effects rather than stacking duplicates
- Warn the user if existing effects conflict with requested ones

### Audio implementation reality

Resolve's Python scripting API has **very limited Fairlight access**. Audio effects are
handled in two tiers:

**Tier A — API-accessible** (these work via bridge commands):
- Volume automation (ducking, volume-swell, hard-cut-silence)
- Audio track management (add tracks, place SFX clips)
- Pan/stereo width (basic)
- Clip-level volume

**Tier B — Requires pre-processing** (these CANNOT be applied via Resolve's API):
- EQ / filtering (muffled-audio, tin-can-radio, phone-call)
- Reverb, delay, echo
- Pitch shifting (audio-slow-down, audio-speed-up)
- Distortion, bit-crush, phaser/flanger

For Tier B effects, SuperEdits processes the audio server-side using ffmpeg/sox BEFORE
importing into Resolve. The bridge workflow is:
1. Extract clip audio → temp file
2. Apply ffmpeg/sox audio filters (low-pass, reverb, pitch-shift, etc.)
3. Import processed audio to a new Resolve audio track
4. Mute original clip audio, sync processed version

Ingredients typed as `audio-preprocess` in this catalogue use Tier B pre-processing unless
explicitly noted as Tier A.

### SFX layer placement

Audio layer ingredients (`sfx-layer` type) need a timeline position. Each specifies a
`placement` value:

| Placement | Meaning |
|-----------|---------|
| `clip-start` | At the first frame of the target clip |
| `clip-end` | Ending at the last frame of the target clip |
| `throughout` | Full duration of the target clip, looped if needed |
| `at-timestamp` | At a specific timestamp within the clip (user-specified) |
| `before-cut` | Starting N seconds before the cut to the next clip |
| `after-cut` | Starting at the cut, trailing into the clip |
| `over-transition` | Centred on the transition between two clips |

Timeline position is calculated as: `clip_start_frame + (offset_seconds × timeline_fps)`

### Effect conflicts

Some ingredients fight each other. The LLM must never apply conflicting effects
simultaneously. Key conflicts:

| Ingredient | Conflicts with |
|-----------|---------------|
| `warm-shift` | `cool-shift`, `day-for-night` |
| `cool-shift` | `warm-shift`, `sepia` |
| `full-desaturation` | Any colour-specific grade (`teal-and-orange`, `cross-process`, `neon-cyberpunk`, `colour-channel-isolation`) |
| `slow-motion` | `fast-forward`, `strobe-skip` |
| `fast-forward` | `slow-motion`, `freeze-frame` |
| `high-contrast` | `lifted-shadows` (they work in opposite directions) |
| `bleach-bypass` | `saturation-boost` (bypass desaturates, boost saturates) |
| `flash-to-white` | `flash-to-black` (at the same moment) |
| `halation` (heavy) | `high-contrast` (extreme) — glow fights hard edges |
| `old-film` | `vhs-camcorder` — pick one era |
| `muffled-audio` (heavy) | `reverb-swell` (heavy) — competing transformations |
| `hard-cut-silence` | Any audio layer at the same timestamp |

If the user explicitly requests a conflicting pair, ask which they prefer.

### Performance cost

Each ingredient has a performance impact on Resolve's real-time playback:

| Cost tier | Types | Budget per clip |
|-----------|-------|----------------|
| **Heavy** | `fusion` (especially particles, blur, displacement), complex `resolve-fx` | Max 2 |
| **Medium** | Simple `fusion`, most `resolve-fx`, `timeline-op` | Max 4 |
| **Light** | `color-node`, `clip-property`, `sfx-layer`, `marker` | Unlimited |

If a recipe exceeds 2 heavy + 4 medium on a single clip, warn the user:
"This combination is pretty demanding — Resolve may need to render before playback is smooth. Want me to simplify, or apply as-is?"

### Recipe scope

Recipes that affect multiple clips use explicit scope:

| Scope field | Meaning |
|------------|---------|
| `primary` | The clip(s) the user specified |
| `bookend_before: N` | Apply specified effects to N clips before the primary |
| `bookend_after: N` | Apply specified effects to N clips after the primary |
| `entry_transition` | Transition INTO the first primary clip |
| `exit_transition` | Transition OUT OF the last primary clip |
| `global` | Apply to all clips in the timeline |

## Implementation types

Each ingredient uses one of these approaches:

- **`fusion`** — Fusion composition script injected onto the clip. When multiple fusion ingredients target the same clip, they are combined into one compound script. See "Fusion compound script rule" above.
- **`resolve-fx`** — ResolveFX plugin applied via the Edit page or Color page OFX panel.
- **`color-node`** — Color page node with grade parameters (lifts, gammas, gains, curves). See "Color node ordering" above.
- **`clip-property`** — Timeline item property (speed, retiming, transform, opacity).
- **`timeline-op`** — Timeline-level operation (cut, transition, track layering, adjustment layer).
- **`audio-preprocess`** — Audio processed server-side via ffmpeg/sox, then imported to a new Resolve audio track. Replaces the original `fairlight` type for effects requiring EQ/reverb/delay/pitch. See "Audio implementation reality" above.
- **`audio-automation`** — Resolve-native audio automation (volume, pan). Tier A in audio reality.
- **`sfx-layer`** — New audio clip sourced from Epidemic Sound / SFX library, placed on a dedicated audio track. See "SFX layer placement" above.
- **`marker`** — Resolve marker placed for manual editor action (fallback when API cannot achieve the effect).

---

## 1. VISUAL — Glow & Light

### `halation`
**When to use**: dreamy, soft, romantic, nostalgic, ethereal, glowing, warm glow, memory, heavenly, angelic, hazy
**What it does**: Soft light bleeds from bright areas into surrounding pixels. Creates an ethereal, dreamlike quality where highlights wrap and breathe.
**Implementation**: `fusion` — SoftGlow tool
**Variants**:

| Variant | Gain | Blend | Threshold | XGlowSize | Description |
|---------|------|-------|-----------|-----------|-------------|
| subtle | 0.3 | 0.3 | 0.75 | 8 | Gentle warmth, barely there |
| standard | 0.6 | 0.5 | 0.55 | 15 | Classic dreamy halation |
| heavy | 1.0 | 0.7 | 0.35 | 30 | Blown-out, super ethereal |

**Pairs well with**: `warm-shift`, `slow-motion`, `film-grain-35mm`, `muffled-audio`, `reverb-swell`

---

### `lens-flare`
**When to use**: epic, cinematic, sun, light source, dramatic, anamorphic, sci-fi, heroic, grand
**What it does**: Simulated lens flare from a bright light source. Can be naturalistic or stylised.
**Implementation**: `resolve-fx` — ResolveFX "Lens Flare"
**Variants**:

| Variant | Type | Intensity | Anamorphic | Description |
|---------|------|-----------|------------|-------------|
| natural | Natural | 0.4 | off | Subtle, realistic sun flare |
| anamorphic | Anamorphic | 0.6 | on | Horizontal streak, cinematic |
| dramatic | Star | 0.8 | off | Bold, JJ Abrams-style star burst |

**Pairs well with**: `god-rays`, `warm-shift`, `snap-zoom`, `musical-riser`

---

### `god-rays`
**When to use**: heavenly, divine, sunlight through trees, volumetric, atmospheric, beams, rays, spiritual, dramatic light
**What it does**: Directional shafts of light emanating from a bright source. Simulates light scattering through atmosphere.
**Implementation**: `resolve-fx` — ResolveFX "Light Rays"
**Variants**:

| Variant | Intensity | Length | Threshold | Description |
|---------|-----------|--------|-----------|-------------|
| subtle | 0.3 | 0.4 | 0.8 | Gentle beams, barely visible |
| standard | 0.5 | 0.6 | 0.65 | Clear directional rays |
| dramatic | 0.8 | 0.9 | 0.5 | Bold, theatrical light shafts |

**Pairs well with**: `halation`, `dust-particles`, `warm-shift`, `choir-pad`

---

### `light-leak`
**When to use**: organic, film, analog, warm, accidental beauty, vintage, sun, overexposed edge, dreamy
**What it does**: Warm or coloured light bleeding into the frame edges, simulating light entering a film camera body.
**Implementation**: `fusion` — FastNoise + ColorCorrector + Merge (Additive)
**Variants**:

| Variant | Color | Intensity | Position | Animated | Description |
|---------|-------|-----------|----------|----------|-------------|
| warm-edge | Orange/amber | 0.4 | Edge | Slow drift | Gentle warm leak from side |
| full-wash | Golden | 0.6 | Full frame | Pulse | Warm wash across frame |
| anamorphic-streak | Cyan/magenta | 0.5 | Horizontal | Slow sweep | Horizontal colour band |
| film-flash | White/warm | 0.8 | Random | Flicker | Brief overexposure bursts |

**Pairs well with**: `film-grain-35mm`, `halation`, `warm-shift`, `vinyl-crackle`

---

### `light-wrap`
**When to use**: compositing, background light, edge glow, integration, soft edges, natural blending
**What it does**: Background light bleeds around the edges of foreground subjects. Sells the feeling that subjects are embedded in the scene's light.
**Implementation**: `fusion` — LightWrap tool (or ChannelBooleans + Blur + Merge)
**Variants**:

| Variant | Wrap | Softness | Blend | Description |
|---------|------|----------|-------|-------------|
| subtle | 0.2 | 10 | 0.3 | Gentle edge glow |
| standard | 0.5 | 20 | 0.5 | Visible wrap around edges |
| heavy | 0.8 | 35 | 0.7 | Strong backlight bleed |

**Pairs well with**: `halation`, `backlight-exposure`, `warm-shift`

---

### `bokeh-overlay`
**When to use**: soft, romantic, city lights, night, out of focus, fairy lights, magical, festive
**What it does**: Layer of soft, defocused circles of light floating across the frame.
**Implementation**: `fusion` — pEmitter (particle system) with circular shapes + Defocus
**Variants**:

| Variant | Count | Size | Movement | Defocus | Description |
|---------|-------|------|----------|---------|-------------|
| sparse | 5-10 | Large | Slow drift | Heavy | Few large soft circles |
| medium | 15-25 | Mixed | Gentle float | Medium | Classic bokeh field |
| dense | 40+ | Small-medium | Active | Light | Busy sparkle field |

**Pairs well with**: `warm-shift`, `slow-motion`, `halation`, `romantic-pad`

---

### `candlelight-flicker`
**When to use**: intimate, warm, cozy, candlelit, firelight, flickering, romantic dinner, tavern, period
**What it does**: Subtle warm luminance pulse simulating the unsteady light of flames.
**Implementation**: `fusion` — BrightnessContrast with animated Gain driven by Perlin noise
**Variants**:

| Variant | Frequency | Amplitude | Warmth | Description |
|---------|-----------|-----------|--------|-------------|
| subtle | Low | 0.05 | Slight | Barely perceptible warmth pulse |
| standard | Medium | 0.12 | Moderate | Clear candlelight flutter |
| dramatic | High | 0.25 | Strong | Aggressive flame flicker |

**Pairs well with**: `warm-shift`, `vignette-heavy`, `film-grain-16mm`, `fire-crackle`

---

### `stroboscope`
**When to use**: club, rave, party, strobe, flash, dance floor, intense, disorienting, concert, performance
**What it does**: Rhythmic bright-to-dark pulsing simulating a strobe light.
**Implementation**: `fusion` — BrightnessContrast with square-wave animated Gain
**Variants**:

| Variant | Rate (Hz) | Intensity | Duty Cycle | Description |
|---------|-----------|-----------|------------|-------------|
| slow | 2 | 0.6 | 50% | Slow dramatic pulse |
| medium | 4 | 0.8 | 40% | Energetic club strobe |
| fast | 8 | 1.0 | 30% | Intense rapid flash |

**Pairs well with**: `high-contrast`, `desaturation-partial`, `glitch-visual`, `bass-drop`

---

## 2. VISUAL — Film & Texture

### `film-grain-8mm`
**When to use**: super 8, home movie, vintage, old footage, amateur, personal, family video, lo-fi, retro
**What it does**: Heavy, chunky grain with visible structure. Looks like aged 8mm film stock.
**Implementation**: `resolve-fx` — ResolveFX "Film Grain" or "Film Damage"
**Variants**:

| Variant | Grain Size | Intensity | Scratches | Gate Weave | Description |
|---------|-----------|-----------|-----------|------------|-------------|
| clean-grain | Large | 0.6 | None | None | Just the grain texture |
| aged | Large | 0.7 | Light | Slight | Grain + subtle damage |
| damaged | Large | 0.8 | Heavy | Moderate | Full vintage 8mm look |

**Pairs well with**: `vignette-heavy`, `warm-shift`, `rounded-corners`, `tape-warble`

---

### `film-grain-16mm`
**When to use**: indie, documentary, gritty, raw, textured, organic, 16mm, arthouse, Dogme
**What it does**: Medium grain with organic texture. Adds grit and authenticity without overwhelming the image.
**Implementation**: `resolve-fx` — ResolveFX "Film Grain"
**Variants**:

| Variant | Grain Size | Intensity | Description |
|---------|-----------|-----------|-------------|
| fine | Medium | 0.3 | Subtle texture, barely there |
| standard | Medium | 0.5 | Clear 16mm character |
| heavy | Medium-large | 0.7 | Gritty, aggressive grain |

**Pairs well with**: `bleach-bypass`, `desaturation-partial`, `handheld-shake`, `room-tone`

---

### `film-grain-35mm`
**When to use**: cinematic, film, subtle texture, professional, feature film, organic, warm
**What it does**: Fine, tight grain structure. Adds cinematic texture without degrading the image.
**Implementation**: `resolve-fx` — ResolveFX "Film Grain"
**Variants**:

| Variant | Grain Size | Intensity | Description |
|---------|-----------|-----------|-------------|
| subtle | Small | 0.15 | Just enough to break up digital cleanliness |
| standard | Small | 0.3 | Classic 35mm feel |
| pushed | Small-medium | 0.5 | High-ISO pushed film look |

**Pairs well with**: `halation`, `warm-shift`, `teal-and-orange`, `any colour grade`

---

### `old-film`
**When to use**: vintage, old, historical, archive, damaged, aged, deteriorated, found footage (old), period piece, silent film
**What it does**: Full old film simulation including scratches, dirt, hair, gate weave, exposure flicker.
**Implementation**: `resolve-fx` — ResolveFX "Film Damage" + "Analog Damage"
**Variants**:

| Variant | Scratches | Dirt | Weave | Flicker | Vignette | Description |
|---------|-----------|------|-------|---------|----------|-------------|
| light-age | Light | Light | Slight | Subtle | Slight | Mildly aged, good condition |
| moderate | Medium | Medium | Moderate | Moderate | Moderate | Clearly old, well-worn |
| deteriorated | Heavy | Heavy | Heavy | Heavy | Heavy | Badly degraded, archival feel |
| silent-era | Heavy | Heavy | Heavy | Heavy | Heavy + rounded | 1920s silent film look |

**Pairs well with**: `sepia`, `full-desaturation`, `vignette-heavy`, `vinyl-crackle`, `speed-variation`

---

### `film-burn`
**When to use**: transition, organic, warm, overexposed, end of reel, film projector, light exposure, analog
**What it does**: Bright, warm overexposure bleeding from edges, simulating film exposed to light at reel ends.
**Implementation**: `fusion` — FastNoise (animated) + BrightnessContrast + Merge (Additive/Screen)
**Variants**:

| Variant | Intensity | Speed | Color | Description |
|---------|-----------|-------|-------|-------------|
| subtle | 0.3 | Slow | Warm amber | Gentle edge warmth |
| standard | 0.6 | Medium | Orange/white | Classic film burn |
| extreme | 0.9 | Fast | White hot | Aggressive overexposure |

**Pairs well with**: `film-grain-35mm`, `warm-shift`, `light-leak`, `vinyl-crackle`

---

### `vhs-camcorder`
**When to use**: VHS, 90s, camcorder, home video, surveillance, lo-fi video, retro video, tape, recording
**What it does**: VHS tracking lines, colour bleed, reduced resolution, timecode overlay, tape noise.
**Implementation**: `resolve-fx` — ResolveFX "Analog Damage" (VHS preset)
**Variants**:

| Variant | Tracking | Color Bleed | Noise | Timecode | Description |
|---------|----------|-------------|-------|----------|-------------|
| clean-vhs | None | Slight | Low | Optional | Clean VHS dub |
| worn-tape | Occasional | Moderate | Medium | Optional | Well-used tape |
| damaged | Frequent | Heavy | High | On | Badly degraded tape |

**Pairs well with**: `scan-lines`, `warm-shift`, `tape-warble`, `muffled-audio`

---

### `super-8`
**When to use**: super 8, home movie, childhood, nostalgia, personal, family, amateur film, retro
**What it does**: Rounded corners, overexposure, jitter, heavy grain, warm colour cast.
**Implementation**: `resolve-fx` — "Film Damage" + `fusion` (rounded corner mask)
**Variants**:

| Variant | Grain | Jitter | Overexposure | Corners | Description |
|---------|-------|--------|--------------|---------|-------------|
| clean | Medium | Slight | Slight | Rounded | Well-preserved Super 8 |
| aged | Heavy | Moderate | Moderate | Rounded | Typical aged home movie |
| projector | Heavy | Heavy | Heavy | Rounded + flicker | Film projector playback |

**Pairs well with**: `warm-shift`, `film-grain-8mm`, `vignette-heavy`, `vinyl-crackle`

---

### `scan-lines`
**When to use**: CRT, retro TV, monitor, surveillance, broadcast, old television, tube TV, 80s
**What it does**: Horizontal scan lines simulating a CRT television or monitor display.
**Implementation**: `fusion` — Background (line pattern) + Merge (Multiply/Overlay)
**Variants**:

| Variant | Line Spacing | Opacity | Curvature | Description |
|---------|-------------|---------|-----------|-------------|
| subtle | 2px | 0.15 | None | Barely visible lines |
| monitor | 2px | 0.3 | Slight | Computer monitor feel |
| crt-tv | 3px | 0.5 | Barrel | Old TV set look |

**Pairs well with**: `vhs-camcorder`, `vignette-heavy`, `chromatic-aberration`, `tin-can-audio`

---

### `halftone-print`
**When to use**: newspaper, comic book, print, pop art, Warhol, retro print, graphic novel, editorial
**What it does**: Image rendered as halftone dot pattern, like newspaper or comic book print.
**Implementation**: `fusion` — Mosaic + CustomTool (dot pattern generation)
**Variants**:

| Variant | Dot Size | Color | Description |
|---------|----------|-------|-------------|
| newspaper | Small | B&W | Classic newspaper print |
| comic | Medium | CMYK | Comic book colour halftone |
| pop-art | Large | Bold primaries | Warhol-style bold dots |

**Pairs well with**: `high-contrast`, `colour-channel-isolation`, `full-desaturation`

---

### `polaroid`
**When to use**: instant photo, Polaroid, snapshot, nostalgic, personal, casual, memory, still
**What it does**: Polaroid-style treatment — white border, slightly shifted colours, soft focus edges, slight overexposure.
**Implementation**: `fusion` — Rectangle mask (border) + ColorCorrector + Blur (edge) + Merge
**Variants**:

| Variant | Border | Color Shift | Focus | Description |
|---------|--------|-------------|-------|-------------|
| fresh | White | Slight warm | Sharp centre | Freshly taken Polaroid |
| aged | Yellowed | Faded | Soft edges | Old, slightly faded |
| sun-bleached | Yellowed | Heavy fade | Soft | Badly sun-bleached |

**Pairs well with**: `warm-shift`, `desaturation-partial`, `camera-shutter-sfx`

---

## 3. VISUAL — Lens & Distortion

### `lens-blur`
**When to use**: depth of field, focus, bokeh, out of focus, rack focus, shallow, selective focus, blurry background
**What it does**: Simulated shallow depth-of-field with bokeh characteristics.
**Implementation**: `fusion` — Defocus tool or VariBlur with mask
**Variants**:

| Variant | Blur Amount | Bokeh Shape | Mask | Description |
|---------|------------|-------------|------|-------------|
| background-soft | 5 | Circle | Lower third protected | Background gently softened |
| rack-focus-in | 15→0 | Circle | Animated | Focus pulls to sharp |
| rack-focus-out | 0→15 | Circle | Animated | Focus pulls to blur |
| tilt-shift | 8 | Circle | Horizontal band | Miniature / model effect |
| dreamy-overall | 3 | Circle | None | Gentle overall softness |

**Pairs well with**: `halation`, `slow-motion`, `bokeh-overlay`, `warm-shift`

---

### `chromatic-aberration`
**When to use**: lens imperfection, distorted, uneasy, disorientation, druggy, broken lens, glitch-adjacent, lo-fi
**What it does**: RGB channels separate at frame edges, creating colour fringing.
**Implementation**: `fusion` — ChannelBooleans (split RGB) + Transform (offset per channel) + Merge
**Variants**:

| Variant | Offset (px) | Distribution | Description |
|---------|-------------|--------------|-------------|
| subtle | 1-2 | Edge only | Barely noticeable, realistic |
| moderate | 3-5 | Edge-weighted | Clear aberration, stylised |
| extreme | 8-15 | Full frame | Aggressive RGB split, trippy |

**Pairs well with**: `lens-distortion`, `glitch-visual`, `handheld-shake`, `vhs-camcorder`

---

### `barrel-distortion`
**When to use**: fisheye, wide angle, GoPro, action cam, distorted, warped, surveillance, peephole
**What it does**: Barrel or pincushion lens distortion warping the image.
**Implementation**: `resolve-fx` — ResolveFX "Lens Distortion"
**Variants**:

| Variant | Amount | Type | Description |
|---------|--------|------|-------------|
| subtle | 0.15 | Barrel | Slight wide-angle feel |
| gopro | 0.35 | Barrel | Action camera look |
| fisheye | 0.7 | Barrel | Full fisheye warp |
| pincushion | -0.3 | Pincushion | Inward warp |

**Pairs well with**: `handheld-shake`, `high-contrast`, `scan-lines`

---

### `anamorphic`
**When to use**: cinematic, widescreen, anamorphic, oval bokeh, horizontal flare, scope, epic, filmic
**What it does**: Simulates anamorphic lens characteristics — horizontal flare streaks, oval bokeh, subtle squeeze.
**Implementation**: `fusion` — Horizontal Glow + Defocus (anamorphic shape) + optional squeeze Transform
**Variants**:

| Variant | Flare Intensity | Bokeh Oval | Squeeze | Description |
|---------|----------------|------------|---------|-------------|
| subtle | 0.2 | Slight | None | Hint of anamorphic character |
| standard | 0.5 | Moderate | 1.1x | Classic anamorphic look |
| aggressive | 0.8 | Heavy oval | 1.33x | Bold scope lens feel |

**Pairs well with**: `letterbox-cinematic`, `teal-and-orange`, `lens-flare`, `film-grain-35mm`

---

### `prism`
**When to use**: trippy, psychedelic, kaleidoscope, fractured, disorienting, dream, hallucination, altered state
**What it does**: Faceted refraction splitting the image into prismatic copies.
**Implementation**: `fusion` — Multiple Transform + Merge (Screen/Add) with offset + ColorCorrector per copy
**Variants**:

| Variant | Copies | Offset | Tint | Description |
|---------|--------|--------|------|-------------|
| subtle | 2-3 | Small | Slight RGB | Gentle refraction |
| kaleidoscope | 4-6 | Medium | RGB split | Clear prismatic effect |
| fractal | 8+ | Large | Heavy | Full kaleidoscope |

**Pairs well with**: `chromatic-aberration`, `reverb-swell`, `slow-motion`, `saturated-boost`

---

### `heat-haze`
**When to use**: hot, desert, heat, summer, shimmer, asphalt, mirage, tropical, sweltering
**What it does**: Subtle rippling distortion simulating heat waves rising from a hot surface.
**Implementation**: `fusion` — Displace tool driven by animated FastNoise
**Variants**:

| Variant | Intensity | Speed | Region | Description |
|---------|-----------|-------|--------|-------------|
| subtle | 0.1 | Slow | Lower frame | Gentle ground shimmer |
| moderate | 0.25 | Medium | Lower half | Clear heat distortion |
| intense | 0.5 | Medium-fast | Full frame | Oppressive heat |

**Pairs well with**: `warm-shift`, `high-contrast`, `desaturation-partial`, `drone-hum`

---

### `underwater-distortion`
**When to use**: underwater, submerged, water, swimming, drowning, aquatic, ocean, pool
**What it does**: Rippling distortion with caustic light patterns simulating being underwater.
**Implementation**: `fusion` — Displace (wave pattern) + FastNoise (caustics) + Merge + ColorCorrector (blue/teal shift)
**Variants**:

| Variant | Distortion | Caustics | Color Shift | Description |
|---------|-----------|----------|-------------|-------------|
| shallow | Low | Visible | Slight teal | Just below the surface |
| deep | Medium | Faint | Strong blue | Deep underwater |
| murky | High | None | Dark green | Low visibility water |

**Pairs well with**: `muffled-audio`, `reverb-swell`, `slow-motion`, `cool-shift`

---

## 4. VISUAL — Camera Movement (Synthetic)

### `camera-shake`
**When to use**: impact, explosion, earthquake, crash, unstable, violent, intense, action, punch, hit
**What it does**: Simulated camera shake as if the camera was physically disturbed.
**Implementation**: `resolve-fx` — ResolveFX "Camera Shake"
**Variants**:

| Variant | Amplitude | Frequency | Decay | Description |
|---------|-----------|-----------|-------|-------------|
| subtle-handheld | 2px | Low | None | Gentle handheld imperfection |
| impact | 8px | High→Low | Fast | Single hit then settle |
| earthquake | 15px | Medium | Slow | Sustained heavy shake |
| explosion | 25px | High | Medium | Violent burst then fade |

**Pairs well with**: `bass-drop`, `flash-to-white`, `ear-ringing`, `freeze-frame`

---

### `handheld-shake`
**When to use**: documentary, raw, organic, handheld, real, gritty, verité, unsteady, natural
**What it does**: Continuous subtle camera instability simulating handheld shooting.
**Implementation**: `resolve-fx` — ResolveFX "Camera Shake" (low intensity, continuous)
**Variants**:

| Variant | Amplitude | Frequency | Description |
|---------|-----------|-----------|-------------|
| steady | 1px | Low | Barely noticeable breathing |
| natural | 3px | Low-medium | Clear handheld, not distracting |
| shaky | 6px | Medium | Aggressively handheld |

**Pairs well with**: `film-grain-16mm`, `desaturation-partial`, `room-tone`

---

### `dolly-zoom`
**When to use**: vertigo, unease, dread, realisation, disorientation, Hitchcock, revelation, world-shifting
**What it does**: Simultaneous zoom-in and scale-out (or reverse), causing the background to stretch/compress while the subject stays the same size.
**Implementation**: `fusion` — Animated Transform (scale) + animated DVE (zoom) in opposite directions
**Variants**:

| Variant | Direction | Speed | Description |
|---------|-----------|-------|-------------|
| push-pull | Zoom in + scale out | Slow | Classic Vertigo — background stretches |
| pull-push | Zoom out + scale in | Slow | Reverse — background compresses |
| fast-hit | Either | Fast | Quick jolt of unease |

**Pairs well with**: `tension-hum`, `heartbeat`, `cool-shift`, `vignette-animated`

---

### `smooth-push-in`
**When to use**: focus, intimate, dramatic, closing in, attention, emphasis, reveal, important moment
**What it does**: Slow, steady zoom into the frame. Draws attention and creates intimacy.
**Implementation**: `fusion` — Animated Transform (scale 1.0→1.15 over clip duration)
**Variants**:

| Variant | Scale Target | Speed | Description |
|---------|-------------|-------|-------------|
| subtle | 1.05 | Very slow | Barely perceptible push |
| standard | 1.12 | Slow | Clear push-in |
| dramatic | 1.25 | Medium | Bold closing in |

**Pairs well with**: `vignette-subtle`, `desaturation-partial`, `heartbeat`, `silence`

---

### `smooth-pull-out`
**When to use**: reveal, establishing, context, pulling back, wider picture, ending, departure, farewell
**What it does**: Slow zoom out from the frame. Reveals context or creates emotional distance.
**Implementation**: `fusion` — Animated Transform (scale 1.15→1.0)
**Variants**:

| Variant | Scale Start | Speed | Description |
|---------|------------|-------|-------------|
| subtle | 1.05 | Very slow | Gentle reveal |
| standard | 1.12 | Slow | Clear pull-back |
| dramatic | 1.3 | Medium | Bold reveal / departure |

**Pairs well with**: `ambient-fade-out`, `colour-drain`, `reverb-swell`

---

### `drift`
**When to use**: calm, floating, peaceful, gentle, lazy, drifting, contemplative, underwater, weightless
**What it does**: Slow, gentle lateral or vertical pan across the frame. Creates a floating, weightless quality.
**Implementation**: `fusion` — Animated Transform (X or Y center offset over time)
**Variants**:

| Variant | Direction | Speed | Amount | Description |
|---------|-----------|-------|--------|-------------|
| lateral-left | Left | Very slow | 3% | Gentle leftward drift |
| lateral-right | Right | Very slow | 3% | Gentle rightward drift |
| upward | Up | Very slow | 2% | Slow upward float |
| circular | Orbit | Very slow | 2% | Subtle circular path |

**Pairs well with**: `halation`, `slow-motion`, `reverb-swell`, `ambient-pad`

---

### `breathing`
**When to use**: alive, organic, pulse, subtle, tension, anticipation, heartbeat-visual, living
**What it does**: Subtle rhythmic scale pulse, as if the frame is breathing.
**Implementation**: `fusion` — Animated Transform (scale oscillating 1.0↔1.02 on sine wave)
**Variants**:

| Variant | Amplitude | Rate | Description |
|---------|-----------|------|-------------|
| calm | 0.01 | Slow (4s cycle) | Peaceful, meditative |
| anxious | 0.02 | Medium (2s cycle) | Tense, unsettled |
| rapid | 0.03 | Fast (1s cycle) | Panicked, hyperventilating |

**Pairs well with**: `heartbeat`, `vignette-animated`, `tension-hum`, `breathing-audio`

---

### `snap-zoom`
**When to use**: emphasis, beat hit, surprise, comedy, action, energy, bang, snap, sudden attention
**What it does**: Fast zoom-in on a beat or moment. Punchy and energetic.
**Implementation**: `fusion` — Animated Transform (fast scale 1.0→1.3→1.15 with overshoot)
**Variants**:

| Variant | Scale | Duration | Overshoot | Description |
|---------|-------|----------|-----------|-------------|
| subtle | 1.1 | 6 frames | Slight | Quick emphasis |
| punch | 1.25 | 4 frames | Moderate | Clear snap-in |
| extreme | 1.5 | 3 frames | Heavy | Aggressive slam zoom |

**Pairs well with**: `bass-drop`, `camera-shake`, `whoosh`, `flash-to-white`

---

### `rotation-tilt`
**When to use**: unease, drunk, disoriented, dutch angle, off-kilter, world tilting, surreal, dream
**What it does**: Slow angular rotation of the frame. Creates unease or surreal quality.
**Implementation**: `fusion` — Animated Transform (rotation)
**Variants**:

| Variant | Angle | Speed | Direction | Description |
|---------|-------|-------|-----------|-------------|
| subtle | ±3° | Very slow | CW or CCW | Slight unease |
| dramatic | ±8° | Slow | CW or CCW | Clear dutch tilt |
| full | 360° | Slow | Either | Complete rotation |

**Pairs well with**: `chromatic-aberration`, `desaturation-partial`, `tension-hum`, `heartbeat`

---

### `bounce-recoil`
**When to use**: impact, arrival, snap, energy, beat, drop, punch, land, slam
**What it does**: Quick positional snap with elastic overshoot, like a camera bouncing to rest.
**Implementation**: `fusion` — Animated Transform (position or scale with spring easing)
**Variants**:

| Variant | Displacement | Bounces | Duration | Description |
|---------|-------------|---------|----------|-------------|
| light | 5px | 2 | 8 frames | Gentle tap |
| medium | 12px | 3 | 12 frames | Clear impact settle |
| heavy | 25px | 4 | 18 frames | Aggressive slam bounce |

**Pairs well with**: `bass-drop`, `camera-shake`, `whoosh`, `snap-zoom`

---

## 5. VISUAL — Digital & Stylised

### `glitch-visual`
**When to use**: digital, error, corruption, broken, malfunction, hack, cyberpunk, distortion, disruption, tech failure
**What it does**: Digital artefacts — pixel displacement, block corruption, RGB channel offset, data moshing.
**Implementation**: `fusion` — ChannelBooleans + Transform (per-channel offset) + Mosaic (block pattern) + animated mask
**Variants**:

| Variant | Intensity | Frequency | Duration | Description |
|---------|-----------|-----------|----------|-------------|
| micro | Low | Rare | 1-2 frames | Subtle digital hiccup |
| moderate | Medium | Occasional | 3-5 frames | Clear glitch events |
| heavy | High | Frequent | Sustained | Aggressive data corruption |
| data-mosh | Extreme | Continuous | Full clip | Pixel smear / melt |

**Pairs well with**: `audio-glitch`, `chromatic-aberration`, `scan-lines`, `hard-cut-silence`

---

### `double-exposure`
**When to use**: artistic, dreamy, layered, ghostly, memory, overlap, two worlds, duality, contemplative
**What it does**: Two video layers composited together, creating a ghostly superimposition.
**Implementation**: `timeline-op` — Duplicate clip on V2 track + Composite mode (Screen/Add/Overlay) + opacity
**Variants**:

| Variant | Blend Mode | Opacity | Second Source | Description |
|---------|-----------|---------|---------------|-------------|
| ghost | Screen | 0.4 | Same clip (offset) | Self-ghosting, ethereal |
| overlay | Overlay | 0.5 | Different clip | Two scenes merged |
| silhouette | Screen | 0.6 | Nature/texture | Person filled with landscape |

**Pairs well with**: `halation`, `slow-motion`, `desaturation-partial`, `reverb-swell`

---

### `colour-channel-isolation`
**When to use**: Sin City, selective colour, pop, one thing stands out, dramatic isolation, noir with colour
**What it does**: Everything desaturated except one specific colour or colour range.
**Implementation**: `color-node` — Qualifier (select hue range) + node structure (desaturate outside qualifier)
**Variants**:

| Variant | Preserved Color | Desaturation | Description |
|---------|----------------|--------------|-------------|
| red-only | Reds | Full B&W | Sin City style — only red lives |
| warm-only | Warm tones | Full B&W | Only warm colours remain |
| single-object | Qualified range | Full B&W | One specific item in colour |
| faded-except | Selected hue | Partial desat | Everything muted except one colour |

**Pairs well with**: `high-contrast`, `vignette-heavy`, `film-grain-35mm`

---

### `silhouette`
**When to use**: dramatic, backlit, shadow, mysterious, iconic, profile, contour, noir, sunset
**What it does**: Crushes subject to pure black shape against a brighter background.
**Implementation**: `color-node` — Curves (crush shadows dramatically) + Lift (deep negative)
**Variants**:

| Variant | Crush | Background | Description |
|---------|-------|------------|-------------|
| partial | -0.3 lift | Preserved | Heavy shadow, some detail |
| full | -0.8 lift | Preserved | True black silhouette |
| rim-lit | -0.6 lift | Bright | Silhouette with edge light |

**Pairs well with**: `warm-shift`, `god-rays`, `letterbox-cinematic`, `musical-sting`

---

### `edge-detection`
**When to use**: sketch, outline, rotoscope, A-ha, stylised, animated, artistic, line drawing
**What it does**: Renders the image as detected edges — line drawing / sketch effect.
**Implementation**: `resolve-fx` — ResolveFX "Edge Detect" or "Stylize"
**Variants**:

| Variant | Threshold | Line Weight | Background | Description |
|---------|-----------|------------|------------|-------------|
| pencil | High | Thin | White | Clean pencil sketch |
| bold | Medium | Thick | Black | Bold ink outline |
| neon | Low | Medium | Black | Glowing edge lines |

**Pairs well with**: `full-desaturation`, `high-contrast`, `posterise`

---

### `posterise`
**When to use**: graphic, pop art, stylised, cartoon, flat colour, reduced, bold, comic, Warhol
**What it does**: Reduces colour steps creating flat, graphic areas of colour.
**Implementation**: `resolve-fx` — ResolveFX "Posterize" or `fusion` — CustomTool (quantize)
**Variants**:

| Variant | Levels | Description |
|---------|--------|-------------|
| subtle | 16 | Slightly stepped, still photographic |
| graphic | 8 | Clear flat colour areas |
| bold | 4 | Strong poster-like blocks |
| extreme | 2 | Near-binary, very graphic |

**Pairs well with**: `high-contrast`, `colour-channel-isolation`, `halftone-print`

---

### `mirror-symmetry`
**When to use**: surreal, dream, kaleidoscope, reflection, symmetry, Wes Anderson, abstract, trippy
**What it does**: Reflects the frame along an axis creating symmetrical composition.
**Implementation**: `resolve-fx` — ResolveFX "Mirror" or `fusion` — Transform (flip) + Merge
**Variants**:

| Variant | Axis | Description |
|---------|------|-------------|
| vertical | Left-right | Left half mirrored to right |
| horizontal | Top-bottom | Top half mirrored to bottom |
| quad | Both | Four-way symmetry |

**Pairs well with**: `prism`, `reverb-swell`, `slow-motion`, `drone-hum`

---

### `infrared`
**When to use**: surveillance, military, alien, otherworldly, false colour, thermal, predator vision
**What it does**: False-colour mapping simulating infrared or thermal camera output.
**Implementation**: `color-node` — Hue rotation + saturation push + custom curves + tint
**Variants**:

| Variant | Palette | Description |
|---------|---------|-------------|
| thermal | Red→Yellow→White heat map | Thermal camera look |
| night-vision | Green monochrome + noise | Military NV goggle look |
| false-colour | Psychedelic shifted hues | Alien / otherworldly palette |

**Pairs well with**: `scan-lines`, `camera-shake`, `static-noise`, `sonar-ping`

---

## 6. VISUAL — Environmental Overlays

### `dust-particles`
**When to use**: atmospheric, dusty, old room, sunbeam, shaft of light, floating, dreamy, abandoned, vintage
**What it does**: Floating dust motes visible in light, drifting slowly through the frame.
**Implementation**: `fusion` — pEmitter (particle system) with small white circles + Merge (Add/Screen)
**Variants**:

| Variant | Count | Size | Speed | Light Interaction | Description |
|---------|-------|------|-------|-------------------|-------------|
| sparse | 10-20 | Tiny | Slow drift | Subtle | Few floating motes |
| moderate | 30-50 | Small | Gentle | Moderate | Clear dust in light |
| dense | 80+ | Mixed | Active | Strong | Heavy atmospheric dust |

**Pairs well with**: `god-rays`, `halation`, `warm-shift`, `old-film`

---

### `rain-overlay`
**When to use**: rain, storm, wet, sad, melancholy, dramatic weather, downpour, moody
**What it does**: Rain streaks falling across the frame, optionally with lens droplets.
**Implementation**: `fusion` — pEmitter (directional streaks) + optional DropletsOnLens texture overlay
**Variants**:

| Variant | Intensity | Angle | Droplets | Description |
|---------|-----------|-------|----------|-------------|
| light | Low | Vertical | None | Gentle rain |
| moderate | Medium | Slight angle | Few | Steady rain |
| heavy | High | Angled | Many | Downpour with lens drops |
| windswept | High | Strong angle | Streaks | Driving rain |

**Pairs well with**: `cool-shift`, `desaturation-partial`, `rain-ambience`, `thunder`

---

### `snow-ash`
**When to use**: snow, winter, cold, ash, aftermath, nuclear, volcanic, gentle fall, Christmas, peaceful
**What it does**: Particles drifting downward — snow or ash depending on context.
**Implementation**: `fusion` — pEmitter (slow-falling particles, slight lateral drift)
**Variants**:

| Variant | Particle | Count | Speed | Description |
|---------|----------|-------|-------|-------------|
| light-snow | White, round | Low | Slow | Gentle snowfall |
| heavy-snow | White, varied | High | Medium | Blizzard conditions |
| ash | Grey, irregular | Medium | Very slow | Ash / embers falling |
| embers | Orange-red, glowing | Low | Slow rise | Rising sparks / embers |

**Pairs well with**: `cool-shift` (snow), `warm-shift` (embers), `slow-motion`, `ambient-pad`

---

### `smoke-fog`
**When to use**: atmospheric, mysterious, foggy, hazy, misty, moody, horror, ethereal, murky, dense atmosphere
**What it does**: Layers of smoke or fog drifting across the frame, reducing contrast in affected areas.
**Implementation**: `fusion` — FastNoise (cloud pattern, animated) + Merge (Screen/Add) + partial opacity
**Variants**:

| Variant | Density | Movement | Color | Description |
|---------|---------|----------|-------|-------------|
| light-haze | Low | Slow | White | Gentle atmosphere |
| fog | Medium | Slow | Grey-white | Misty, reduced visibility |
| smoke | Medium | Medium | Grey | Clear smoke wisps |
| dense-fog | High | Very slow | Grey-white | Heavy fog, low visibility |
| coloured | Medium | Slow | Tinted | Coloured atmospheric smoke |

**Pairs well with**: `desaturation-partial`, `god-rays`, `cool-shift`, `tension-hum`

---

### `confetti-petals`
**When to use**: celebration, joy, victory, romantic, wedding, festival, party, spring, cherry blossom
**What it does**: Small particles floating and tumbling — confetti, petals, leaves, or similar.
**Implementation**: `fusion` — pEmitter (shaped particles with rotation + flutter)
**Variants**:

| Variant | Shape | Count | Movement | Description |
|---------|-------|-------|----------|-------------|
| confetti | Rectangles, mixed colours | High | Tumbling fall | Celebration / party |
| petals | Ovals, pink/white | Medium | Gentle drift | Cherry blossom / romantic |
| leaves | Irregular, warm colours | Low | Slow spiral | Autumn leaves falling |
| fireflies | Small circles, warm glow | Low | Random float | Night-time magical lights |

**Pairs well with**: `warm-shift`, `slow-motion`, `halation`, `choir-pad`

---

## 7. VISUAL — Framing

### `vignette-subtle`
**When to use**: focus, subtle framing, attention to centre, gentle darkening, cinematic polish
**What it does**: Gentle darkening of frame edges drawing attention to the centre.
**Implementation**: `resolve-fx` — ResolveFX "Vignette"
**Parameters**: Size: 0.8, Softness: 0.7, Strength: 0.25
**Pairs well with**: almost anything — this is a finishing touch

---

### `vignette-heavy`
**When to use**: dramatic, tunnel vision, isolation, claustrophobic, noir, intense focus, old film
**What it does**: Strong darkening of frame edges, creating tunnel-vision focus.
**Implementation**: `resolve-fx` — ResolveFX "Vignette"
**Parameters**: Size: 0.5, Softness: 0.5, Strength: 0.6
**Pairs well with**: `high-contrast`, `desaturation-partial`, `heartbeat`, `tension-hum`

---

### `vignette-animated`
**When to use**: tension building, closing in, panic, narrowing focus, dream fading, consciousness
**What it does**: Vignette that animates tighter or looser over the clip duration.
**Implementation**: `fusion` — Ellipse mask + BrightnessContrast with animated mask size
**Variants**:

| Variant | Animation | Description |
|---------|-----------|-------------|
| closing | Wide→Tight | Tunnel closing in |
| opening | Tight→Wide | Vision clearing / waking up |
| pulse | Oscillating | Rhythmic tightening and releasing |

**Pairs well with**: `heartbeat`, `breathing`, `tension-hum`, `muffled-audio`

---

### `letterbox-cinematic`
**When to use**: cinematic, widescreen, scope, epic, film, dramatic, serious, prestige
**What it does**: Black bars top and bottom, changing the aspect ratio to a wider cinematic frame.
**Implementation**: `fusion` — Rectangle mask or `resolve-fx` — ResolveFX "Blanking Fill" / DVE crop
**Variants**:

| Variant | Aspect Ratio | Description |
|---------|-------------|-------------|
| mild | 2.0:1 | Slightly wider than 16:9 |
| scope | 2.39:1 | Classic anamorphic scope |
| ultra | 2.76:1 | Ultra-wide, Ben-Hur style |

**Pairs well with**: `anamorphic`, `film-grain-35mm`, `teal-and-orange`

---

### `letterbox-animated`
**When to use**: transition into/out of cinematic, aspect ratio shift, "things just got serious", drama escalation
**What it does**: Letterbox bars animate on or off during the clip.
**Implementation**: `fusion` — Animated Rectangle mask (bar height)
**Variants**:

| Variant | Animation | Description |
|---------|-----------|-------------|
| bars-on | 16:9 → 2.39:1 | Bars close in — escalation |
| bars-off | 2.39:1 → 16:9 | Bars open out — release |
| slam-on | Fast close | Sudden cinematic snap |

**Pairs well with**: `bass-drop` (slam), `tension-build` recipe, `desaturation-partial`

---

### `aspect-ratio-shift`
**When to use**: format change, social media crop, vertical video, square, different era/medium
**What it does**: Changes the visible frame area to a different aspect ratio.
**Implementation**: `fusion` — Rectangle mask + optional Background
**Variants**: 16:9, 9:16, 1:1, 4:5, 4:3, 2.39:1

**Pairs well with**: `scan-lines` (4:3 retro), `vhs-camcorder`, `old-film`

---

### `split-screen`
**When to use**: parallel action, comparison, before/after, multiple perspectives, phone call, dual narrative
**What it does**: Frame divided into sections showing multiple views simultaneously.
**Implementation**: `timeline-op` — Multiple video tracks + Fusion crop/position per track
**Variants**:

| Variant | Layout | Description |
|---------|--------|-------------|
| halves-vertical | Left/Right | Classic split down middle |
| halves-horizontal | Top/Bottom | Top and bottom split |
| thirds | Three columns | Triple perspective |
| quad | Four quadrants | Surveillance / multi-cam |
| pip | Main + small inset | Picture-in-picture |

**Pairs well with**: depends on content — often clean with minimal other effects

---

## 7b. VISUAL — Masking & Isolation

Masking effects isolate regions of the frame for targeted processing. These are both standalone effects and building blocks the planner should compose into more complex requests. When a user asks to affect "just the background", "only the sky", "everything except the person", "brighten her face", or describes any spatially selective treatment — masking is how it gets done.

### `subject-isolation`
**When to use**: isolate person, separate subject from background, subject pop, make them stand out, person stands out, subject brighter, subject sharper, hero shot enhancement, portrait isolation
**What it does**: Isolates the primary subject (person) from the background using Magic Mask, allowing independent processing of subject and background.
**Implementation**: `color-node` — Magic Mask (Person mode) on dedicated node; creates inside/outside regions for downstream grading
**Variants**:

| Variant | Subject Treatment | Background Treatment | Description |
|---------|------------------|---------------------|-------------|
| pop | +0.3 contrast, +5 sat | -15 sat, -0.1 exposure | Subject pops, background recedes |
| cinematic | Slight warm shift | Cool shift, -0.2 exposure | Filmic subject/bg separation |
| dreamy-bg | None | Gaussian blur 5px, -10 sat | Sharp subject, dreamy background |
| silhouette | -2.0 exposure | None | Subject becomes silhouette |
| glow | +0.1 exposure, soft edge | None | Subject gets soft radiance |

**Pairs well with**: `lens-blur`, `vignette`, `warm-shift`, `halation`
**Trigger phrases**: "make them pop", "separate from background", "subject stands out", "person brighter", "isolate the subject", "hero treatment"

---

### `background-treatment`
**When to use**: blur background, darken background, desaturate background, soften background, background out of focus, shallow depth, background less distracting, clean up background
**What it does**: Applies processing to everything except the primary subject — blur, exposure, saturation, colour shifts.
**Implementation**: `color-node` — Magic Mask (Person mode, inverted) or Power Window (inverted) for background-only grading
**Variants**:

| Variant | Effect | Amount | Description |
|---------|--------|--------|-------------|
| soft-focus | Blur | 5-8px | Background gently out of focus |
| deep-blur | Blur | 15-25px | Heavy background blur, portrait-style |
| darken | Exposure | -0.5 to -1.0 | Background pushed darker |
| desaturate | Saturation | -40 to -80% | Colour drained from background |
| cool-shift | Temperature | -15 to -25 | Background cooler, subject warmer by contrast |
| film-grain-bg | Grain + blur | Light | Background gets textured, subject stays clean |

**Pairs well with**: `subject-isolation`, `vignette`, `warm-shift`
**Trigger phrases**: "blur the background", "soften behind them", "background darker", "make the background less distracting", "fake shallow depth of field"

---

### `sky-enhancement`
**When to use**: sky more blue, sky more dramatic, darken sky, sunset sky, sky replacement prep, sky colour, more sky detail, sky contrast, sky too bright, blown sky
**What it does**: Targets the sky region for colour, exposure, or contrast adjustments using a gradient mask or qualifier.
**Implementation**: `color-node` — Linear Power Window (top region) or HSL Qualifier (blue range) on dedicated node
**Variants**:

| Variant | Adjustment | Description |
|---------|-----------|-------------|
| deepen-blue | +20 sat, -0.2 exposure on blue range | Richer, deeper blue sky |
| golden-hour | Warm temp +15, +10 sat on highlights | Golden sky enhancement |
| dramatic | +0.4 contrast, -0.3 exposure | Moody, heavy sky |
| recover-highlights | -0.5 highlights, +0.2 midtones | Pull back overexposed sky |
| sunset-boost | +25 orange sat, +10 red sat | Amplify sunset colours |
| overcast-mood | -10 sat, -0.1 exposure, slight blue | Lean into grey, moody sky |

**Pairs well with**: `high-contrast`, `warm-shift`, `cool-shift`, `cinematic-contrast`
**Trigger phrases**: "make the sky bluer", "sky is too bright", "more dramatic sky", "enhance the sunset", "sky looks blown out", "darken the sky"

---

### `face-lighting`
**When to use**: brighten face, face too dark, face underexposed, face shadowy, eye light, facial lighting, portrait lighting fix, face in shadow, talking head too dark
**What it does**: Brightens and refines lighting on faces using tracked circular Power Windows or Magic Mask face mode.
**Implementation**: `color-node` — Magic Mask (Face mode) or Circular Power Window (tracked) on dedicated node; raises midtones/highlights on face region
**Variants**:

| Variant | Exposure Lift | Colour | Tracking | Description |
|---------|--------------|--------|----------|-------------|
| subtle-lift | +0.2 midtones | None | Auto-track | Gentle face brightening |
| interview-fix | +0.4 midtones, +0.1 highlights | Slight warm | Auto-track | Fix underexposed interview |
| eye-light | +0.3 highlights, small window | None | Auto-track | Brighten eye area specifically |
| beauty | +0.2 midtones, -5 contrast | Slight warm, +5 sat | Auto-track | Flattering portrait light |
| fill-shadow | +0.5 shadows, +0.2 midtones | None | Auto-track | Fill in harsh shadows on face |

**Pairs well with**: `skin-tone-correct`, `warm-shift`, `subject-isolation`
**Trigger phrases**: "brighten their face", "face is too dark", "can't see their face", "face in shadow", "lighten the face", "interview is underexposed"

---

### `skin-tone-correct`
**When to use**: skin looks wrong, skin too orange, skin too red, skin colour off, fix skin tones, natural skin, skin too pale, skin too yellow, complexion
**What it does**: Corrects skin tones to natural range using HSL qualifier targeting skin hue range, with softness.
**Implementation**: `color-node` — HSL Qualifier (select skin tone range: hue 15-45°, sat 20-70%, lum 30-80%) on dedicated node; adjust hue/sat within selection
**Variants**:

| Variant | Adjustment | Description |
|---------|-----------|-------------|
| neutralise | Shift toward natural (hue 25-35°) | Fix colour cast on skin |
| warm | +5° hue, +5 sat | Healthy warm glow |
| cool-correct | -10° hue shift from orange toward natural | Fix overly warm/orange skin |
| even-out | Reduce sat variance within selection | Smooth uneven skin tones |
| under-fluorescent | Shift green out of skin tones | Fix sickly fluorescent lighting |

**Pairs well with**: `face-lighting`, `subject-isolation`, `warm-shift`
**Trigger phrases**: "skin looks off", "too orange", "fix the skin tones", "skin colour is wrong", "they look sickly"

---

### `selective-colour`
**When to use**: pop one colour, Sin City look, one colour stands out, selective colour, colour splash, red dress pops, make the blue stand out, colour isolation
**What it does**: Desaturates the entire frame except for a selected colour range, making that colour dramatically pop.
**Implementation**: `color-node` — Node 1: full desaturation; Node 2: HSL Qualifier (target hue range) with original saturation restored via layer mixer
**Variants**:

| Variant | Target Colour | Hue Range | Description |
|---------|--------------|-----------|-------------|
| red-pop | Red | 340-20° | Only reds remain — dramatic, intense |
| blue-pop | Blue | 190-250° | Only blues remain — cold, clinical |
| green-pop | Green | 80-160° | Only greens remain — nature, fresh |
| yellow-pop | Yellow/Gold | 40-70° | Only yellows/golds — warm, vintage |
| orange-pop | Orange | 20-45° | Only oranges — skin tones, warmth |
| custom | User-specified | Variable | Any hue range the user describes |

**Pairs well with**: `high-contrast`, `vignette`, `film-grain`
**Trigger phrases**: "only the red", "black and white except", "colour splash", "pop just the blue", "Sin City style", "one colour stands out"

---

### `gradient-mask`
**When to use**: top darker bottom brighter, graduated filter, sky/ground split, horizon line, ND grad, split tone top and bottom, darken top of frame
**What it does**: Applies a linear gradient across the frame for split processing — commonly used for sky/ground exposure balancing.
**Implementation**: `color-node` — Linear Power Window on dedicated node; feathered transition between treated and untreated regions
**Variants**:

| Variant | Direction | Effect | Description |
|---------|-----------|--------|-------------|
| sky-darken | Top-down | -0.5 exposure top | ND grad filter equivalent |
| ground-warm | Bottom-up | +10 temp bottom | Warm the foreground |
| horizon-contrast | Centre out | +0.3 contrast edges | Contrast falls off from centre |
| day-for-night-top | Top-down | -1.0 exposure, blue shift | Push sky toward night |
| split-tone | Top-down | Cool top, warm bottom | Complementary colour split |

**Pairs well with**: `sky-enhancement`, `cinematic-contrast`, `warm-shift`, `cool-shift`
**Trigger phrases**: "darken the top", "graduated filter", "sky is too bright but ground is fine", "ND grad", "split the exposure"

---

### `radial-focus`
**When to use**: focus on centre, draw attention, peripheral blur, iris effect, radial blur, centre sharp edges soft, spotlight, attention to subject
**What it does**: Creates a radial mask from centre (or custom point) outward, applying blur/darkening/desaturation to periphery.
**Implementation**: `fusion` — Ellipse mask + BrightnessContrast/Blur with soft edge; or `color-node` — Circular Power Window
**Variants**:

| Variant | Centre | Edge Effect | Softness | Description |
|---------|--------|-------------|----------|-------------|
| gentle | Frame centre | -0.2 exposure, blur 3px | 80% | Subtle attention draw |
| dramatic | Frame centre | -0.5 exposure, blur 8px, -20 sat | 60% | Strong isolation |
| off-centre | Custom point | -0.3 exposure, blur 5px | 70% | Focus on off-centre subject |
| spotlight | Subject position | Everything else -0.8 exposure | 50% | Theatrical spotlight |
| dreamy-peripheral | Frame centre | Blur 10px, +halation edge | 90% | Dreamy soft periphery |

**Pairs well with**: `vignette`, `lens-blur`, `subject-isolation`, `halation`
**Trigger phrases**: "draw focus to the centre", "blur the edges", "spotlight on them", "focus attention", "peripheral blur"

---

### `area-grade`
**When to use**: just that part, specific area, that corner, this section, region colour, patch of light, localised adjustment, spot correction
**What it does**: Applies colour/exposure grading to a specific freeform region using polygon or curve Power Windows.
**Implementation**: `color-node` — Polygon/Curve Power Window (tracked if needed) on dedicated node
**Variants**:

| Variant | Shape | Use Case | Description |
|---------|-------|----------|-------------|
| polygon | Custom polygon | Irregular shapes, signs, objects | Grade any shape |
| soft-circle | Circular, heavy feather | Pools of light, face areas | Soft circular correction |
| tracked-region | Any shape + tracking | Moving subjects or areas | Follows movement |
| highlight-patch | Small circle | Hot spots, reflections | Fix localised overexposure |
| shadow-fill | Custom shape | Dark corners, shadow areas | Lift specific shadows |

**Pairs well with**: any colour ingredient, `face-lighting`
**Trigger phrases**: "just that area", "fix that bright spot", "darken that corner", "that part is too blue", "localised fix"

---

### `edge-mask`
**When to use**: edge detection, outline only, edge glow, subject outline, edge highlight, contour, neon outline, traced edges
**What it does**: Detects edges in the frame and applies effects along them — glow, colour, darkening.
**Implementation**: `fusion` — CustomTool or EdgeDetect + BrightnessContrast + Merge (composite mode)
**Variants**:

| Variant | Edge Treatment | Background | Description |
|---------|---------------|------------|-------------|
| glow | Bright + blur on edges | Original | Edges glow subtly |
| neon | Coloured bright edges | Darkened | Neon outline effect |
| sketch | White edges | Black | Sketch/line drawing look |
| emboss | Raised edge shadow | Original | 3D embossed feel |
| outline-only | White edges | Transparent (composite) | Clean outline overlay |

**Pairs well with**: `high-contrast`, `colour-channel-isolation`, `halftone-print`
**Trigger phrases**: "outline the edges", "edge glow", "neon outline", "sketch look", "trace the edges"

---

### `object-highlight`
**When to use**: highlight this thing, make that object stand out, draw attention to the product, emphasise the item, feature the logo, object brighter
**What it does**: Isolates a specific object using Magic Mask (Object mode) or manual Power Window, then enhances it relative to surroundings.
**Implementation**: `color-node` — Magic Mask (Object mode) or tracked Power Window on dedicated node
**Variants**:

| Variant | Object Treatment | Surroundings | Description |
|---------|-----------------|--------------|-------------|
| brighten | +0.3 exposure, +10 sat | None | Object brighter and richer |
| pop | +0.2 contrast, +15 sat | -10 sat, -0.1 exposure | Object pops, surroundings recede |
| spotlight | +0.4 exposure | -0.4 exposure | Theatrical spotlight on object |
| colour-accent | +20 sat | Desaturate -60 | Object in colour, rest muted |
| warm-glow | +15 temp, +10 sat, soft edge | None | Object gets warm emphasis |

**Pairs well with**: `radial-focus`, `lens-blur`, `vignette`
**Trigger phrases**: "make that stand out", "highlight the product", "draw attention to", "emphasise the", "that object should pop"

---

### `mask-transition`
**When to use**: wipe reveal, iris transition, mask wipe, circular reveal, shape transition, custom wipe
**What it does**: Animated mask used as a transition between clips or to reveal content.
**Implementation**: `fusion` — Animated Ellipse/Rectangle/Polygon mask with keyframed size/position, used as merge mask between foreground/background
**Variants**:

| Variant | Shape | Animation | Description |
|---------|-------|-----------|-------------|
| iris-in | Circle | Centre out, 0→full | Classic iris-in reveal |
| iris-out | Circle | Full→centre, full→0 | Classic iris-out close |
| wipe-left | Rectangle | Right→left sweep | Horizontal wipe |
| wipe-down | Rectangle | Top→bottom sweep | Vertical wipe |
| diamond | Rotated rectangle | Centre out | Diamond-shape reveal |
| clock-wipe | Angle mask | 0°→360° sweep | Clock-hand wipe |

**Pairs well with**: works as standalone transition
**Trigger phrases**: "iris transition", "circle reveal", "wipe", "reveal with a shape", "iris in/out"

---

### `double-exposure-mask`
**When to use**: double exposure, blend two clips, overlay with mask, silhouette blend, ghost image, superimpose, composite
**What it does**: Composites two layers using masking to control where each is visible — classic double exposure technique.
**Implementation**: `timeline-op` + `fusion` — Duplicate to track 2, mask on top layer via Ellipse/Magic Mask, blend via composite mode (Screen/Add/Overlay)
**Variants**:

| Variant | Mask Source | Blend Mode | Description |
|---------|-----------|------------|-------------|
| silhouette-fill | Person outline | Screen | Landscape visible inside person silhouette |
| soft-blend | Gradient | Add | Two clips softly merged |
| face-nature | Face shape | Screen | Nature textures inside face |
| split-composite | Vertical split | Normal | Half-and-half frame |
| ghost | Full frame, low opacity | Screen | Transparent overlay, ghostly |

**Pairs well with**: `desaturation-partial`, `high-contrast`, `film-grain`
**Trigger phrases**: "double exposure", "blend the two", "overlay inside the silhouette", "ghost image", "superimpose"

---

### `text-mask`
**When to use**: text reveal through video, video inside text, text cutout, kinetic type mask, text filled with footage
**What it does**: Uses text shapes as masks so video plays through the letterforms.
**Implementation**: `fusion` — Text+ tool as mask input to Merge node; video plays through text shape
**Variants**:

| Variant | Text Style | Background | Description |
|---------|-----------|------------|-------------|
| clean-cutout | Bold sans-serif | Black/white | Clean video-in-text |
| grunge | Distressed serif | Textured | Raw, editorial feel |
| animated-reveal | Bold, animated position | Dark | Text slides in revealing video |
| outline-only | Outlined text (no fill) | Video | Outlined letterforms over video |

**Pairs well with**: `film-grain`, `high-contrast`, `letterbox`
**Trigger phrases**: "video inside text", "text cutout", "text reveal", "words filled with footage"

---

### Masking — Implementation Notes

**Priority order for mask selection** (the planner should prefer these in order):
1. **Magic Mask (Person)** — when isolating people. Most accurate, auto-tracked.
2. **Magic Mask (Object)** — when isolating non-person objects. Requires Resolve Studio.
3. **HSL Qualifier** — when targeting by colour (sky, skin tones, specific coloured objects). Fast, no tracking needed.
4. **Power Windows** — when targeting by position (top/bottom/centre/corners). Trackable.
5. **Fusion masks** — when doing custom shapes, animated masks, or compositing operations.

**Composability**: Masking effects are building blocks. The planner should freely combine them:
- "Make her pop against a blurred background" → `subject-isolation:pop` + `background-treatment:soft-focus`
- "Dramatic sky with warm subject" → `sky-enhancement:dramatic` + `subject-isolation:cinematic`
- "Focus on the product, blur everything else" → `object-highlight:spotlight` + `background-treatment:deep-blur`
- "Black and white except the red dress" → `selective-colour:red-pop`

---

## 8. MOTION INGREDIENTS

### `speed-ramp-up`
**When to use**: acceleration, energy build, getting faster, rush, momentum, escalation
**What it does**: Clip speed smoothly increases from normal to fast.
**Implementation**: `clip-property` — Retime curve or `resolve-fx` speed ramp
**Variants**:

| Variant | Start | End | Curve | Description |
|---------|-------|-----|-------|-------------|
| gentle | 100% | 200% | Ease-in | Gradual acceleration |
| aggressive | 100% | 400% | Linear | Quick ramp to fast |
| burst | 100% | 800% | Exponential | Explosive acceleration |

**Pairs well with**: `musical-riser`, `whoosh`, `vignette-animated`

---

### `speed-ramp-down`
**When to use**: impact, emphasis, dramatic moment, slowing down, focus, weight, landing
**What it does**: Clip speed smoothly decreases from normal to slow.
**Implementation**: `clip-property` — Retime curve
**Variants**:

| Variant | Start | End | Curve | Description |
|---------|-------|-----|-------|-------------|
| gentle | 100% | 50% | Ease-out | Gradual deceleration |
| dramatic | 100% | 25% | Ease-out | Strong slow-down |
| near-freeze | 100% | 10% | Exponential | Almost stops |

**Pairs well with**: `bass-drop`, `reverb-swell`, `desaturation-partial`, `vignette-heavy`

---

### `speed-ramp-in-out`
**When to use**: highlight moment, bullet-time, emphasis then release, action beat, impact then recover
**What it does**: Speed changes: fast→slow→fast or slow→fast→slow with a focal point.
**Implementation**: `clip-property` — Retime curve (S-curve or inverse S-curve)
**Variants**:

| Variant | Pattern | Focal Speed | Description |
|---------|---------|-------------|-------------|
| hero-moment | Fast→Slow→Fast | 25% | Slows for the key moment |
| whip-through | Slow→Fast→Slow | 300% | Rushes through transition |
| pulse | Normal→Slow→Normal | 50% | Brief slow emphasis |

**Pairs well with**: `whoosh`, `bass-drop`, `camera-shake`, `snap-zoom`

---

### `slow-motion`
**When to use**: dramatic, beautiful, emphasis, savour, emotional, graceful, powerful, weight, impact
**What it does**: Uniform slow playback speed throughout the clip.
**Implementation**: `clip-property` — Speed percentage
**Variants**:

| Variant | Speed | Optical Flow | Description |
|---------|-------|-------------|-------------|
| subtle | 75% | Optional | Slightly slowed, contemplative |
| half | 50% | Recommended | Classic slow motion |
| dramatic | 25% | Required | Very slow, highly dramatic |
| extreme | 10% | Required | Near-frozen, ultra-dramatic |

Note: Optical Flow interpolation (Resolve's Optical Flow retiming) should be enabled for speeds below 50% to avoid choppiness.

**Pairs well with**: `halation`, `warm-shift`, `reverb-swell`, `any grade`

---

### `fast-forward`
**When to use**: time passing, skip ahead, boring part sped up, montage, urgency, frenetic energy
**What it does**: Clip plays faster than normal.
**Implementation**: `clip-property` — Speed percentage
**Variants**:

| Variant | Speed | Description |
|---------|-------|-------------|
| slight | 150% | Subtly quickened |
| double | 200% | Clearly fast |
| timelapse | 500-2000% | Time-lapse compression |

**Pairs well with**: `clock-ticking`, `musical-riser`, `desaturation-partial`

---

### `freeze-frame`
**When to use**: pause, emphasis, dramatic stop, portrait, record scratch, comedic timing, title card moment
**What it does**: Playback holds on a single frame.
**Implementation**: `clip-property` — Speed 0% at specific frame, or razor edit + freeze
**Variants**:

| Variant | Duration | Additional | Description |
|---------|----------|------------|-------------|
| brief | 0.5-1s | None | Quick pause for emphasis |
| held | 2-3s | Optional push-in | Sustained dramatic hold |
| with-zoom | 1-2s | Smooth push-in | Freeze and slowly zoom |
| with-shake | 0.5s | Impact shake | Freeze with impact energy |
| to-bw | 1-2s | Desaturate snap | Freeze and drain colour |

**Pairs well with**: `bass-drop`, `record-scratch`, `desaturation-snap`, `camera-shake`

---

### `reverse-playback`
**When to use**: rewind, undo, time reversal, surreal, unsettling, rewinding time, going back
**What it does**: Clip plays in reverse.
**Implementation**: `clip-property` — Negative speed or reverse clip
**Pairs well with**: `audio-reverse`, `tape-warble`, `echo-delay`, `desaturation-partial`

---

### `stutter-rewind`
**When to use**: rewind-replay, emphasis through repetition, "wait, look at that again", glitch, DJ scratch
**What it does**: Clip stutters — plays forward, snaps back, replays. Like scratching a record.
**Implementation**: `timeline-op` — Razor edits creating short forward-reverse-forward segments
**Variants**:

| Variant | Repeats | Speed | Description |
|---------|---------|-------|-------------|
| single | 1 rewind | Normal | One "wait, rewatch that" |
| double | 2 rewinds | Increasing | Building emphasis |
| staccato | 3-4 rewinds | Fast | Machine-gun replay |

**Pairs well with**: `record-scratch`, `glitch-visual`, `audio-glitch`, `bass-drop`

---

### `strobe-skip`
**When to use**: high energy, choppy, music video, action, aggressive, punk, frenetic, staccato movement
**What it does**: Frames skipped at intervals creating choppy, stroboscopic motion.
**Implementation**: `clip-property` — Remove every Nth frame via speed adjustment or `fusion` — TimeStretcher
**Variants**:

| Variant | Keep Ratio | Description |
|---------|-----------|-------------|
| subtle | Every 2nd frame | Slightly choppy, 12fps feel |
| aggressive | Every 3rd frame | Clearly staccato |
| extreme | Every 4th-5th frame | Very choppy, stop-motion feel |

**Pairs well with**: `high-contrast`, `stroboscope`, `glitch-visual`, `bass-drop`

---

## 9. COLOUR INGREDIENTS

### `warm-shift`
**When to use**: golden hour, nostalgia, warmth, happy, cozy, memory, sunset, amber, comfortable, love
**What it does**: Shifts colour temperature warmer. Adds golden/amber tones.
**Implementation**: `color-node` — Temperature slider + optional Gain warm push
**Variants**:

| Variant | Temperature | Tint | Gain Offset | Description |
|---------|------------|------|-------------|-------------|
| subtle | +10 | 0 | Slight warm | Gentle warmth |
| golden-hour | +25 | +5 | Orange push | Classic golden hour |
| amber | +35 | +8 | Deep amber | Heavy warm cast |
| firelight | +40 | +10 | Orange-red | Candlelit / fireplace |

**Pairs well with**: `halation`, `film-grain-35mm`, `slow-motion`, `vignette-subtle`

---

### `cool-shift`
**When to use**: clinical, isolation, cold, night, moonlight, sterile, sad, lonely, tension, sci-fi, winter
**What it does**: Shifts colour temperature cooler. Adds blue/steel tones.
**Implementation**: `color-node` — Temperature slider + optional Gain blue push
**Variants**:

| Variant | Temperature | Tint | Gain Offset | Description |
|---------|------------|------|-------------|-------------|
| subtle | -10 | 0 | Slight blue | Gentle coolness |
| steel | -20 | -5 | Blue-grey | Cold, industrial |
| moonlight | -30 | +5 | Deep blue | Night / moonlit |
| ice | -40 | -10 | Cyan push | Frozen, extreme cold |

**Pairs well with**: `desaturation-partial`, `vignette-heavy`, `tension-hum`, `high-contrast`

---

### `full-desaturation`
**When to use**: black and white, monochrome, dramatic, timeless, noir, artistic, stark, somber, death
**What it does**: Complete removal of colour. Pure black and white.
**Implementation**: `color-node` — Saturation: 0
**Pairs well with**: `high-contrast`, `film-grain-35mm`, `vignette-heavy`

---

### `desaturation-partial`
**When to use**: muted, drained, subdued, washed out, faded, bleak, overcast, melancholy, memory fading
**What it does**: Reduces colour intensity without going fully monochrome.
**Implementation**: `color-node` — Saturation: 0.3-0.6
**Variants**:

| Variant | Saturation | Description |
|---------|-----------|-------------|
| slightly-muted | 0.7 | Just taking the edge off |
| drained | 0.4 | Clearly desaturated, colours still visible |
| nearly-mono | 0.15 | Almost B&W, ghost of colour |

**Pairs well with**: `bleach-bypass`, `cool-shift`, `film-grain-16mm`, `vignette-heavy`

---

### `saturation-boost`
**When to use**: vivid, vibrant, punchy, music video, energy, bold, colourful, pop, alive, celebration
**What it does**: Increases colour intensity for a more vivid, energetic look.
**Implementation**: `color-node` — Saturation: 1.3-1.6
**Variants**:

| Variant | Saturation | Description |
|---------|-----------|-------------|
| subtle | 1.2 | Slightly more vivid |
| punchy | 1.4 | Clearly boosted, music video feel |
| extreme | 1.7 | Over-saturated, stylised |

**Pairs well with**: `high-contrast`, `teal-and-orange`, `fast-forward`, `musical-sting`

---

### `bleach-bypass`
**When to use**: gritty, war, desaturated contrast, silver retention, harsh, raw, Saving Private Ryan, intense
**What it does**: High contrast with reduced saturation, simulating partial silver retention in film processing.
**Implementation**: `color-node` — Saturation: 0.3-0.5 + Contrast: +20 to +40 + slight Gamma crush
**Variants**:

| Variant | Saturation | Contrast Boost | Description |
|---------|-----------|---------------|-------------|
| light | 0.5 | +15 | Subtle bleach bypass |
| standard | 0.35 | +30 | Classic Saving Private Ryan |
| extreme | 0.15 | +50 | Harsh, aggressive |

**Pairs well with**: `film-grain-16mm`, `handheld-shake`, `camera-shake`, `desaturation-partial`

---

### `crush-blacks`
**When to use**: dramatic shadows, noir, moody, deep blacks, contrast, cinematic depth, rich
**What it does**: Deepens shadows by crushing the lower end of the tonal range.
**Implementation**: `color-node` — Lift: negative offset or Curves: pull shadows down
**Variants**:

| Variant | Crush Amount | Description |
|---------|-------------|-------------|
| subtle | Lift -0.02 | Slightly richer shadows |
| standard | Lift -0.05 | Clear black crush |
| aggressive | Lift -0.1 | Deep shadow clip, noir territory |

**Pairs well with**: `teal-and-orange`, `vignette-heavy`, `high-contrast`

---

### `lifted-shadows`
**When to use**: flat, airy, pastel, light, dreamy, fashion, soft, faded, washed, Instagram, lo-fi
**What it does**: Lifts shadows so blacks become dark grey. Creates a flat, faded look.
**Implementation**: `color-node` — Lift: positive offset or Curves: raise shadow point
**Variants**:

| Variant | Lift Amount | Description |
|---------|------------|-------------|
| subtle | Lift +0.02 | Slightly faded shadows |
| standard | Lift +0.05 | Clear lifted look |
| heavy | Lift +0.1 | Very flat, washed out shadows |

**Pairs well with**: `desaturation-partial`, `warm-shift`, `halation`, `film-grain-35mm`

---

### `high-contrast`
**When to use**: dramatic, punchy, bold, intense, powerful, stark, graphic, aggressive, impact
**What it does**: Increases contrast between lights and darks.
**Implementation**: `color-node` — Contrast: +15 to +40 or S-curve on Curves
**Variants**:

| Variant | Amount | Description |
|---------|--------|-------------|
| subtle | +10 | Slightly punchier |
| standard | +25 | Clearly high-contrast |
| extreme | +45 | Aggressive, almost clipping |

**Pairs well with**: `crush-blacks`, `desaturation-partial`, `bleach-bypass`, `vignette-heavy`

---

### `teal-and-orange`
**When to use**: cinematic, Hollywood, blockbuster, complementary, skin tone pop, commercial, big budget
**What it does**: Classic complementary colour grade — warm skin tones against cool shadows/backgrounds.
**Implementation**: `color-node` — Split toning: shadows→teal, highlights→warm + Curves (Hue vs Hue adjustment)
**Variants**:

| Variant | Intensity | Description |
|---------|-----------|-------------|
| subtle | Light push | Gentle complementary lean |
| standard | Moderate | Classic Hollywood grade |
| aggressive | Heavy | Bold, obvious colour split |

**Pairs well with**: `crush-blacks`, `film-grain-35mm`, `letterbox-cinematic`, `anamorphic`

---

### `cross-process`
**When to use**: lo-fi, experimental, fashion, shifted, alternative, indie, unexpected colour, editorial
**What it does**: Simulates cross-processing film in wrong chemicals — unpredictable colour shifts.
**Implementation**: `color-node` — Individual channel Curves manipulation (shift each RGB curve differently)
**Variants**:

| Variant | Character | Description |
|---------|-----------|-------------|
| warm-xpro | Yellow-green shadows, magenta highlights | Warm cross-process |
| cool-xpro | Cyan shadows, yellow highlights | Cool cross-process |
| punchy-xpro | High saturation, shifted all channels | Bold, vivid cross-process |

**Pairs well with**: `film-grain-35mm`, `saturation-boost`, `vignette-subtle`

---

### `film-stock-emulation`
**When to use**: specific film look, Kodak, Fuji, Agfa, analog colour, film matching, period accuracy
**What it does**: Emulates the colour response of specific film stocks using Color page node recipes.
**Implementation**: `color-node` — Multi-parameter grade per stock (no external LUT files required)
**Variants**:

| Variant | Stock | Node recipe |
|---------|-------|-------------|
| kodak-5219 | Kodak Vision3 500T | Temp: +15, Tint: +4, Lift: R+0.01 G-0.005 B+0.015 (magenta shadow), Gamma: warm nudge R+0.02, Gain: R+0.03 G+0.01 (warm highlights), Saturation: 1.1, Contrast: +8, Midtone Detail: -5 |
| kodak-5207 | Kodak Vision3 250D | Temp: +8, Tint: 0, Lift: neutral, Gamma: R+0.01 (slight warmth), Gain: R+0.015 G+0.01 B+0.005, Saturation: 1.05, Contrast: +5 |
| fuji-3510 | Fuji Eterna 500T | Temp: -8, Tint: +3, Lift: G+0.01 (green shadow), Gamma: neutral-cool, Gain: B+0.01 (cool highlights), Saturation: 0.9, Contrast: +3 |
| fuji-superia | Fuji Superia 400 | Temp: +5, Tint: +5, Lift: G+0.015 (green-shifted shadows), Gamma: G+0.01 (warm greens), Gain: R-0.01 (muted reds), Saturation: 0.95, Contrast: +5 |
| agfa-vista | Agfa Vista 200 | Temp: +12, Tint: +3, Lift: R+0.01 G+0.01 (yellow shadow), Gamma: warm, Gain: R+0.01 G+0.01 (yellow highlight), Saturation: 0.85, Contrast: -5 |
| portra-400 | Kodak Portra 400 | Temp: +6, Tint: +2, Lift: R+0.008 B-0.005 (warm shadow), Gamma: R+0.01 (skin warmth), Gain: neutral-warm, Saturation: 0.92, Contrast: -8, Shadow lift: +0.02 |
| ektar-100 | Kodak Ektar 100 | Temp: +3, Tint: 0, Lift: neutral, Gamma: neutral, Gain: R+0.02 B+0.01, Saturation: 1.35, Contrast: +15 |
| tri-x | Kodak Tri-X 400 | Saturation: 0, Contrast: +25, Lift: -0.03 (crush blacks), Gain: +0.05 (bright whites), Gamma: -0.02 (dense midtones), Midtone Detail: +10 |
| hp5 | Ilford HP5 Plus | Saturation: 0, Contrast: +10, Lift: -0.01, Gain: +0.02, Gamma: +0.01 (open midtones), Midtone Detail: +5 |

Each recipe is applied as a single Color page node. The bridge translates these into
`set_node_params()` calls. No external .cube files required.

**Pairs well with**: `film-grain-35mm`, `halation`, `vignette-subtle`

---

### `day-for-night`
**When to use**: fake night, simulated night, moonlight scene from daylight, low budget night, stylised night
**What it does**: Transforms daylight footage to appear as if shot at night.
**Implementation**: `color-node` — Strong exposure reduction + blue shift + contrast boost + desaturation
**Parameters**: Exposure: -2 to -3 stops, Temp: -40, Saturation: 0.4, Contrast: +20
**Pairs well with**: `moonlight-blue` (colour), `vignette-heavy`, `cool-shift`

---

### `sepia`
**When to use**: old, antique, western, vintage, aged, historical, period, faded photograph, memory
**What it does**: Warm monochrome toning simulating aged photographs.
**Implementation**: `color-node` — Desaturate + warm tint via Gain (slight orange/brown push)
**Variants**:

| Variant | Warmth | Contrast | Description |
|---------|--------|----------|-------------|
| light | Slight | Normal | Subtle aged tone |
| classic | Moderate | Slightly boosted | Traditional sepia |
| deep | Heavy | Boosted | Rich, dark sepia |

**Pairs well with**: `old-film`, `vignette-heavy`, `film-grain-35mm`

---

### `technicolor`
**When to use**: classic Hollywood, vivid, three-strip, saturated primaries, 1950s, musical, Wizard of Oz
**What it does**: Simulates three-strip Technicolor process — vivid, slightly unreal primary colours.
**Implementation**: `lut` — Technicolor emulation LUT or `color-node` — saturated primaries + specific curve shapes
**Pairs well with**: `film-grain-35mm`, `letterbox-cinematic`, `warm-shift`

---

### `noir`
**When to use**: detective, mystery, dark, shadowy, black and white, dramatic lighting, 1940s, femme fatale
**What it does**: High contrast black and white with deep shadows and bright highlights.
**Implementation**: `color-node` — Saturation: 0 + Contrast: +30 + Crush blacks + highlight roll-off
**Pairs well with**: `vignette-heavy`, `film-grain-35mm`, `venetian-blind-shadow`, `jazz-ambience`

---

### `neon-cyberpunk`
**When to use**: cyberpunk, neon, Blade Runner, futuristic, night city, electric, synthwave, purple-pink-teal
**What it does**: Saturated magentas, teals, and electric blues. Punchy, high-contrast, night-forward.
**Implementation**: `color-node` — Push magenta/teal split tone + saturation boost + contrast + crush blacks
**Pairs well with**: `scan-lines`, `lens-flare`, `chromatic-aberration`, `glitch-visual`

---

### `colour-pop`
**When to use**: transition from dull to vivid, reveal, world comes alive, awakening, turning point
**What it does**: Animated snap from desaturated to full colour (or reverse).
**Implementation**: `color-node` — Keyframed saturation: 0.1→1.0 (fast ramp)
**Variants**:

| Variant | Direction | Speed | Description |
|---------|-----------|-------|-------------|
| pop-in | Desaturated→Full | Fast (6-10 frames) | Colour snaps on |
| drain-out | Full→Desaturated | Fast (6-10 frames) | Colour snaps off |
| slow-bloom | Desaturated→Full | Slow (1-2 seconds) | Colour gradually returns |
| slow-drain | Full→Desaturated | Slow (1-2 seconds) | Colour gradually fades |

**Pairs well with**: `bass-drop` (pop-in), `silence` (drain-out), `reverb-swell`

---

### `colour-temperature-drift`
**When to use**: time of day change, emotional shift, subtle mood evolution, passage of time
**What it does**: Colour temperature slowly changes across the clip duration.
**Implementation**: `color-node` — Keyframed Temperature value
**Variants**:

| Variant | Start | End | Description |
|---------|-------|-----|-------------|
| warming | Cool | Warm | Dawn / hope arriving |
| cooling | Warm | Cool | Dusk / mood darkening |
| neutral-to-warm | Neutral | Warm | Comfort settling in |
| neutral-to-cool | Neutral | Cool | Tension creeping in |

**Pairs well with**: `vignette-animated`, `ambient-fade`, `slow-motion`

---

### `flash-to-white`
**When to use**: explosion, flashbang, bright impact, transition, memory flash, camera flash, divine light
**What it does**: Frame flashes to pure white then fades back (or sustains for transition).
**Implementation**: `fusion` — Merge with white Background, animated opacity spike
**Variants**:

| Variant | Duration | Decay | Description |
|---------|----------|-------|-------------|
| flash | 2-3 frames | Fast | Quick bright burst |
| sustained | 0.5s | Medium | Longer white-out |
| transition | 1s | Into next clip | White flash as scene change |

**Pairs well with**: `camera-shake`, `ear-ringing`, `bass-drop`, `explosion-aftermath`

---

### `flash-to-black`
**When to use**: blackout, unconsciousness, death, ending, cut to nothing, dramatic pause
**What it does**: Frame cuts or fades to pure black.
**Implementation**: `fusion` — Merge with black Background, animated opacity or `timeline-op` — Fade
**Variants**:

| Variant | Speed | Description |
|---------|-------|-------------|
| instant | 1 frame | Hard snap to black |
| fast | 6-10 frames | Quick fade |
| slow | 1-2 seconds | Gradual fade to black |

**Pairs well with**: `hard-cut-silence`, `heartbeat` (stopping), `reverb-tail`

---

## 10. AUDIO — Processing Effects

### `muffled-audio`
**When to use**: underwater, through a wall, distant, muted world, shock, dissociation, suffocation, pillow over ears
**What it does**: Low-pass filter rolls off high frequencies. World sounds distant and muffled.
**Implementation**: `audio-preprocess` — ffmpeg low-pass filter
**Variants**:

| Variant | Cutoff | Resonance | Description |
|---------|--------|-----------|-------------|
| slight | 4kHz | Low | Slightly dulled, through glass |
| moderate | 2kHz | Low | Clearly muffled, through a wall |
| heavy | 800Hz | Slight | Deep muffle, underwater feel |
| extreme | 400Hz | Moderate | Almost inaudible, deep underwater |

**Pairs well with**: `underwater-distortion`, `reverb-swell`, `slow-motion`, `halation`

---

### `tin-can-radio`
**When to use**: radio, walkie-talkie, intercom, old broadcast, communication device, transmission
**What it does**: Band-pass filter with slight distortion simulating audio through a small speaker.
**Implementation**: `audio-preprocess` — ffmpeg band-pass filter (500Hz-3kHz) + sox overdrive
**Variants**:

| Variant | Band | Distortion | Noise | Description |
|---------|------|-----------|-------|-------------|
| radio | 300-4kHz | Light | Static crackle | AM/FM radio |
| walkie-talkie | 500-3kHz | Moderate | Squelch | Two-way radio |
| intercom | 400-3.5kHz | Light | Hum | Building intercom |
| old-broadcast | 200-5kHz | Very light | Slight hiss | 1960s broadcast |

**Pairs well with**: `scan-lines`, `vignette-heavy`, `desaturation-partial`

---

### `phone-call`
**When to use**: phone conversation, call, mobile, telephone, other end of the line
**What it does**: Narrow bandwidth with slight digital artefacts simulating phone audio.
**Implementation**: `audio-preprocess` — ffmpeg band-pass filter (300Hz-3.4kHz) + sox overdrive
**Variants**:

| Variant | Quality | Description |
|---------|---------|-------------|
| mobile | Slightly compressed | Modern mobile call |
| landline | Narrow band, clean | Traditional telephone |
| bad-signal | Narrow + dropouts | Breaking up, poor connection |
| speakerphone | Wider band, room reverb | Speaker phone with room |

**Pairs well with**: `split-screen`, `aspect-ratio-shift`

---

### `ear-ringing`
**When to use**: explosion, loud noise, shell shock, tinnitus, after impact, disorientation, trauma, war
**What it does**: High-pitched ringing tone + ambient audio ducks and becomes muffled. Gradually returns to normal.
**Implementation**: `audio-preprocess` (muffle existing audio via ffmpeg low-pass) + `sfx-layer` (ringing tone)
**Parameters**:
- Existing audio: Low-pass at 600Hz, fading back to full over 3-8 seconds
- Ring layer: High sine tone (4-6kHz), starts loud, fades over same duration
- Optional: slight reverb on remaining audio

**Variants**:

| Variant | Duration | Ring Pitch | Recovery | Description |
|---------|----------|-----------|----------|-------------|
| brief | 2-3s | 5kHz | Fast | Short stun |
| standard | 5-8s | 4.5kHz | Gradual | Classic post-explosion |
| prolonged | 10-15s | 4kHz | Very slow | Severe trauma, war scene |

**Pairs well with**: `camera-shake`, `flash-to-white`, `desaturation-partial`, `slow-motion`

---

### `explosion-aftermath`
**When to use**: after explosion, blast wave, bomb, grenade, artillery, destruction, shell shock
**What it does**: Combined audio effect: initial bass concussion → ear ringing → muffled world → gradual return.
**Implementation**: `sfx-layer` (bass impact + ring) + `audio-preprocess` (EQ filtering via ffmpeg)
**Sequence**:
1. Bass concussion hit (0-0.2s)
2. All audio ducks to near-silence (0.2-0.5s)
3. High-pitched ring begins (0.3s)
4. Ambient audio returns slowly, heavily muffled (1-3s)
5. Frequencies gradually restore (3-10s)
6. Ring fades out (5-12s)

**Pairs well with**: `camera-shake`, `flash-to-white`, `slow-motion`, `desaturation-snap`, `dust-particles`

---

### `reverb-swell`
**When to use**: dreamy, cavernous, ethereal, vast space, memory, transcendent, spiritual, large room, cathedral
**What it does**: Adds reverberation that swells — either increasing wet signal or long tail.
**Implementation**: `audio-preprocess` — sox reverb (Room/Hall/Cathedral profiles)
**Variants**:

| Variant | Type | Wet/Dry | Decay | Description |
|---------|------|---------|-------|-------------|
| room | Room | 30% | 1s | Small room ambience |
| hall | Hall | 50% | 2.5s | Concert hall reverb |
| cathedral | Cathedral | 60% | 4s | Vast, spiritual space |
| infinite | Hall | 80% | 8s+ | Enormous, otherworldly |
| building | Animated | 20%→70% | Increasing | Reverb swells over time |

**Pairs well with**: `halation`, `slow-motion`, `warm-shift`, `choir-pad`

---

### `reverb-cut`
**When to use**: sudden clarity, snap back to reality, breaking out of a dream, contrast, grounding
**What it does**: Audio abruptly goes from reverberant/wet to completely dry.
**Implementation**: `audio-preprocess` — sox reverb with time-varying wet/dry: wet→dry at cut point
**Pairs well with**: `colour-pop`, `flash-to-black`, `hard-cut-silence`, `snap-zoom`

---

### `echo-delay`
**When to use**: psychedelic, spaced out, trippy, repeating, vast, canyon, shouting into void, memory echo
**What it does**: Audio repeats with decay — rhythmic echoes trailing the source.
**Implementation**: `audio-preprocess` — sox echo/delay filter
**Variants**:

| Variant | Delay Time | Feedback | Wet | Description |
|---------|-----------|----------|-----|-------------|
| slapback | 80-120ms | Low | 30% | Quick single repeat |
| rhythmic | 250-500ms | Medium | 40% | Musical echo pattern |
| vast | 800ms-1.2s | Medium-high | 50% | Grand canyon echo |
| infinite | 500ms | High (90%) | 60% | Self-sustaining echo buildup |

**Pairs well with**: `reverb-swell`, `slow-motion`, `prism`, `chromatic-aberration`

---

### `audio-slow-down`
**When to use**: time slowing, dramatic deceleration, stretching a moment, drugged, fading consciousness
**What it does**: Audio pitch drops and time-stretches, creating that "world slowing down" sound.
**Implementation**: `audio-preprocess` — sox pitch-shift (lower) + tempo-stretch
**Variants**:

| Variant | Pitch Drop | Speed | Description |
|---------|-----------|-------|-------------|
| subtle | -2 semitones | 75% | Slightly lowered, dreamy |
| dramatic | -5 semitones | 50% | Clearly slowed, heavy |
| extreme | -12 semitones | 25% | One octave down, near-frozen |

**Pairs well with**: `slow-motion`, `desaturation-partial`, `vignette-animated`, `halation`

---

### `audio-speed-up`
**When to use**: fast forward, frenetic, chipmunk, time compression, hyperactive, rewinding
**What it does**: Audio pitch rises and compresses, sounding sped-up.
**Implementation**: `audio-preprocess` — sox pitch-shift (raise) + tempo-compress
**Pairs well with**: `fast-forward`, `strobe-skip`, `high-contrast`

---

### `vinyl-crackle`
**When to use**: vintage, nostalgic, old record, gramophone, cozy, warm, lo-fi, analog
**What it does**: Adds vinyl record crackle, pops, and surface noise over the audio.
**Implementation**: `sfx-layer` — Vinyl noise loop from SFX library, mixed under at low volume
**Placement**: `throughout`
**Pairs well with**: `sepia`, `old-film`, `warm-shift`, `film-grain-35mm`

---

### `tape-warble`
**When to use**: VHS, cassette, tape degradation, 80s, retro, wow and flutter, old recording
**What it does**: Pitch wobbles simulating worn tape transport — wow and flutter.
**Implementation**: `audio-preprocess` — sox flanger (low rate, wow+flutter) + `sfx-layer` (tape hiss)
**Pairs well with**: `vhs-camcorder`, `scan-lines`, `warm-shift`

---

### `bit-crush`
**When to use**: digital lo-fi, retro gaming, 8-bit, glitch, robot, corrupted digital, lo-fi beats
**What it does**: Reduces audio bit depth and sample rate, creating crunchy digital artefacts.
**Implementation**: `audio-preprocess` — sox downsample + bit-depth reduction
**Variants**:

| Variant | Bit Depth | Sample Rate | Description |
|---------|-----------|-------------|-------------|
| subtle | 12-bit | 22kHz | Slightly crunchy |
| retro | 8-bit | 11kHz | Classic 8-bit character |
| extreme | 4-bit | 5.5kHz | Heavily crushed, barely recognisable |

**Pairs well with**: `glitch-visual`, `scan-lines`, `posterise`

---

### `phaser-flanger`
**When to use**: psychedelic, trippy, swirling, 70s, spacey, cosmic, jet flyby, underwater wavering
**What it does**: Sweeping comb filter creating a swirling, phasing sound.
**Implementation**: `audio-preprocess` — sox phaser/flanger filter
**Variants**:

| Variant | Rate | Depth | Feedback | Description |
|---------|------|-------|----------|-------------|
| gentle | Slow | Low | Low | Subtle swirl |
| classic | Medium | Medium | Medium | 70s psychedelic phase |
| jet | Slow | High | High | Jet engine flyby sweep |

**Pairs well with**: `prism`, `colour-temperature-drift`, `slow-motion`

---

### `audio-glitch`
**When to use**: digital error, broken, malfunction, stutter, skip, corrupt, robot breaking, system failure
**What it does**: Audio stutters, repeats, skips, or chops rhythmically — digital malfunction.
**Implementation**: `timeline-op` — Razor edits creating micro-repeats + `audio-preprocess` (bit-crush optional)
**Variants**:

| Variant | Pattern | Duration | Description |
|---------|---------|----------|-------------|
| stutter | Rapid repeat | 0.5-1s | Machine-gun stutter |
| skip | Jump cuts in audio | Sporadic | CD skip / buffer error |
| sustained | Glitch patterns | 2-5s | Extended digital breakdown |

**Pairs well with**: `glitch-visual`, `chromatic-aberration`, `flash-to-white`

---

### `stereo-manipulation`
**When to use**: immersion, disorientation, envelopment, width, spatial, panning, surround feel
**What it does**: Manipulates the stereo field — narrowing, widening, or panning audio.
**Implementation**: `audio-automation` — Pan controls via Resolve API (width via `audio-preprocess` if needed)
**Variants**:

| Variant | Width | Pan | Description |
|---------|-------|-----|-------------|
| mono-collapse | 0% | Centre | Flat, claustrophobic |
| narrow | 30% | Centre | Slightly constricted |
| wide | 150% | Centre | Expanded, immersive |
| drift-lr | Normal | Animated L→R | Audio drifts across field |

**Pairs well with**: `dolly-zoom`, `vignette-animated`, `muffled-audio`

---

### `ducking`
**When to use**: dialogue emphasis, voiceover, narration, music ducks under speech, focus on voice
**What it does**: Background audio/music volume dips when primary audio is present.
**Implementation**: `audio-automation` — Volume keyframe automation via Resolve API
**Pairs well with**: any scenario with dialogue over music/ambience

---

### `volume-swell`
**When to use**: building, rising, approaching, growing, intensity increasing, crescendo
**What it does**: Audio gradually rises from silence or low level to full volume.
**Implementation**: `audio-automation` — Volume keyframe ramp via Resolve API
**Variants**:

| Variant | Duration | Curve | Description |
|---------|----------|-------|-------------|
| quick | 0.5-1s | Linear | Fast fade-in |
| gradual | 2-4s | Ease-in | Smooth build |
| slow-build | 5-10s | Exponential | Long, dramatic swell |

**Pairs well with**: `musical-riser`, `speed-ramp-up`, `vignette-animated`

---

### `hard-cut-silence`
**When to use**: shock, impact, dramatic pause, after loudness, breath-holding, tension, void, death
**What it does**: Audio abruptly cuts to total silence. No fade, no tail. Just nothing.
**Implementation**: `audio-automation` — Volume keyframe instant drop to -inf via Resolve API
**Pairs well with**: `flash-to-black`, `freeze-frame`, `desaturation-snap`, `flash-to-white`

---

## 11. AUDIO — Layered Sound Design

These ingredients add NEW audio elements from the SFX library, layered on top of existing audio.

### `heartbeat`
**When to use**: tension, fear, anxiety, anticipation, alive, pulse, dread, intimate, counting down
**Implementation**: `sfx-layer` — Heartbeat loop from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | BPM | Volume | Description |
|---------|-----|--------|-------------|
| resting | 60 | Low, under mix | Calm, subtle presence |
| anxious | 90 | Medium | Clearly audible, tension |
| racing | 120+ | Prominent | Pounding, panicked |
| slowing | 80→40 | Fading | Dying, calming, ending |
| stopping | 70→0 | Medium→silence | Heart stops — death/shock |

**Pairs well with**: `vignette-animated`, `breathing`, `muffled-audio`, `slow-motion`

---

### `breathing-audio`
**When to use**: close, intimate, anxious, exhausted, panicked, suffocating, first-person, POV, survival
**Implementation**: `sfx-layer` — Close-mic breathing from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Pace | Character | Description |
|---------|------|-----------|-------------|
| calm | Slow, steady | Relaxed | Meditative, peaceful |
| anxious | Quick, shallow | Tense | Panic, anxiety |
| exhausted | Heavy, laboured | Winded | After exertion |
| held | Inhale then silence | Suspended | Breath-holding, anticipation |

**Pairs well with**: `heartbeat`, `smooth-push-in`, `vignette-animated`, `handheld-shake`

---

### `clock-ticking`
**When to use**: countdown, time running out, waiting, suspense, deadline, passage of time, impatience
**Implementation**: `sfx-layer` — Clock tick from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Speed | Character | Description |
|---------|-------|-----------|-------------|
| steady | Normal | Wall clock | Neutral time awareness |
| accelerating | Increasing | Any | Building urgency |
| loud | Normal | Close, prominent | Oppressive, inescapable |
| decelerating | Slowing | Any | Time stretching out |

**Pairs well with**: `vignette-animated`, `desaturation-partial`, `speed-ramp-down`

---

### `tension-hum`
**When to use**: dread, suspense, unease, something's wrong, horror, thriller, ominous, impending doom
**Implementation**: `sfx-layer` — Low drone/hum from SFX library (sustained synth or processed bass)
**Placement**: `throughout`
**Variants**:

| Variant | Pitch | Character | Description |
|---------|-------|-----------|-------------|
| low-drone | Sub-bass | Steady | Ominous rumble |
| building | Rising | Swelling | Increasing dread |
| pulsing | Low | Rhythmic throb | Throbbing menace |
| dissonant | Mixed | Discordant tones | Deeply unsettling |

**Pairs well with**: `cool-shift`, `vignette-heavy`, `desaturation-partial`, `smooth-push-in`

---

### `choir-pad`
**When to use**: angelic, heavenly, transcendent, spiritual, divine, revelation, epiphany, awe, majestic
**Implementation**: `sfx-layer` — Choir/pad synth from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Character | Swell | Description |
|---------|-----------|-------|-------------|
| ethereal | High, airy | Slow fade-in | Angelic, otherworldly |
| majestic | Full range | Building | Grand, awe-inspiring |
| dark | Low, minor | Sustained | Ominous, fallen angel |
| resolve | Major key | Peak then fade | Resolution, peace |

**Pairs well with**: `god-rays`, `halation`, `warm-shift`, `slow-motion`

---

### `musical-riser`
**When to use**: building tension, anticipation, approaching climax, countdown, about to happen, rising energy
**Implementation**: `sfx-layer` — Riser/swell from SFX library
**Placement**: `before-cut`
**Variants**:

| Variant | Duration | Character | Description |
|---------|----------|-----------|-------------|
| short | 1-2s | Quick sweep | Brief anticipation |
| medium | 3-5s | Building tone | Standard tension build |
| long | 8-15s | Slow evolving | Extended dramatic build |
| reverse-cymbal | 2-4s | Cymbal swell | Classic cinematic build |

**Pairs well with**: `speed-ramp-up`, `vignette-animated`, `letterbox-animated`, `colour-drain`

---

### `bass-drop`
**When to use**: impact, hit, drop, arrival, beat drop, title reveal, slam, explosion, heavy moment
**Implementation**: `sfx-layer` — Sub impact/drop from SFX library
**Placement**: `at-timestamp`
**Variants**:

| Variant | Character | Duration | Description |
|---------|-----------|----------|-------------|
| sub-hit | Deep sub | 0.5s | Quick sub bass punch |
| sustained | Sub + mid | 1-2s | Heavy sustained drop |
| boom | Explosive | 1s | Boom with decay |
| cinematic | Layered | 2-3s | Complex cinematic impact |

**Pairs well with**: `camera-shake`, `snap-zoom`, `flash-to-white`, `freeze-frame`, `letterbox-animated`

---

### `whoosh`
**When to use**: fast movement, transition, speed, passing, swipe, whip, energy, dynamic, fast cut
**Implementation**: `sfx-layer` — Whoosh from SFX library
**Placement**: `over-transition`
**Variants**:

| Variant | Direction | Speed | Description |
|---------|-----------|-------|-------------|
| rise | Up | Fast | Ascending sweep |
| fall | Down | Fast | Descending sweep |
| pass-by | L→R or R→L | Fast | Object passing |
| gentle | Any | Medium | Soft air movement |
| aggressive | Any | Very fast | Violent whip |

**Pairs well with**: `speed-ramp-up`, `whip-pan-blur`, `snap-zoom`, `fast-forward`

---

### `record-scratch`
**When to use**: comedy, "wait what", freeze frame comedy, breaking the fourth wall, sudden stop, punchline setup
**Implementation**: `sfx-layer` — Record scratch/needle lift from SFX library
**Placement**: `at-timestamp`
**Pairs well with**: `freeze-frame`, `flash-to-black`, `hard-cut-silence`

---

### `musical-sting`
**When to use**: reveal, dramatic beat, comedic beat, horror sting, important moment, punctuation
**Implementation**: `sfx-layer` — Musical sting from SFX library
**Placement**: `at-timestamp`
**Variants**:

| Variant | Character | Description |
|---------|-----------|-------------|
| dramatic | Orchestral hit | Big dramatic reveal |
| horror | Dissonant screech | Jump scare / dread |
| comedic | Quirky tonal | Funny moment punctuation |
| epic | Brass + percussion | Heroic / triumphant |
| suspense | Sustained string | Something's coming |

**Pairs well with**: `snap-zoom`, `freeze-frame`, `flash-to-white`, `camera-shake`

---

### `room-tone`
**When to use**: establishing atmosphere, spatial change, entering a space, quiet scene, realistic ambience
**Implementation**: `sfx-layer` — Room tone / ambience from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Environment | Description |
|---------|-------------|-------------|
| silent-room | Very quiet interior | Near-silence with subtle air |
| office | Indoor, climate control | HVAC hum, keyboard distance |
| cafe | Indoor, social | Murmur, clinking, activity |
| street | Outdoor, urban | Traffic, footsteps, city |
| nature | Outdoor, natural | Birds, wind, insects |
| industrial | Factory/warehouse | Machinery, echoes |

**Pairs well with**: any scene-setting — applied subtly under dialogue

---

### `crowd-ambience`
**When to use**: public space, event, party, stadium, gathering, busy, populated, social, audience
**Implementation**: `sfx-layer` — Crowd ambience from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Size | Energy | Description |
|---------|------|--------|-------------|
| murmur | Small group | Low | Quiet conversation hum |
| busy | Medium crowd | Medium | Active social setting |
| cheer | Large crowd | High | Stadium / celebration |
| gasp | Any | Sudden | Collective surprise |
| applause | Any | Positive | Clapping / ovation |

**Pairs well with**: relevant to scene — `warm-shift` (party), `cool-shift` (hostile crowd)

---

### `rain-ambience`
**When to use**: rain, storm, wet, moody, melancholy, cozy (indoors), dramatic (outdoors)
**Implementation**: `sfx-layer` — Rain ambience from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Intensity | Surface | Description |
|---------|-----------|---------|-------------|
| light | Gentle | General | Soft drizzle |
| steady | Medium | General | Consistent rain |
| heavy | Strong | General | Downpour |
| on-glass | Any | Window | Rain on window, interior feel |
| on-tin | Any | Metal roof | Rain on tin roof, cozy |
| thunder | Heavy | General + thunder | Thunderstorm |

**Pairs well with**: `rain-overlay`, `cool-shift`, `desaturation-partial`

---

### `thunder`
**When to use**: storm, dramatic, ominous, power, nature, god, epic, foreboding, dark sky
**Implementation**: `sfx-layer` — Thunder from SFX library
**Placement**: `at-timestamp`
**Variants**:

| Variant | Distance | Duration | Description |
|---------|----------|----------|-------------|
| distant-rumble | Far | Long roll | Far-off storm approaching |
| close-crack | Near | Sharp + roll | Close lightning crack |
| overhead | Very close | Massive boom | Directly above, powerful |

**Pairs well with**: `rain-ambience`, `flash-to-white` (lightning), `camera-shake`

---

### `wind-build`
**When to use**: approaching storm, desolation, exposed, cliff, mountaintop, tension in nature, cold
**Implementation**: `sfx-layer` — Wind ambience from SFX library (animated volume)
**Placement**: `throughout`
**Variants**:

| Variant | Strength | Character | Description |
|---------|----------|-----------|-------------|
| gentle | Low | Soft rustle | Light breeze |
| building | Low→High | Growing | Wind picking up |
| howling | High | Sustained | Strong sustained wind |
| gusting | Variable | Intermittent | Gusts and lulls |

**Pairs well with**: `cool-shift`, `camera-shake`, `desaturation-partial`, `dust-particles`

---

### `fire-crackle`
**When to use**: fireplace, campfire, warmth, cozy, destruction (large), burning, intimate night
**Implementation**: `sfx-layer` — Fire ambience from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Size | Description |
|---------|------|-------------|
| candle | Tiny | Subtle flicker audio |
| campfire | Small-medium | Crackling and popping |
| fireplace | Medium | Indoor hearth |
| inferno | Large | Roaring fire |

**Pairs well with**: `candlelight-flicker`, `warm-shift`, `embers` (snow-ash variant)

---

### `water-sounds`
**When to use**: water, ocean, lake, river, fountain, dripping, wet, aquatic, peaceful
**Implementation**: `sfx-layer` — Water ambience from SFX library
**Placement**: `throughout`
**Variants**:

| Variant | Type | Description |
|---------|------|-------------|
| drip | Single drops | Quiet, cave-like |
| stream | Flowing water | Babbling brook |
| waves | Ocean | Rhythmic shore break |
| underwater | Submerged | Muffled, pressured |
| splash | Impact | Single splash event |

**Pairs well with**: `underwater-distortion`, `cool-shift`, `slow-motion`

---

### `sonar-ping`
**When to use**: submarine, scanning, searching, radar, military, detection, sci-fi, locating
**Implementation**: `sfx-layer` — Sonar/radar ping from SFX library
**Placement**: `at-timestamp`
**Pairs well with**: `infrared`, `scan-lines`, `vignette-animated`, `cool-shift`

---

### `camera-shutter-sfx`
**When to use**: photo taken, screenshot, capture, snapshot, documentation, evidence, paparazzi
**Implementation**: `sfx-layer` — Camera shutter click from SFX library
**Placement**: `at-timestamp`
**Variants**:

| Variant | Type | Description |
|---------|------|-------------|
| single | One click | Single photo |
| burst | Rapid clicks | Burst mode / paparazzi |
| vintage | Mechanical | Old film camera |

**Pairs well with**: `freeze-frame`, `flash-to-white`, `polaroid`

---

### `glass-break`
**When to use**: impact, breaking, destruction, shatter, breakthrough, dramatic moment
**Implementation**: `sfx-layer` — Glass break from SFX library
**Placement**: `at-timestamp`
**Pairs well with**: `camera-shake`, `slow-motion`, `reverse-playback`

---

### `metal-clang`
**When to use**: impact, industrial, sword, shield, machinery, heavy hit, prison, metal door
**Implementation**: `sfx-layer` — Metal impact from SFX library
**Placement**: `at-timestamp`
**Pairs well with**: `camera-shake`, `reverb-swell`, `bass-drop`

---

### `door-slam`
**When to use**: dramatic exit, closure, anger, finality, horror, separation, trapped
**Implementation**: `sfx-layer` — Door slam from SFX library
**Placement**: `at-timestamp`
**Pairs well with**: `hard-cut-silence`, `reverb-cut`, `flash-to-black`

---

## 12. CINEMATIC TRANSITIONS

### `j-cut`
**When to use**: smooth scene transition, audio leads picture, building anticipation for next scene, professional edit
**What it does**: Next scene's audio begins before its video appears — audio leads the cut.
**Implementation**: `timeline-op` — Extend next clip's audio underneath current clip's video
**Pairs well with**: any natural scene transition

---

### `l-cut`
**When to use**: smooth scene exit, audio trails picture, lingering on last scene's sound, emotional carry-over
**What it does**: Previous scene's audio continues over the next scene's video — audio trails the cut.
**Implementation**: `timeline-op` — Extend previous clip's audio over next clip's video
**Pairs well with**: any emotional scene transition

---

### `match-cut-marker`
**When to use**: shape match, motion match, colour match between scenes, Kubrick, elegant editing
**What it does**: Places a marker indicating a match cut opportunity. Editor aligns visually similar frames.
**Implementation**: `marker` — Resolve marker (Blue) with note describing the match opportunity
Note: Match cuts require visual judgment — the AI identifies the opportunity, the editor executes.
**Pairs well with**: clean cuts, minimal effects

---

### `invisible-cut`
**When to use**: hidden edit, seamless transition, continuous shot illusion, Birdman, 1917
**What it does**: Cut hidden inside a whip pan, flash, or object passing across frame.
**Implementation**: `timeline-op` — Align cut point with motion blur or obstruction + `fusion` (motion blur overlay if needed)
**Variants**:

| Variant | Hiding Technique | Description |
|---------|-----------------|-------------|
| whip-pan | Blur during fast pan | Cut hidden in motion blur |
| flash | Bright light burst | Cut hidden in flash |
| object-wipe | Foreground object passes | Cut behind passing object |
| darkness | Black frame moment | Cut in shadow/darkness |

**Pairs well with**: `whoosh`, `camera-shake`, `flash-to-white`

---

### `iris-wipe`
**When to use**: classic, vintage, Hitchcock, circle reveal, spotlight, focus on subject, playful, retro
**What it does**: Circle opens or closes from/to a point, revealing or hiding the next/current scene.
**Implementation**: `fusion` — Ellipse mask with animated size, used as transition between clips
**Variants**:

| Variant | Direction | Description |
|---------|-----------|-------------|
| iris-in | Circle closes | Scene ends, circle closes to black |
| iris-out | Circle opens | New scene revealed from point |
| iris-custom | To/from subject | Circle centres on a person/object |

**Pairs well with**: `old-film`, `sepia`, `film-grain-35mm`

---

### `light-flash-transition`
**When to use**: energy, flashbang between scenes, bright transition, divine, explosive, high energy
**What it does**: Frame flashes white (or warm) as the transition between two clips.
**Implementation**: `fusion` — White/warm Background merge at transition point, fast in/out
**Variants**:

| Variant | Color | Duration | Description |
|---------|-------|----------|-------------|
| white | Pure white | 4-6 frames | Clean bright flash |
| warm | Golden/amber | 6-8 frames | Warm, organic flash |
| cool | Blue-white | 4-6 frames | Cold, clinical flash |

**Pairs well with**: `camera-shake`, `bass-drop`, `ear-ringing`

---

### `glitch-transition`
**When to use**: digital, modern, tech, cyber, energetic, edgy, corrupted, breaking between scenes
**What it does**: Digital glitch artefacts bridge the cut between two clips.
**Implementation**: `fusion` — ChannelBooleans + Mosaic + RGB offset at transition point
**Pairs well with**: `audio-glitch`, `bit-crush`, `chromatic-aberration`

---

### `film-burn-transition`
**When to use**: organic, warm, analog, end of reel, film projector, vintage, between memories
**What it does**: Film burn / light overexposure bridges the transition between clips.
**Implementation**: `fusion` — Animated FastNoise + Additive merge at transition point
**Pairs well with**: `film-grain-35mm`, `warm-shift`, `old-film`, `vinyl-crackle`

---

### `zoom-through-transition`
**When to use**: diving deeper, entering, pushing through, energetic, immersive, going into something
**What it does**: Camera zooms into the current frame until it blurs, then the next scene appears from the blur.
**Implementation**: `fusion` — Animated Transform (rapid scale-up + blur) into next clip (rapid scale-down from blur)
**Pairs well with**: `whoosh`, `bass-drop`, `speed-ramp-up`

---

### `morph-dissolve`
**When to use**: transformation, becoming, evolution, dream logic, surreal, fluid change, metamorphosis
**What it does**: Shapes in the outgoing clip morph/flow into shapes in the incoming clip. More organic than a cut.
**Implementation**: `fusion` — Morph Dissolve tool (if available) or long crossfade + displacement
**Pairs well with**: `reverb-swell`, `slow-motion`, `halation`

---

### `ripple-dissolve`
**When to use**: water, dream, memory, flashback entry, distortion transition, wavy, fluid
**What it does**: Image ripples like water before dissolving to next scene.
**Implementation**: `fusion` — Displace (concentric wave pattern) + Dissolve
**Pairs well with**: `reverb-swell`, `muffled-audio`, `halation`, `warm-shift`

---

### `pixelate-transition`
**When to use**: digital, retro gaming, 8-bit, pixelated, tech, censored, breaking down
**What it does**: Image pixelates (mosaic increases) then resolves into next scene.
**Implementation**: `fusion` — Animated Mosaic tool at transition point
**Pairs well with**: `bit-crush`, `glitch-visual`, `scan-lines`

---

## 13. PRE-COMPOSED RECIPES

Each recipe is a combination of ingredients designed to sell a specific narrative moment.
The LLM should use these as starting points, then adjust ingredient variants based on
the user's specific language and the clip context.

---

### Recipe: `happy-memory-flashback`
**Trigger phrases**: "happy memory", "remembering good times", "nostalgic flashback", "fond memory", "looking back warmly"
**Scope**: `primary` + `bookend_before: 1, bookend_after: 1` (contrast clips)
**Ingredients**:
- `halation` (standard) — dreamy glow
- `warm-shift` (golden-hour) — warm nostalgia
- `slow-motion` (half or subtle) — savouring the moment
- `film-grain-35mm` (standard) — analog warmth
- `lifted-shadows` (subtle) — soft, airy feel
- `vignette-subtle` — gentle focus
- `muffled-audio` (slight) — world slightly muted
- `reverb-swell` (room→hall) — spacious, dreamy audio
**Entry transition**: `ripple-dissolve` or `film-burn-transition`
**Exit transition**: `ripple-dissolve` or `flash-to-white`
**Bookend effects**: `desaturation-partial` (slightly-muted) — present day feels flatter by contrast

---

### Recipe: `traumatic-flashback`
**Trigger phrases**: "traumatic memory", "PTSD", "painful memory", "war flashback", "bad memory", "haunted by"
**Scope**: `primary`
**Ingredients**:
- `desaturation-partial` (drained) — colour drained from memory
- `high-contrast` (standard) — harsh, stark
- `camera-shake` (subtle-handheld) — instability
- `film-grain-16mm` (heavy) — gritty texture
- `vignette-heavy` — tunnel vision
- `flash-to-white` (flash) — intermittent bright flashes
- `ear-ringing` (brief, intermittent) — trauma response
- `heartbeat` (racing) — anxiety
- `breathing-audio` (anxious) — panicked breathing
**Entry transition**: `light-flash-transition` (white) — sudden, jarring
**Exit transition**: `flash-to-white` + `hard-cut-silence`

---

### Recipe: `dream-sequence`
**Trigger phrases**: "dream", "dreaming", "surreal", "dreamlike", "fantasy", "ethereal", "otherworldly"
**Scope**: `primary`
**Ingredients**:
- `halation` (heavy) — extreme glow
- `lens-blur` (dreamy-overall) — soft focus
- `slow-motion` (subtle to half) — floating pace
- `film-grain-35mm` (subtle) — texture
- `warm-shift` (subtle) or `cool-shift` (subtle) — depending on dream mood
- `drift` (lateral or circular) — floating camera
- `reverb-swell` (cathedral or infinite) — vast, spacious audio
- `muffled-audio` (moderate) — real world distant
- `echo-delay` (vast) — voices echo
**Entry transition**: `morph-dissolve` or `ripple-dissolve`
**Exit transition**: `flash-to-white` or abrupt cut + `reverb-cut`

---

### Recipe: `nightmare`
**Trigger phrases**: "nightmare", "bad dream", "terror", "night terror", "sleep horror", "dark dream"
**Scope**: `primary`
**Ingredients**:
- `chromatic-aberration` (moderate) — distorted reality
- `vignette-animated` (closing) — claustrophobic
- `cool-shift` (steel) — cold, threatening
- `high-contrast` (standard) — harsh shadows
- `breathing` (anxious) — visual and audio
- `camera-shake` (subtle-handheld) — instability
- `glitch-visual` (micro) — reality glitching
- `tension-hum` (building) — ominous drone
- `heartbeat` (racing) — panic
- `reverb-swell` (building) — growing unease
- `audio-slow-down` (subtle) — distorted perception
**Entry transition**: `glitch-transition` or `flash-to-black`
**Exit transition**: Hard cut + `hard-cut-silence` — waking up

---

### Recipe: `inner-monologue`
**Trigger phrases**: "thinking", "inner thoughts", "contemplating", "reflection", "internal dialogue", "lost in thought"
**Scope**: `primary`
**Ingredients**:
- `smooth-push-in` (subtle) — closing in on the subject
- `lens-blur` (background-soft) — world falls away
- `desaturation-partial` (slightly-muted) — world muted
- `vignette-subtle` — focus narrows
- `muffled-audio` (slight to moderate) — external world fades
- `reverb-swell` (room) — slight spaciousness on voice
- `ducking` — ambient audio drops under narration
**Entry**: gradual over 1-2 seconds
**Exit**: `reverb-cut` — snapping back to reality

---

### Recipe: `revelation-epiphany`
**Trigger phrases**: "realisation", "epiphany", "aha moment", "everything clicks", "it all makes sense", "the truth", "revelation"
**Scope**: `primary`
**Ingredients**:
- `colour-pop` (pop-in) — world snaps to vivid
- `snap-zoom` (punch) — sudden focus
- `bass-drop` (cinematic) — dramatic impact
- `musical-sting` (dramatic or epic) — punctuation
- `flash-to-white` (flash) — brief bright burst
- `halation` (subtle, after the flash) — afterglow of insight
- `reverb-cut` — sudden clarity
**Duration**: fast — the moment hits in under 1 second, afterglow lasts 2-3 seconds

---

### Recipe: `time-passage-hours`
**Trigger phrases**: "hours pass", "time passes", "later that day", "time lapse", "waiting", "the day wore on"
**Scope**: `primary` (multiple clips)
**Ingredients**:
- `fast-forward` (timelapse) — time compression
- `colour-temperature-drift` (warming or cooling) — time of day shift
- `clock-ticking` (steady or accelerating) — time awareness
- `dissolve transitions` between segments — smooth passage
**On select clips**: speed variation — some faster, some slower for rhythm

---

### Recipe: `time-passage-years`
**Trigger phrases**: "years later", "decades pass", "growing up", "aging", "long time ago", "over the years"
**Scope**: `primary` (multiple clips, segmented by era)
**Ingredients**:
- `desaturation-partial` (slightly-muted) on older segments — aged feel
- `film-grain-35mm` or `film-grain-16mm` — different era texture
- `colour-temperature-drift` — shifting era feel
- `warm-shift` (subtle) on past — nostalgia
- `film-stock-emulation` — different stock for different era
- `letterbox-animated` — aspect ratio shift between eras
- `vinyl-crackle` (on older segments) — period audio texture
**Transitions**: `film-burn-transition` or long dissolves

---

### Recipe: `montage-energy-build`
**Trigger phrases**: "montage", "training montage", "building up", "getting ready", "preparation", "progress sequence"
**Scope**: `primary` (multiple clips, progressive intensification)
**Ingredients**:
- `speed-ramp-up` (gentle→aggressive) — pacing increases
- `strobe-skip` (subtle) on later clips — increasing energy
- `high-contrast` (building) — punchier over time
- `saturation-boost` (building) — more vivid over time
- `musical-riser` (long) — building tension
- `whoosh` — on each cut
- `bass-drop` (sub-hit) — on final beat
**Pacing**: cuts get progressively shorter as energy builds

---

### Recipe: `impact-moment`
**Trigger phrases**: "impact", "hit", "punch", "crash", "slam", "collision", "bang", "the moment of impact"
**Scope**: `primary`
**Ingredients**:
- `freeze-frame` (with-shake) or `speed-ramp-down` (near-freeze) — time slows at impact
- `camera-shake` (impact or explosion) — physical jolt
- `bass-drop` (boom) — deep impact sound
- `flash-to-white` (flash) — bright burst
- `desaturation-partial` (drained) — momentary colour loss
- `snap-zoom` (punch) — sudden focus
**Duration**: 0.5-1 second for the hit, then 2-3 seconds for aftermath

---

### Recipe: `tension-build`
**Trigger phrases**: "tension building", "suspense", "something's coming", "dread", "slow burn", "ominous"
**Scope**: `primary` (multiple clips, progressive intensification)
**Ingredients**:
- `vignette-animated` (closing, slow) — world narrowing
- `cool-shift` (subtle→steel) — temperature dropping
- `smooth-push-in` (subtle) — closing in
- `desaturation-partial` (gradual) — colour slowly draining
- `tension-hum` (building) — rising drone
- `heartbeat` (resting→anxious) — pulse increasing
- `musical-riser` (long) — building tone
- `breathing-audio` (calm→anxious) — escalating breath
**Timing**: spreads across several clips, each layer intensifying

---

### Recipe: `tension-release`
**Trigger phrases**: "relief", "release", "it's over", "tension breaks", "exhale", "safe now", "crisis averted"
**Scope**: `primary`
**Ingredients**:
- `reverb-cut` — sudden audio clarity
- `colour-pop` (slow-bloom) — colour returns
- `vignette-animated` (opening) — vision expands
- `warm-shift` (subtle) — warmth returns
- `lifted-shadows` (subtle) — lighter feel
- `volume-swell` — ambient sound returns gently
**Timing**: the release moment is fast (0.5s), the settling takes 3-5 seconds

---

### Recipe: `horror-reveal`
**Trigger phrases**: "jump scare", "horror reveal", "the thing appears", "monster", "it's behind you", "shocking reveal"
**Scope**: `primary`
**Ingredients**:
- `snap-zoom` (extreme) — violent focus
- `camera-shake` (impact) — physical jolt
- `flash-to-white` or `flash-to-black` (instant) — brief disorientation
- `musical-sting` (horror) — dissonant screech
- `bass-drop` (boom) — impact
- `hard-cut-silence` (after sting, 0.5s) — terrifying quiet
- `vignette-heavy` (slam on) — tunnel vision
- `desaturation-partial` (drained, snap) — colour drains instantly
**Duration**: the reveal is 2-4 frames. The aftermath holds for 1-2 seconds.

---

### Recipe: `chase-action`
**Trigger phrases**: "chase", "running", "pursuit", "action sequence", "escape", "being chased", "fleeing"
**Scope**: `primary` (multiple clips, progressive pacing)
**Ingredients**:
- `handheld-shake` (shaky) — running camera
- `speed-ramp-in-out` (hero-moment on key beats) — emphasize moments
- `strobe-skip` (subtle) — choppy energy
- `high-contrast` (standard) — punchy visuals
- `whoosh` — on fast cuts
- `breathing-audio` (exhausted) — exertion
- `heartbeat` (racing) — pulse
- `musical-riser` (on tension moments) — building dread
**Pacing**: fast cuts, accelerating toward climax

---

### Recipe: `emotional-peak`
**Trigger phrases**: "emotional climax", "breaking down", "crying", "overwhelming emotion", "catharsis", "emotional peak"
**Scope**: `primary`
**Ingredients**:
- `slow-motion` (half or dramatic) — savouring the moment
- `halation` (standard) — soft, ethereal
- `warm-shift` (golden-hour) or `cool-shift` (moonlight) — depending on emotion
- `smooth-push-in` (standard) — closing in on subject
- `film-grain-35mm` (subtle) — texture
- `choir-pad` (ethereal or resolve) — emotional swell
- `reverb-swell` (hall) — spacious audio
- `volume-swell` — music builds
**Duration**: 5-15 seconds. Let it breathe.

---

### Recipe: `comic-beat`
**Trigger phrases**: "comedy", "funny moment", "punchline", "wait what", "awkward", "comedic timing"
**Scope**: `primary`
**Ingredients**:
- `freeze-frame` (brief) — comedic pause
- `snap-zoom` (subtle) — double-take emphasis
- `record-scratch` — classic comedy punctuation
- `hard-cut-silence` (brief) — comedic pause in audio
- `musical-sting` (comedic) — quirky tonal hit
**Duration**: timing is everything — the pause should be 0.5-1.5 seconds

---

### Recipe: `romantic-moment`
**Trigger phrases**: "romantic", "love", "intimate", "tender", "kiss", "falling in love", "connection"
**Scope**: `primary`
**Ingredients**:
- `halation` (standard to heavy) — soft, glowing
- `warm-shift` (golden-hour) — warm, inviting
- `slow-motion` (subtle) — savouring
- `lens-blur` (background-soft) — shallow focus, intimate
- `bokeh-overlay` (sparse) — magical lights
- `film-grain-35mm` (subtle) — texture
- `lifted-shadows` (subtle) — airy, light
- `vignette-subtle` — framing
- `choir-pad` (ethereal) or ambient pad — gentle swell
- `reverb-swell` (room) — intimate spaciousness

---

### Recipe: `loss-grief`
**Trigger phrases**: "loss", "grief", "death", "mourning", "funeral", "gone", "missing someone", "farewell"
**Scope**: `primary`
**Ingredients**:
- `desaturation-partial` (drained to nearly-mono) — colour leaving the world
- `slow-motion` (subtle) — weight of the moment
- `cool-shift` (steel or moonlight) — cold emptiness
- `vignette-heavy` — isolation
- `lifted-shadows` (subtle) — washed out, faded
- `film-grain-16mm` (standard) — textured grief
- `smooth-pull-out` (subtle) — pulling away, distance
- `reverb-swell` (cathedral) — vast emptiness
- `muffled-audio` (moderate) — world muted by grief
- `heartbeat` (slowing or stopping) — life fading

---

### Recipe: `victory-triumph`
**Trigger phrases**: "victory", "triumph", "we did it", "winning", "celebration", "achievement", "glory"
**Scope**: `primary`
**Ingredients**:
- `colour-pop` (pop-in) — vivid snap
- `warm-shift` (golden-hour) — golden triumph
- `saturation-boost` (punchy) — vivid world
- `halation` (subtle) — glowing
- `slow-motion` (half) — savouring victory
- `confetti-petals` (confetti) — celebration particles
- `god-rays` (standard) — dramatic light
- `choir-pad` (majestic) — triumphant swell
- `bass-drop` (cinematic) — impact at peak moment
- `crowd-ambience` (cheer) — celebration audio

---

### Recipe: `surreal-altered-state`
**Trigger phrases**: "surreal", "altered state", "drugs", "hallucinating", "intoxicated", "tripping", "fever dream"
**Scope**: `primary`
**Ingredients**:
- `prism` (subtle to kaleidoscope) — fractured vision
- `chromatic-aberration` (moderate to extreme) — distorted
- `colour-temperature-drift` — shifting colours
- `breathing` (visual, anxious) — pulsing frame
- `slow-motion` (subtle) mixed with `speed-ramp-in-out` — unstable time
- `lens-blur` (dreamy-overall) — soft focus
- `rotation-tilt` (subtle) — world tilting
- `echo-delay` (vast or infinite) — audio echoing
- `phaser-flanger` (classic) — swirling audio
- `reverb-swell` (infinite) — spacious, unmoored
- `audio-slow-down` (subtle) — pitch distortion

---

### Recipe: `underwater-scene`
**Trigger phrases**: "underwater", "submerged", "diving", "swimming", "drowning", "below the surface"
**Scope**: `primary`
**Ingredients**:
- `underwater-distortion` (variant by depth) — rippling image
- `cool-shift` (moonlight) — blue/teal colour cast
- `slow-motion` (subtle to half) — underwater drag
- `lens-blur` (dreamy-overall) — visibility reduction
- `dust-particles` (moderate) — suspended particles
- `muffled-audio` (heavy to extreme) — submerged hearing
- `reverb-swell` (cathedral) — underwater acoustics
- `water-sounds` (underwater) — bubbles, pressure
- `breathing-audio` (held or laboured) — if POV
- `vignette-heavy` — limited underwater vision

---

### Recipe: `surveillance-found-footage`
**Trigger phrases**: "surveillance", "CCTV", "found footage", "security camera", "hidden camera", "secret recording"
**Scope**: `primary` (multiple clips, uniform treatment)
**Ingredients**:
- `scan-lines` (crt-tv) — monitor lines
- `vhs-camcorder` (worn-tape) — tape quality
- `vignette-heavy` — camera lens vignette
- `barrel-distortion` (subtle) — wide-angle camera
- `desaturation-partial` (slightly-muted) — washed-out camera
- `high-contrast` (standard) — cheap camera contrast
- `film-grain-16mm` (heavy) — noise
- `timestamp overlay` via `marker` — "REC" indicator
- `tin-can-radio` — compressed audio
- `room-tone` (silent-room or industrial) — camera mic ambience

---

### Recipe: `historical-flashback`
**Trigger phrases**: "historical", "period", "back in time", "the past", "old days", "once upon a time"
**Scope**: `primary`
**Ingredients**:
- `film-stock-emulation` (era-appropriate stock) — period colour
- `film-grain-35mm` or `film-grain-16mm` — era texture
- `warm-shift` (subtle) or `sepia` — aged warmth
- `old-film` (light-age) — subtle damage
- `vignette-subtle` to `vignette-heavy` — era framing
- `aspect-ratio-shift` (4:3 for pre-widescreen) — period format
- `vinyl-crackle` or `tape-warble` — period audio texture
- `letterbox-cinematic` (for 50s-70s) — scope format
**Entry transition**: `film-burn-transition` or `ripple-dissolve`

---

### Recipe: `news-broadcast`
**Trigger phrases**: "news", "broadcast", "breaking news", "TV news", "report", "live from", "this just in"
**Scope**: `primary` (multiple clips, uniform treatment)
**Ingredients**:
- `aspect-ratio-shift` (16:9 or 4:3) — broadcast format
- `scan-lines` (subtle) — broadcast feel
- `high-contrast` (subtle) — broadcast grading
- `tin-can-radio` (old-broadcast variant) — broadcast audio
- `desaturation-partial` (slightly-muted) — news colour palette
- `camera-shake` (subtle-handheld) — news camera
**Optional**: lower-third title card overlay (via Fusion Text+)

---

### Recipe: `social-media-screen`
**Trigger phrases**: "social media", "phone screen", "Instagram", "TikTok", "scrolling", "notification"
**Scope**: `primary`
**Ingredients**:
- `aspect-ratio-shift` (9:16 or custom) — phone format
- `saturation-boost` (subtle) — social media colour
- `high-contrast` (subtle) — phone screen look
- `vignette-subtle` — screen edge
- Potential split-screen or PIP for reaction format

---

### Recipe: `opening-hook`
**Trigger phrases**: "cold open", "hook", "opening", "grab attention", "first impression", "teaser"
**Scope**: `primary` (first 1-3 clips)
**Ingredients**:
- `letterbox-animated` (bars-on, slow) — establishing cinematic frame
- `smooth-push-in` (dramatic) — pulling viewer in
- `desaturation-partial` (drained) → `colour-pop` (slow-bloom) — building to reveal
- `musical-riser` (medium) — building anticipation
- `bass-drop` (cinematic) — on title/reveal
- `teal-and-orange` (standard) — commercial cinematic grade
**Timing**: 5-10 seconds of build, then the hit

---

### Recipe: `chapter-transition`
**Trigger phrases**: "new chapter", "next section", "part two", "meanwhile", "transition to"
**Scope**: `primary` + `bookend_before: 1, bookend_after: 1`
**Ingredients**:
- `flash-to-black` (slow) + `flash-to-black` exit (slow) — bookend fade
- `colour-temperature-drift` — mood shift between chapters
- `hard-cut-silence` (1-2 seconds) — clean pause
- Optional: `letterbox-animated` (bars-off then bars-on) — resetting the frame
**Timing**: 2-4 seconds of black/quiet between chapters

---

### Recipe: `closing-farewell`
**Trigger phrases**: "ending", "farewell", "goodbye", "closing", "the end", "final moment", "wrapping up"
**Scope**: `primary` (final 1-3 clips)
**Ingredients**:
- `slow-motion` (subtle) — savouring the end
- `warm-shift` (subtle to golden-hour) — warmth of conclusion
- `desaturation-partial` (slow-drain) — fading
- `halation` (building) — growing glow
- `smooth-pull-out` (dramatic) — pulling away
- `vignette-animated` (subtle closing) — frame narrowing
- `flash-to-black` (slow) — final fade
- `reverb-swell` (building to cathedral) — audio opens up
- `volume-swell` then gradual fade — music swells then fades
- `vinyl-crackle` (if nostalgic) — warm ending texture

---

### Recipe: `end-credits`
**Trigger phrases**: "credits", "end credits", "rolling credits", "credits roll"
**Scope**: `global` (appended after final clip)
**Ingredients**:
- `flash-to-black` (slow) — transition to credits
- `letterbox-cinematic` (scope) — cinematic framing
- `film-grain-35mm` (subtle) — texture over black
- Background: black or `desaturation-partial` (heavy) on final shot
- Text overlay via Fusion Text+ — scrolling or static credits
- Music: full track, slowly fading in final 15 seconds

---

## 14. INTERACTIVE EFFECT DISCOVERY

When a user's request is vague (step 1 in the decision hierarchy), the chat must help them
narrow down what they want. Never guess — always ask. One question at a time, each with
a visual description and a recommendation.

### Trigger conditions

A request is vague when it contains ONLY mood/quality words without naming a specific
technique, moment, or reference:

**Vague** (triggers discovery): "make it cinematic", "make it look good", "add some style",
"clean this up", "make it professional", "make it pop", "add some flair", "punch it up",
"it needs something", "can you make this better"

**Not vague** (skip discovery): "add a flashback effect", "make it look like a dream",
"slow this down", "add film grain", "I want a horror jump scare feel"

### Discovery flow

The chat walks the user through narrowing questions, one at a time, each with options
and a recommendation. The flow adapts based on answers.

#### Step 1: Category

> **What kind of improvement are you going for?**
>
> **A) Visual style** — Change the look: colour, texture, grain, glow, lens effects
> **B) Mood & atmosphere** — Set a feeling: tension, warmth, nostalgia, dread, energy
> **C) Pacing & rhythm** — Change the feel of time: slow-motion, speed ramps, montage energy
> **D) Sound design** — Audio layers: ambient sounds, impacts, risers, atmospheric audio
> **E) Narrative moment** — A storytelling beat: flashback, dream, revelation, chase, climax
>
> *I'd recommend starting with **B) Mood & atmosphere** — that usually has the biggest
> impact on how the edit feels.*

#### Step 2: Narrow within category

Each category branches into 3-5 options. Examples:

**If Mood & atmosphere:**
> **What feeling are you going for?**
>
> **A) Warm & nostalgic** — Golden tones, soft glow, analog texture. Feels like a fond memory.
> **B) Cool & tense** — Steel blues, shadows, tight framing. Something's coming.
> **C) Energetic & punchy** — High contrast, fast cuts, saturated. High energy.
> **D) Dreamy & ethereal** — Soft focus, floating pace, airy. Otherworldly.
> **E) Dark & gritty** — Heavy grain, crushed blacks, raw. No polish.
>
> *Based on your footage, I'd suggest **A) Warm & nostalgic** — your clips have
> natural warmth that would lean into nicely.*

**If Visual style:**
> **What look are you after?**
>
> **A) Film look** — Grain, colour shifts, analog character. Like it was shot on film.
> **B) Clean & cinematic** — Letterboxing, teal-and-orange, polished. Blockbuster feel.
> **C) Vintage / retro** — VHS, Super 8, old film. A specific era.
> **D) Stylised / experimental** — Glitch, double exposure, neon. Art-forward.
> **E) Natural but elevated** — Subtle grading, gentle vignette, light texture. Better but not obvious.
>
> *I'd go with **E) Natural but elevated** — keeps your footage authentic while
> lifting the production value.*

#### Step 3: Intensity

> **How strong should the effect be?**
>
> **A) Subtle** — Barely noticeable. The viewer feels it more than sees it.
> **B) Moderate** — Clearly present but not distracting. Professional standard.
> **C) Heavy** — Obvious and intentional. Makes a statement.
>
> *I'd recommend **B) Moderate** — strong enough to notice, not so strong it
> takes over the edit.*

#### Step 4: Confirmation

After 3 questions, the LLM has enough to compose an effect stack. It presents the
proposed stack before applying:

> **Here's what I'll apply to clips 3-5:**
>
> - Warm colour shift (golden-hour, moderate)
> - Halation glow (standard)
> - Film grain 35mm (subtle)
> - Gentle vignette
> - Slight audio reverb
>
> **This gives a warm, nostalgic feel — like a fond memory captured on film.**
>
> ✅ Apply this | 🔄 Adjust something | ❌ Start over

### Contextual adaptation

The LLM should factor in what it already knows:
- If clips already have effects, mention them: "These clips already have a cool shift — 
  warm & nostalgic would conflict. Want me to replace it, or go a different direction?"
- If the user has applied similar effects elsewhere in the timeline, reference that:
  "You used a dream look on clips 1-2 — want this to match, or contrast?"
- If the clip has specific visual content (detected during vision analysis), use that:
  "Your clips are mostly outdoor/natural light — a film look would complement that nicely."

---

## 15. APPLIED EFFECTS UI

When effects have been applied to clips, the user needs a clear, visual way to see, manage,
adjust, and undo them. This is NOT a chat-only interface — it's a dedicated UI panel.

### Effects panel layout

The Applied Effects panel appears in the Polish phase as a sidebar or overlay when a clip
with effects is selected. It shows every effect currently on the clip, grouped by type.

```
┌─────────────────────────────────────────────────┐
│  Applied Effects — Clip 3 "sunset-walk.mp4"     │
│                                                 │
│  ┌─ Visual ──────────────────────────────────┐  │
│  │  ○ Halation (standard)          [⟲] [✕]  │  │
│  │    Gain: 0.6  Blend: 0.5  Glow: 15       │  │
│  │  ○ Film Grain 35mm (subtle)     [⟲] [✕]  │  │
│  │    Amount: 0.3  Size: Fine                │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Colour ──────────────────────────────────┐  │
│  │  ○ Warm Shift (golden-hour)     [⟲] [✕]  │  │
│  │    Temperature: +15  Tint: +5             │  │
│  │  ○ Vignette (subtle)            [⟲] [✕]  │  │
│  │    Size: 0.8  Softness: 0.7               │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Audio ───────────────────────────────────┐  │
│  │  ○ Reverb Swell (hall)          [⟲] [✕]  │  │
│  │    Wet: 50%  Decay: 2.5s                  │  │
│  │  ○ Muffled Audio (slight)       [⟲] [✕]  │  │
│  │    Cutoff: 4kHz                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ SFX Layers ──────────────────────────────┐  │
│  │  ○ Heartbeat (anxious)          [⟲] [✕]  │  │
│  │    BPM: 90  Volume: -12dB                 │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [↶ Undo last]  [↶↶ Undo all]  [+ Add effect]  │
└─────────────────────────────────────────────────┘
```

### Per-effect controls

Each effect row in the panel supports:

| Control | Action | UI element |
|---------|--------|-----------|
| **Hover preview** | Shows before/after thumbnail comparison on hover | Tooltip with split-view thumbnail |
| **Variant selector** | Switch between subtle/standard/heavy | Dropdown on the effect name |
| **Parameter adjust** | Tweak individual parameters | Inline number inputs with +/- steppers |
| **Bypass toggle** | Temporarily disable without removing | Click the effect dot (○ → ◌) |
| **Remove** | Delete this effect | [✕] button with confirmation |
| **Undo** | Revert to before this effect was applied | [⟲] button |
| **Reorder** | Drag to change application order | Drag handle on left edge |

### Hover preview behaviour

When the user hovers over an effect row:
1. A small tooltip appears showing a thumbnail of the clip at its midpoint
2. The thumbnail shows a split-view: left half without this effect, right half with it
3. The split line has a subtle dotted border and labels ("Without" / "With")
4. Tooltip follows the cursor vertically, stays beside the panel horizontally
5. Preview generates from the Resolve bridge via `render_still(clip_index, frame, effects_mask)`

### Undo system

The effects panel maintains an undo stack per clip:

| Button | Behaviour |
|--------|-----------|
| **[⟲] per effect** | Removes that specific effect and restores the clip to its state before that effect was added |
| **[↶ Undo last]** | Removes the most recently applied effect (standard undo) |
| **[↶↶ Undo all]** | Strips all effects from the clip, restoring the raw state |

Undo calls the bridge's `remove_effect(clip_index, effect_id)` command and updates the
local effect state.

### Batch operations

When multiple clips are selected:
- The panel shows effects common to ALL selected clips
- Removing an effect removes it from all selected clips
- "Apply to all" button appears when viewing a single clip's effects
- "Copy effects" and "Paste effects" for transferring between clips

### Effect state in store

The app store tracks applied effects per clip:

```typescript
interface AppliedEffect {
  id: string
  ingredientId: string        // e.g. 'halation'
  variant: string             // e.g. 'standard'
  parameters: Record<string, number | string>
  appliedAt: string           // ISO timestamp for undo ordering
  bypassed: boolean
}

// In the store:
appliedEffects: Record<string, AppliedEffect[]>  // keyed by storyboard clip id
```

### Chat integration

The chat and the panel stay in sync:
- When the user applies effects via chat, they appear in the panel immediately
- When the user removes/adjusts via the panel, the chat logs a system message:
  "Removed halation from clip 3" / "Adjusted warm-shift intensity to heavy on clip 3"
- The user can reference effects from the panel in chat: "make that halation stronger"
  — the LLM reads the current effects state and modifies in place

### Bridge commands for effect management

These commands support the UI panel:

- `get_clip_effects_state(clip_index)` — Returns all effects on a clip
- `remove_effect(clip_index, effect_id)` — Removes a specific effect
- `update_effect_param(clip_index, effect_id, param, value)` — Updates a single parameter
- `bypass_effect(clip_index, effect_id, bypassed)` — Toggles effect bypass
- `render_still(clip_index, frame, effects_mask)` — Renders a frame with/without specific effects (for hover preview)
- `reorder_effects(clip_index, effect_ids[])` — Changes effect processing order

---

## 16. BRIDGE COMMANDS NEEDED

To implement this catalogue, the Resolve bridge needs these new commands:

### Visual effects
- `apply_resolve_fx(clip_index, effect_name, parameters)` — Apply a ResolveFX plugin
- `inject_fusion_comp(clip_index, fusion_script)` — Inject a single Fusion composition
- `build_compound_fusion(clip_index, ingredients[])` — Combine multiple fusion ingredients into one Fusion comp (see "Fusion compound script rule")
- `set_fusion_param(clip_index, tool_name, param, value)` — Modify an existing Fusion tool parameter

### Colour
- `add_color_node(clip_index, node_type)` — Add a serial/parallel node on the Color page
- `set_node_params(clip_index, node_index, params)` — Set node parameters (lift/gamma/gain/sat/etc)
- `set_keyframe(clip_index, node_index, param, frame, value)` — Keyframed colour changes

### Audio — Tier A (Resolve API)
- `set_clip_volume(clip_index, volume_db)` — Set clip volume level
- `set_volume_keyframe(clip_index, frame, volume_db)` — Volume automation keyframe
- `set_clip_pan(clip_index, pan)` — Set pan position (-1 to 1)
- `mute_clip_audio(clip_index, muted)` — Mute/unmute clip audio
- `add_audio_track(name)` — Add audio track for layered SFX
- `import_audio_to_track(track_index, file_path, timeline_position)` — Place SFX on track

### Audio — Tier B (server-side pre-processing)
- `preprocess_audio(clip_index, filters[])` — Extract clip audio, apply ffmpeg/sox filters, return processed file path. Filters: `lowpass`, `highpass`, `bandpass`, `reverb`, `echo`, `pitch`, `speed`, `flanger`, `phaser`, `overdrive`, `downsample`
- `replace_clip_audio(clip_index, processed_audio_path)` — Mute original clip audio and import processed version to a new track, synced

### Timeline operations
- `add_adjustment_layer(start_frame, end_frame)` — For effects spanning multiple clips
- `set_composite_mode(clip_index, mode)` — Blend modes for layered clips
- `duplicate_to_track(clip_index, target_track)` — For double-exposure etc.
- `add_marker(clip_index, frame, color, name, note)` — Place markers for manual edits
- `razor_at(clip_index, frame)` — Split clip at frame
- `set_speed_curve(clip_index, keyframes)` — Speed ramping with keyframe array

### Clip properties
- `set_clip_opacity(clip_index, opacity)` — Clip transparency
- `set_retiming(clip_index, mode, speed)` — Optical flow / nearest retiming
- `set_clip_transform(clip_index, params)` — Position, scale, rotation, crop

### Masking
- `add_power_window(clip_index, node_index, window_type, params)` — Add a Power Window (circular/linear/polygon/curve/gradient) to a color node for regional grading
- `add_qualifier(clip_index, node_index, qualifier_type, params)` — Set up an HSL Qualifier on a node for colour-based pixel selection (skin tones, sky, specific colours)
- `setup_magic_mask(clip_index, mask_mode, node_index)` — Set up a Magic Mask node (person/face/object). Requires Resolve Studio. Auto-tracks.
- `setup_masked_grade(clip_index, mask_type, mask_params, grade_params, invert)` — All-in-one: creates node + mask + grade in a single call. mask_type: magic_mask/qualifier/circular/linear/polygon

### Effect management (for Applied Effects UI)
- `get_clip_effects_state(clip_index)` — Returns all active effects: Color nodes, Fusion comp tools, ResolveFX, speed settings, audio state
- `remove_effect(clip_index, effect_id)` — Remove a specific effect by ID
- `update_effect_param(clip_index, effect_id, param, value)` — Update a single parameter on an existing effect
- `bypass_effect(clip_index, effect_id, bypassed)` — Toggle effect bypass on/off
- `render_still(clip_index, frame, effects_mask)` — Render a single frame with optional effect exclusion mask (for hover preview comparison)
- `reorder_effects(clip_index, effect_ids[])` — Change processing order of effects on a clip
