/**
 * Sound registry — locked at 8 sounds per FOUNDATIONS §10 + design system
 * baseline §Sound. The 8th slot is `brand_dna_reveal` (BDA-3) per
 * `docs/specs/brand-dna-assessment.md` §10.5. Adding a 9th requires explicit
 * Andy approval; gate is the same scarcity discipline as the Tier 2 motion
 * list and the BHS closed list.
 *
 * Keys are canonical and kebab-cased (mirroring the spec). Files are
 * self-hosted under `/public/sounds/approved/<key>.mp3`. Files land in a
 * later Phase 5 "sound review" admin session (sourcing via Freesound +
 * optional ElevenLabs, Andy reviews 2–3 candidates per sound). Until a
 * file exists, `play()` silently no-ops — Howler's error path.
 *
 * Licensing is logged in `docs/sound-attributions.md` (created with the
 * first file that lands).
 */

export const SOUND_KEYS = [
  "quote-accepted",
  "subscription-activated",
  "kanban-drop",
  "morning-brief",
  "inbox-arrival",
  "deliverable-complete",
  "error",
  "brand_dna_reveal",
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];

export type SoundRegistryEntry = {
  key: SoundKey;
  /** Relative URL served from `/public`. */
  src: string;
  /** Default volume, 0–1. Kept low; these are ambient confirmations, not alerts. */
  volume: number;
  /** Informational only — Howler reads actual duration from the file. */
  expectedDurationMs: number;
  /** Short character description matching the spec's sound table. */
  character: string;
};

export const soundRegistry: Record<SoundKey, SoundRegistryEntry> = {
  "quote-accepted": {
    key: "quote-accepted",
    src: "/sounds/approved/quote-accepted.mp3",
    volume: 0.5,
    expectedDurationMs: 600,
    character: "Celebratory chime, warm wooden mallet, single tone, slight reverb tail",
  },
  "subscription-activated": {
    key: "subscription-activated",
    src: "/sounds/approved/subscription-activated.mp3",
    volume: 0.5,
    expectedDurationMs: 600,
    character: "Sister chime to quote-accepted — same character, different note",
  },
  "kanban-drop": {
    key: "kanban-drop",
    src: "/sounds/approved/kanban-drop.mp3",
    volume: 0.35,
    expectedDurationMs: 280,
    character: "Soft tactile thunk, wooden, low-mid frequency, no reverb — wooden chip on felt",
  },
  "morning-brief": {
    key: "morning-brief",
    src: "/sounds/approved/morning-brief.mp3",
    volume: 0.4,
    expectedDurationMs: 1200,
    character: "Single warm bell tone, long decay",
  },
  "inbox-arrival": {
    key: "inbox-arrival",
    src: "/sounds/approved/inbox-arrival.mp3",
    volume: 0.3,
    expectedDurationMs: 150,
    character: "Gentle warm pop, soft attack, no reverb, mid-frequency",
  },
  "deliverable-complete": {
    key: "deliverable-complete",
    src: "/sounds/approved/deliverable-complete.mp3",
    volume: 0.4,
    expectedDurationMs: 400,
    character: "Subtle ascending two-note (C–E), quiet, satisfying",
  },
  error: {
    key: "error",
    src: "/sounds/approved/error.mp3",
    volume: 0.4,
    expectedDurationMs: 250,
    character: "Low warm thud, low frequency, warm wooden character — respectful failure, never harsh",
  },
  brand_dna_reveal: {
    key: "brand_dna_reveal",
    src: "/sounds/approved/brand_dna_reveal.mp3",
    volume: 0.45,
    expectedDurationMs: 2400,
    character: "Slow warm swell — airy pad with a distant bell that lands as the first impression fades in. Cinematic, not triumphant. Paired with the Tier 2 `brand-dna-reveal` choreography.",
  },
};
