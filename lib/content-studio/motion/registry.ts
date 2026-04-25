import type { MotionTemplateDef } from "./types";

const FPS = 30;

const announcementBoldMotion: MotionTemplateDef = {
  id: "announcement-bold-motion",
  name: "Bold Announcement (Motion)",
  category: "paired",
  staticCounterpart: "announcement-bold",
  overlayCapable: false,
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
  name: "Minimal Announcement (Motion)",
  category: "paired",
  staticCounterpart: "announcement-minimal",
  overlayCapable: false,
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
  name: "Anti-Motivation Typography (Motion)",
  category: "paired",
  staticCounterpart: "anti-motivation-typography",
  overlayCapable: false,
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
  name: "Value Post (Motion)",
  category: "paired",
  staticCounterpart: "tips-value",
  overlayCapable: false,
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
  name: "Testimonial Quote (Motion)",
  category: "paired",
  staticCounterpart: "testimonial-quote",
  overlayCapable: false,
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
  name: "Behind the Scenes (Motion)",
  category: "paired",
  staticCounterpart: "bts-caption",
  overlayCapable: false,
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
  name: "Portfolio Showcase (Motion)",
  category: "paired",
  staticCounterpart: "portfolio-showcase",
  overlayCapable: false,
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
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
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
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
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
  category: "motion-only",
  staticCounterpart: null,
  overlayCapable: true,
  copySlots: ["logo", "tagline"],
  animationParams: [
    { key: "logoBlur", label: "Logo blur reveal", type: "toggle", default: true },
  ],
  defaultDuration: 2.5 * FPS,
  minDuration: 1.5 * FPS,
  maxDuration: 4 * FPS,
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
