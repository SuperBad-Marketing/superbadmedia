export const MOTION_ASPECT_RATIOS = [
  "square",
  "portrait_3x4",
  "portrait_4x5",
  "story",
  "landscape_16x9",
] as const;
export type MotionAspectRatio = (typeof MOTION_ASPECT_RATIOS)[number];

export const MOTION_DIMENSIONS: Record<
  MotionAspectRatio,
  { width: number; height: number }
> = {
  square: { width: 1080, height: 1080 },
  portrait_3x4: { width: 1080, height: 1440 },
  portrait_4x5: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape_16x9: { width: 1920, height: 1080 },
};

export const MOTION_RATIO_LABELS: Record<MotionAspectRatio, string> = {
  square: "Square (1:1)",
  portrait_3x4: "Portrait (3:4)",
  portrait_4x5: "Tall Portrait (4:5)",
  story: "Story / Reel (9:16)",
  landscape_16x9: "Landscape (16:9)",
};

export interface AnimationParamDef {
  key: string;
  label: string;
  type: "timing" | "easing" | "toggle";
  default: number | string | boolean;
}

export interface MotionTemplateDef {
  id: string;
  name: string;
  category: "paired" | "motion-only";
  staticCounterpart: string | null;
  overlayCapable: boolean;
  copySlots: string[];
  animationParams: AnimationParamDef[];
  defaultDuration: number;
  minDuration: number;
  maxDuration: number;
}

export interface ColourPalette {
  id: string;
  name: string;
  source: "brand" | "client-dna" | "custom";
  background: string;
  primary: string;
  accent: string;
  text: string;
}

export interface CustomPaletteInput {
  background: string;
  primary: string;
  accent: string;
  text: string;
}

export const SFX_NAMES = ["tick", "whoosh", "impact", "riser"] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export interface SfxCueData {
  sfx: SfxName;
  startFrame: number;
  volume: number;
}

export interface MotionTemplateProps {
  copy: Record<string, string>;
  palette: ColourPalette;
  transparent: boolean;
  animationParams: Record<string, number | string | boolean>;
  fontPairingId?: string;
  sfxCues?: SfxCueData[];
}
