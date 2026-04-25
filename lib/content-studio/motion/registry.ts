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
    {
      key: "headlineDelay",
      label: "Headline delay",
      type: "timing",
      default: 10,
    },
    {
      key: "gradientPulse",
      label: "Gradient pulse",
      type: "toggle",
      default: true,
    },
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
    {
      key: "charRevealSpeed",
      label: "Character reveal speed",
      type: "timing",
      default: 35,
    },
  ],
  defaultDuration: 3 * FPS,
  minDuration: 2 * FPS,
  maxDuration: 6 * FPS,
};

export const ALL_MOTION_TEMPLATES: MotionTemplateDef[] = [
  announcementBoldMotion,
  announcementMinimalMotion,
];

export function getMotionTemplate(
  id: string,
): MotionTemplateDef | undefined {
  return ALL_MOTION_TEMPLATES.find((t) => t.id === id);
}

export function getMotionTemplatesForStatic(
  staticId: string,
): MotionTemplateDef[] {
  return ALL_MOTION_TEMPLATES.filter((t) => t.staticCounterpart === staticId);
}

export function getPairedMotionTemplates(): MotionTemplateDef[] {
  return ALL_MOTION_TEMPLATES.filter((t) => t.category === "paired");
}

export function getMotionOnlyTemplates(): MotionTemplateDef[] {
  return ALL_MOTION_TEMPLATES.filter((t) => t.category === "motion-only");
}
