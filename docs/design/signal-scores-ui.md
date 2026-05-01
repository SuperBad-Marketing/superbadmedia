# Signal Scores — UI Design Map

**Locked 2026-05-01.** Supersedes the tag pills in the Brand DNA reveal.

---

## Position in reveal sequence

Replaces the current signal tag pills (step 2). Sits between the hero first impression and the section insights.

New sequence:
1. Hero (first impression headline + subline)
2. **Signal scores** — ranked bars with descriptions
3. Section insights (5 alternating bands)
4. Key takeaways
5. Prose portrait

## Data source

`tags_json` on `brand_dna_profiles` — domain-grouped frequency map, already stored.

## What gets generated at profile creation time (new Opus work)

1. **Intro sentence** — 2 sentences max. Names top 3 signals, frames the pattern. Dry/flat voice register. Piggybacked onto existing profile generation prompts.
2. **Per-signal descriptions** (top 12 only) — hybrid: static first sentence defining the signal + Opus-generated second sentence connecting it to what showed up in this person's answers.

## Layout

```
┌─────────────────────────────────────────────────┐
│  SIGNAL SCORES                    (label, orange)│
│                                                  │
│  "Warmth, pragmatism, and directness kept        │
│   showing up. That's a brand that earns trust    │
│   by being useful, not by being loud."           │
│                                                  │
│  ● WARMTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  16  │
│  ● AUTHENTICITY ━━━━━━━━━━━━━━━━━━━━━━━━━  15  │
│  ● PRAGMATISM ━━━━━━━━━━━━━━━━━━━━━━━━     12  │
│  ● EMPATHY ━━━━━━━━━━━━━━━━━━━━━           11  │
│  ● INDEPENDENCE ━━━━━━━━━━━━━━━             9  │
│  ● DIRECTNESS ━━━━━━━━━━━━━━                8  │
│  ...                                             │
│                                                  │
│  Also present: nostalgia, formality, genre       │
│  fluency                                         │
└─────────────────────────────────────────────────┘
```

## Interaction model

| Surface | Bars | Descriptions | Domain dot |
|---|---|---|---|
| Desktop | Scroll-revealed | Hover on bar row → description slides open below | Hover on dot → tooltip with domain name |
| Mobile | Scroll-revealed | Tap bar row → expands, tap another → previous closes | Tap dot → same tooltip |

Only one description open at a time on both platforms.

## Signal count

- **Top 12** by frequency, minimum floor of 3 occurrences
- Below that, a quiet summary line listing remaining tags (1-2 frequency) as text

## Domain indicators

Five domains: aesthetic, communication, values, creative, aspiration.

- 5 muted/desaturated colours, one per domain
- 6-8px dot to the left of the signal name
- Hover/tap on dot shows domain name tooltip
- Domain also named in micro text within the expanded description

## Motion choreography

| Step | What | Timing | Easing |
|---|---|---|---|
| 1 | Intro text fades in | Scroll-triggered, `opacity 0→1, y 24→0` | House spring |
| 2 | Beat | 200ms pause | — |
| 3 | Bars stagger in, top to bottom | Bar width grows 0%→final over ~400ms, stagger 60ms between bars | Tier-2 ease `(0.16, 1, 0.3, 1)` |
| 3a | Score numbers count up | 0→final value, synced with bar growth | Same |
| 4 | Long-tail summary | Fade in after last bar lands, opacity only | House spring |
| 5 | Description expand (on interaction) | Height + opacity spring in | House spring |

Total bar entrance: ~1.1s from first to last. Reduced motion: all bars at full width immediately, no stagger, no count-up.

## New generation prompts needed

1. `generate-signal-scores-intro.ts` — reads top 3 tags + frequency map, outputs 2 sentences
2. `generate-signal-descriptions.ts` — reads answer traces + tags for top 12, outputs one contextual sentence per tag

Static definition sentence lives in a lookup table: `lib/brand-dna/signal-definitions.ts`.

## Static tag definitions

A lookup map mapping every tag string to its one-sentence definition. Written once, covers all 40-60 tags.

Examples:
- `patience` → "A bias toward deliberate timing over reactive speed."
- `directness` → "A preference for saying the thing plainly, without softening."
- `warmth` → "A gravitational pull toward approachability and human texture."
