---
name: motion-design-principles
description: Motion design creative direction for SuperBad Marketing — covers the 12 principles of animation applied to UI and marketing contexts, when and why to use motion (and when not to), animation language and timing vocabulary, kinetic typography for social and platform UI, motion storytelling for short-form content, and how to direct Framer Motion and Remotion toward emotionally resonant rather than gratuitously animated results.
---

# Motion Design Principles — SuperBad Marketing

Motion is a language. Used well, it communicates relationships, hierarchy, and emotion more effectively than any static layout. Used poorly, it's noise that exhausts the viewer and obscures the content. This skill governs all motion design decisions — from a single hover state in the platform UI to a full kinetic typography social video.

---

## 1. The First Principle: Motion Has a Job or It Doesn't Happen

Every animation should do at least one of the following:

1. **Communicate a relationship** — this element belongs to that element (connected motion)
2. **Establish hierarchy** — this is more important than that (sequential reveal)
3. **Indicate state change** — something happened (interaction feedback)
4. **Guide attention** — look here (directional motion)
5. **Create emotional tone** — the brand feels like this (atmospheric motion)

If a proposed animation doesn't serve at least one of these purposes, remove it. Decorative animation is the visual equivalent of filler words — it makes everything feel less deliberate.

---

## 2. The 12 Animation Principles — Applied to Digital and Marketing

Disney's 12 principles of animation apply directly to UI and motion design. These are not academic — they're why some animations feel right and others feel wrong.

### 1. Squash and Stretch
Objects deform under force to suggest weight and elasticity. In UI: a modal that slightly overshoots and springs back. In marketing: a reveal that stretches into place.

**SuperBad application:** Used sparingly in the platform — a subtle spring on card hover, a slight overshoot on drawer open. Never on content elements.

### 2. Anticipation
A brief motion in the opposite direction before the primary motion, creating expectation. In UI: a button that dips slightly before launching an animation.

**SuperBad application:** Almost never in UI (too obvious, slows interaction). Use in marketing motion — a text block that pulls back slightly before slamming into position.

### 3. Staging
The composition and framing ensures the action is clear and readable. In motion: animate one thing at a time, not everything simultaneously.

**SuperBad application:** Critical. Stagger animations so the viewer processes each element before the next arrives. Never animate more than 2–3 elements simultaneously.

### 4. Straight Ahead vs. Pose-to-Pose
Straight ahead (fluid, spontaneous) vs. key frame to key frame (controlled, deliberate). Premium brand motion is pose-to-pose — deliberate and controlled.

**SuperBad application:** All platform UI and marketing animations are pose-to-pose. Nothing feels improvised.

### 5. Follow Through and Overlapping Action
Different parts of an object or group don't all stop at exactly the same time. Hair continues moving after the head stops. In UI: child elements trail slightly after parent elements.

**SuperBad application:** When a section reveals, the headline arrives first, then the subhead trails by ~50ms, then the body trails another ~50ms. Staggered arrival feels organic.

### 6. Slow In and Slow Out (Easing)
Objects accelerate from rest and decelerate before stopping. Linear motion feels mechanical. Eased motion feels natural.

**The easing vocabulary:**
```
ease-in       — starts slow, ends fast. Energy building. Good for exits.
ease-out      — starts fast, ends slow. Settling. Good for entries.
ease-in-out   — starts and ends slow, fast in middle. Considered. Good for transitions.
spring        — overshoots and oscillates to rest. Organic. Good for interactive feedback.
linear        — constant speed. Mechanical. Use only for continuous loops.

Framer Motion equivalents:
{ ease: "easeOut", duration: 0.3 }       // Entry — element settling into place
{ ease: "easeIn", duration: 0.2 }        // Exit — element leaving quickly
{ type: "spring", stiffness: 300, damping: 30 } // Interactive spring
```

### 7. Arcs
Objects in nature move in arcs, not straight lines. Straight-line translation feels robotic. In UI: elements should curve slightly in their trajectory when possible.

**SuperBad application:** Entrance animations from off-screen should arc subtly (move 20px down while fading in — creates arc impression). Pure horizontal or vertical translation only for precise UI contexts (drawers, modals).

### 8. Secondary Action
A secondary motion that supports the primary action. In UI: text fades in while a container slides open.

**SuperBad application:** Container slides + content fades simultaneously (but staggered). The container is primary; the content fade is secondary.

### 9. Timing
The number of frames (or milliseconds) determines the perceived weight and energy of an animation.

**SuperBad timing standards:**
```
Micro-interactions (hover, focus):    100–150ms
UI state changes (open/close):        200–300ms
Page transitions:                     400–600ms
Marketing reveal animations:          600–1200ms
Kinetic typography beats:             Match music — typically 500ms at 120BPM
```

**Rule:** If an animation takes longer than 1 second, it had better be the centrepiece of the screen.

### 10. Exaggeration
Slight exaggeration makes animation feel more alive. An entrance that travels 8px further than strictly necessary before settling feels more satisfying than one that stops exactly where it should.

**SuperBad application:** Slight — not visible to the conscious eye, felt as quality. Hover states move 2–3px more than the strictly functional amount. Reveals travel 10px further and spring back slightly.

### 11. Solid Drawing
The underlying form stays consistent through animation. In digital: a card that animates to a new size should feel like the same card, not a different element.

**SuperBad application:** Never change the visual nature of an element during animation. Animate position, opacity, scale — don't change colour or typeface mid-animation.

### 12. Appeal
The overall animation should be pleasing to watch. This is subjective but testable: if you want to trigger the animation again just to watch it, it has appeal.

---

## 3. When to Use Motion (and When Not To)

### Use motion for:

**Navigation and wayfinding**
- Page transitions that communicate depth (entering → deeper = slides left/pushes; going back = slides right/pops)
- Drawer and modal opens that show origin and destination

**Feedback and state**
- Button loading states (avoids perceived unresponsiveness)
- Form validation (shake on error, green check on success)
- Data updates (numbers counting up, progress bars)

**Attention and emphasis**
- Notification badge pulse
- New data appearing in a list
- Call to action that draws the eye on page load (subtle, once only)

**Emotional tone (marketing)**
- Kinetic typography on social content
- Hero reveal animations on landing pages
- Content section entrances on scroll

### Do not use motion for:

- **Static information that doesn't change** — a label, a stat that isn't counting — no animation needed
- **Already-visible content** — animating in things the user has already seen is disorienting
- **In situations where users are mid-task** — don't animate during a form fill or during data input
- **Platform performance-critical views** — the CRM tables, the pipeline, analytics dashboards — animations here create perceived slowness
- **Below 60fps** — if the animation can't run smoothly, don't run it

---

## 4. Motion in the SuperBad Platform

### UI animation standards

The platform should feel premium and considered — not flashy. Motion is subtle and purposeful.

**Entry animations** (elements appearing on screen):
```typescript
// Standard card entrance — used across all platform cards
const cardEntrance = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: "easeOut" }
}

// Staggered list entrance
const listContainer = {
  animate: { transition: { staggerChildren: 0.05 } }
}
const listItem = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.25, ease: "easeOut" }
}
```

**Interactive states:**
```typescript
// Hover lift — cards, buttons
whileHover: { y: -2, transition: { duration: 0.15 } }

// Press feedback — buttons
whileTap: { scale: 0.98, transition: { duration: 0.1 } }

// Focus ring pulse — accessibility
// Use CSS for focus states, not Framer Motion
```

**Page transitions:**
```typescript
// Standard route transition
const pageVariants = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit:    { opacity: 0, x: 16, transition: { duration: 0.2, ease: "easeIn" } }
}
```

### Reduced motion respect (non-negotiable)

```typescript
import { useReducedMotion } from 'framer-motion'

function AnimatedCard({ children }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
```

---

## 5. Kinetic Typography — Social and Marketing

Kinetic text is the intersection of typography and motion design. Used in social content, video overlays, and marketing reveals.

### Principles for social kinetic text

**Sync to speech rhythm, not music beat.** Text appears as the word is spoken (or slightly before — ~50ms early creates a satisfying audio/visual sync). If the text appears after the spoken word, the viewer reads it too late and it feels off.

**One thought per reveal.** Don't animate full sentences simultaneously. Reveal 2–4 words at a time — matching the natural emphasis breaks in speech.

**Motion direction = reading direction.** Text reveals from left to right (matching English reading direction). Exception: a dramatic reveal can come from an unexpected direction for emphasis, but use sparingly.

**Word-level vs. line-level animation:**
```
Word-level: each word animates separately — high energy, emphasis-heavy (TikTok style)
Line-level: each line animates as a unit — more measured, editorial (LinkedIn style)
Character-level: each letter animates — maximum drama, use only for hero moments
```

### Kinetic text timing chart

```
At 120 BPM (standard social music tempo):
1 beat = 500ms

Standard word hold:    1 beat (500ms)
Emphasis word hold:    2 beats (1000ms)
Pause / transition:    0.5 beat (250ms)
Character animation:   30ms per character (10 chars = 300ms)
```

### Remotion text animation patterns

```tsx
// Slide-up word entrance — standard social caption style
export function WordReveal({ text, frame, fps }: { text: string; frame: number; fps: number }) {
  const words = text.split(' ')

  return (
    <AbsoluteFill>
      {words.map((word, i) => {
        const startFrame = i * Math.round(fps * 0.5)  // 0.5s per word
        const progress = interpolate(frame, [startFrame, startFrame + 8], [0, 1], {
          extrapolateRight: 'clamp',
        })
        return (
          <motion.span
            key={i}
            style={{
              opacity: progress,
              transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
              display: 'inline-block',
              marginRight: 12,
            }}
          >
            {word}
          </motion.span>
        )
      })}
    </AbsoluteFill>
  )
}
```

---

## 6. Motion Storytelling for Short-Form Content

### The reveal sequence

Every short-form video that uses kinetic text or animated graphics follows this reveal pattern:

```
Beat 1 (0–1s):   Black or hold — silence before the strike
Beat 2 (1–1.5s): Primary word/statement slams in — maximum contrast, instant visibility
Beat 3 (1.5–3s): Secondary information reveals — supporting context arrives
Beat 4 (3–4s):   Hold — let the viewer read before moving
Beat 5 (4s+):    Transition out — wipe, fade, or cut — and next section begins
```

### Motion vocabulary for different emotional registers

| Emotion | Motion Character | Framer Motion approach |
|---------|-----------------|----------------------|
| Authority | Slow, deliberate, settling | `easeOut`, long duration (0.6s), no overshoot |
| Energy | Fast, punchy, snappy | Short duration (0.15s), slight spring overshoot |
| Warmth | Gentle, gradual | Fade-dominant, `easeInOut`, soft timing |
| Urgency | Rapid stagger, quick | Very short durations (0.1s), tight stagger |
| Premium | Barely perceptible | Sub-150ms, opacity-only where possible |

---

## 7. Motion Review Checklist

Before any animated UI or content is considered complete:

- [ ] Does every animation serve a purpose from the list in section 1?
- [ ] Are all timings within the platform standards (max 600ms for UI)?
- [ ] Is easing applied — no linear animations anywhere?
- [ ] Is staggering applied for lists and groups?
- [ ] Has `useReducedMotion` been respected in all platform components?
- [ ] Does the animation run at 60fps without jank?
- [ ] Is the animation still legible and functional if disabled entirely?
- [ ] Would a user who hasn't noticed the animation still understand the interface?
