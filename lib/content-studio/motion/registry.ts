import type { MotionTemplateDef } from "./types";

const FPS = 30;

const announcementBoldMotion: MotionTemplateDef = {
  id: "announcement-bold-motion",
  name: "Bold Announcement",
  description: "High-impact headline with accent line and staggered detail.",
  category: "paired",
  staticCounterpart: "announcement-bold",
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "detail", "subtext", "tagline"],
  animationParams: [
    { key: "headlineDelay", label: "Headline delay", type: "timing", default: 10 },
    { key: "gradientPulse", label: "Gradient pulse", type: "toggle", default: true },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const announcementMinimalMotion: MotionTemplateDef = {
  id: "announcement-minimal-motion",
  name: "Minimal Announcement",
  description: "Clean character-by-character reveal. Restrained and precise.",
  category: "paired",
  staticCounterpart: "announcement-minimal",
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "detail", "tagline"],
  animationParams: [
    { key: "charRevealSpeed", label: "Character reveal speed", type: "timing", default: 35 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const antiMotivationTypographyMotion: MotionTemplateDef = {
  id: "anti-motivation-typography-motion",
  name: "Anti-Motivation",
  description: "Breathing letter-spacing with vast negative space. Statement-first.",
  category: "paired",
  staticCounterpart: "anti-motivation-typography",
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "tagline"],
  animationParams: [
    { key: "breatheSpeed", label: "Letter-spacing breathe", type: "timing", default: 20 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const tipsValueMotion: MotionTemplateDef = {
  id: "tips-value-motion",
  name: "Value Post",
  description: "Typewriter reveal for educational content.",
  category: "paired",
  staticCounterpart: "tips-value",
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "detail", "tagline"],
  animationParams: [
    { key: "typewriterSpeed", label: "Typewriter speed", type: "timing", default: 30 },
  ],
  defaultDuration: 3.5 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const testimonialQuoteMotion: MotionTemplateDef = {
  id: "testimonial-quote-motion",
  name: "Testimonial Quote",
  description: "Oversized quote mark with italic testimonial text.",
  category: "paired",
  staticCounterpart: "testimonial-quote",
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "detail", "subtext"],
  animationParams: [
    { key: "quoteMarkBounce", label: "Quote mark bounce", type: "toggle", default: true },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const btsCaptionMotion: MotionTemplateDef = {
  id: "bts-caption-motion",
  name: "Behind the Scenes",
  description: "Blur-to-sharp reveal for behind-the-scenes moments.",
  category: "paired",
  staticCounterpart: "bts-caption",
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "tagline"],
  animationParams: [
    { key: "blurDuration", label: "Blur reveal duration", type: "timing", default: 25 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 5 * FPS,
};

const portfolioShowcaseMotion: MotionTemplateDef = {
  id: "portfolio-showcase-motion",
  name: "Portfolio Showcase",
  description: "Label wipe with showcase-style headline treatment.",
  category: "paired",
  staticCounterpart: "portfolio-showcase",
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "detail", "tagline"],
  animationParams: [
    { key: "wipeSpeed", label: "Label wipe speed", type: "timing", default: 15 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const statCounterMotion: MotionTemplateDef = {
  id: "stat-counter",
  name: "Stat Counter",
  description: "Rolling digit counter with oversized background number.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
  layoutSupported: false,
  copySlots: ["stat", "label", "sublabel"],
  animationParams: [
    { key: "countDuration", label: "Count-up duration", type: "timing", default: 45 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 5 * FPS,
};

const textRevealMotion: MotionTemplateDef = {
  id: "text-reveal",
  name: "Text Reveal",
  description: "Word-by-word staggered reveal with emphasis highlight.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
  layoutSupported: true,
  copySlots: ["headline", "emphasis", "tagline"],
  animationParams: [
    { key: "wordDelay", label: "Word stagger delay", type: "timing", default: 6 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const logoStingMotion: MotionTemplateDef = {
  id: "logo-sting",
  name: "Logo Sting",
  description: "Quick brand moment — blur reveal into tagline.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
  layoutSupported: false,
  copySlots: ["logo", "tagline"],
  animationParams: [
    { key: "logoBlur", label: "Logo blur reveal", type: "toggle", default: true },
  ],
  defaultDuration: 2.5 * FPS,
  minDuration: 1.5 * FPS,
  maxDuration: 4 * FPS,
};

const wordSlamMotion: MotionTemplateDef = {
  id: "word-slam",
  name: "Word Slam",
  description: "Words slam in one at a time, stacking vertically.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
  layoutSupported: false,
  copySlots: ["headline", "tagline"],
  animationParams: [
    { key: "wordStagger", label: "Word stagger", type: "timing", default: 10 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const cinematicRevealMotion: MotionTemplateDef = {
  id: "cinematic-reveal",
  name: "Cinematic Reveal",
  description: "Slow, weighted reveal with film-title pacing.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "detail", "tagline"],
  animationParams: [
    { key: "revealPace", label: "Reveal pace", type: "timing", default: 15 },
  ],
  defaultDuration: 3.5 * FPS,
  minDuration: 2.5 * FPS,
  maxDuration: 6 * FPS,
};

const focusPullMotion: MotionTemplateDef = {
  id: "focus-pull",
  name: "Focus Pull",
  description: "Depth-of-field style blur transition between elements.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: true,
  copySlots: ["headline", "detail", "tagline"],
  animationParams: [
    { key: "focusSpeed", label: "Focus speed", type: "timing", default: 18 },
  ],
  defaultDuration: 3.5 * FPS,
  minDuration: 2.5 * FPS,
  maxDuration: 6 * FPS,
};

const whipPanMotion: MotionTemplateDef = {
  id: "whip-pan",
  name: "Whip Pan",
  description: "Fast horizontal sweep between text frames.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
  layoutSupported: false,
  copySlots: ["headline", "tagline"],
  animationParams: [
    { key: "whipSpeed", label: "Whip speed", type: "timing", default: 6 },
  ],
  defaultDuration: 4 * FPS,
  minDuration: 2.5 * FPS,
  maxDuration: 6 * FPS,
};

const zoomThroughMotion: MotionTemplateDef = {
  id: "zoom-through",
  name: "Zoom Through",
  description: "Continuous zoom creating parallax depth.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
  layoutSupported: false,
  copySlots: ["headline", "tagline"],
  animationParams: [
    { key: "zoomSpeed", label: "Zoom speed", type: "timing", default: 8 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const edgeBleedMotion: MotionTemplateDef = {
  id: "edge-bleed",
  name: "Edge Bleed",
  description: "Text deliberately runs off the frame edges. Confident, editorial.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: false,
  copySlots: ["headline", "tagline"],
  animationParams: [
    { key: "slideStagger", label: "Slide stagger", type: "timing", default: 8 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const splitFieldMotion: MotionTemplateDef = {
  id: "split-field",
  name: "Split Field",
  description: "Two-zone split — headline on colour, detail on dark.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: false,
  copySlots: ["headline", "detail", "tagline"],
  animationParams: [
    { key: "splitSpeed", label: "Split wipe speed", type: "timing", default: 12 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const oversizedCropMotion: MotionTemplateDef = {
  id: "oversized-crop",
  name: "Oversized Crop",
  description: "Giant cropped number/word as texture. Small text reads over it.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: false,
  copySlots: ["stat", "detail", "tagline"],
  animationParams: [
    { key: "driftSpeed", label: "Drift speed", type: "timing", default: 15 },
  ],
  defaultDuration: 3.5 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const isolationMotion: MotionTemplateDef = {
  id: "isolation",
  name: "Isolation",
  description: "Tiny text in vast space. The emptiness is the design.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: false,
  copySlots: ["headline", "tagline"],
  animationParams: [
    { key: "fadeSpeed", label: "Fade speed", type: "timing", default: 18 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 5 * FPS,
};

const verticalTypeMotion: MotionTemplateDef = {
  id: "vertical-type",
  name: "Vertical Type",
  description: "Letters stack vertically. Breaks the horizontal reading axis.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: false,
  copySlots: ["headline", "detail"],
  animationParams: [
    { key: "charStagger", label: "Character stagger", type: "timing", default: 3 },
  ],
  defaultDuration: 3.5 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

const stripeCutMotion: MotionTemplateDef = {
  id: "stripe-cut",
  name: "Stripe Cut",
  description: "Headline lives inside a colour band cutting across the frame.",
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: false,
  layoutSupported: false,
  copySlots: ["headline", "detail", "tagline"],
  animationParams: [
    { key: "wipeSpeed", label: "Stripe wipe speed", type: "timing", default: 10 },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

export const ALL_MOTION_TEMPLATES: MotionTemplateDef[] = [
  announcementBoldMotion,
  announcementMinimalMotion,
  antiMotivationTypographyMotion,
  tipsValueMotion,
  testimonialQuoteMotion,
  btsCaptionMotion,
  portfolioShowcaseMotion,
  statCounterMotion,
  textRevealMotion,
  logoStingMotion,
  wordSlamMotion,
  cinematicRevealMotion,
  focusPullMotion,
  whipPanMotion,
  zoomThroughMotion,
  edgeBleedMotion,
  splitFieldMotion,
  oversizedCropMotion,
  isolationMotion,
  verticalTypeMotion,
  stripeCutMotion,
];

export function getMotionTemplate(id: string): MotionTemplateDef | undefined {
  return ALL_MOTION_TEMPLATES.find((t) => t.id === id);
}

export function getMotionTemplatesForStatic(staticId: string): MotionTemplateDef[] {
  return ALL_MOTION_TEMPLATES.filter((t) => t.staticCounterpart === staticId);
}

export function getPairedMotionTemplates(): MotionTemplateDef[] {
  return ALL_MOTION_TEMPLATES.filter((t) => t.category === "paired");
}

export function getMotionOnlyTemplates(): MotionTemplateDef[] {
  return ALL_MOTION_TEMPLATES.filter((t) => t.category === "motion-only");
}
