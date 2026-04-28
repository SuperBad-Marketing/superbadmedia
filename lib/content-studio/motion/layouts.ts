export interface MotionLayoutConfig {
  id: string;
  name: string;
  description: string;
  textAlign: "left" | "center" | "right";
  verticalPosition: number;
  headlineScale: number;
  detailScale: number;
  lineHeight: number;
  letterSpacing: number;
  paddingScale: number;
  contentWidth: number;
  elementGap: number;
  isPreset: boolean;
}

export interface ComputedLayout {
  textAlign: "left" | "center" | "right";
  alignItems: string;
  justifyContent: string;
  paddingX: number;
  paddingY: number;
  contentMaxWidth: string;
  elementGap: number;
  headlineFontSize: number;
  detailFontSize: number;
  labelFontSize: number;
  taglineFontSize: number;
  footerFontSize: number;
  brandFontSize: number;
  headlineLineHeight: number;
  headlineLetterSpacing: number;
  scale: number;
}

const BASE_HEADLINE = 84;
const BASE_DETAIL = 28;
const BASE_LABEL = 15;
const BASE_TAGLINE = 18;
const BASE_FOOTER = 12;
const BASE_BRAND = 15;
const BASE_PAD_X = 48;
const BASE_PAD_Y = 60;

export function getCanvasScale(canvasWidth: number, canvasHeight: number): number {
  const widthScale = canvasWidth / 1080;
  const aspect = canvasWidth / canvasHeight;
  const aspectAdjust = aspect < 0.8 ? 1.08 : aspect > 1.3 ? 0.92 : 1.0;
  return widthScale * aspectAdjust;
}

export function computeLayout(
  config: MotionLayoutConfig | undefined,
  canvasWidth: number,
  canvasHeight: number,
): ComputedLayout {
  const cfg = config ?? DEFAULT_LAYOUT;
  const scale = getCanvasScale(canvasWidth, canvasHeight);

  const alignMap: Record<string, string> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };

  const vp = cfg.verticalPosition;
  const justifyContent =
    vp <= 30 ? "flex-start" : vp >= 70 ? "flex-end" : "center";

  return {
    textAlign: cfg.textAlign,
    alignItems: alignMap[cfg.textAlign] ?? "flex-start",
    justifyContent,
    paddingX: Math.round(BASE_PAD_X * scale * cfg.paddingScale),
    paddingY: Math.round(BASE_PAD_Y * scale * cfg.paddingScale),
    contentMaxWidth: `${cfg.contentWidth}%`,
    elementGap: Math.round(cfg.elementGap * scale),
    headlineFontSize: Math.round(BASE_HEADLINE * scale * cfg.headlineScale),
    detailFontSize: Math.round(BASE_DETAIL * scale * cfg.detailScale),
    labelFontSize: Math.round(BASE_LABEL * scale),
    taglineFontSize: Math.round(BASE_TAGLINE * scale),
    footerFontSize: Math.round(BASE_FOOTER * scale),
    brandFontSize: Math.round(BASE_BRAND * scale),
    headlineLineHeight: cfg.lineHeight,
    headlineLetterSpacing: cfg.letterSpacing,
    scale,
  };
}

export const LAYOUT_EDITORIAL: MotionLayoutConfig = {
  id: "editorial",
  name: "Editorial",
  description: "Left-aligned authority. Strong hierarchy, generous space.",
  textAlign: "left",
  verticalPosition: 50,
  headlineScale: 1.0,
  detailScale: 0.9,
  lineHeight: 0.95,
  letterSpacing: -1,
  paddingScale: 1.0,
  contentWidth: 85,
  elementGap: 16,
  isPreset: true,
};

export const LAYOUT_HERO: MotionLayoutConfig = {
  id: "hero",
  name: "Hero",
  description: "Centered and balanced. Classic hero treatment.",
  textAlign: "center",
  verticalPosition: 50,
  headlineScale: 1.1,
  detailScale: 0.85,
  lineHeight: 0.95,
  letterSpacing: -1,
  paddingScale: 1.2,
  contentWidth: 90,
  elementGap: 20,
  isPreset: true,
};

export const LAYOUT_LOWER_THIRD: MotionLayoutConfig = {
  id: "lower-third",
  name: "Lower Third",
  description: "Broadcast placement. Content sits low, frame stays open.",
  textAlign: "left",
  verticalPosition: 82,
  headlineScale: 0.88,
  detailScale: 0.82,
  lineHeight: 1.0,
  letterSpacing: 0,
  paddingScale: 0.8,
  contentWidth: 75,
  elementGap: 10,
  isPreset: true,
};

export const LAYOUT_STATEMENT: MotionLayoutConfig = {
  id: "statement",
  name: "Statement",
  description: "One massive headline. Everything else whispers.",
  textAlign: "center",
  verticalPosition: 50,
  headlineScale: 1.4,
  detailScale: 0.65,
  lineHeight: 0.88,
  letterSpacing: -2,
  paddingScale: 1.3,
  contentWidth: 95,
  elementGap: 28,
  isPreset: true,
};

export const LAYOUT_COMPACT: MotionLayoutConfig = {
  id: "compact",
  name: "Compact",
  description: "Dense and efficient. Information-first layout.",
  textAlign: "left",
  verticalPosition: 38,
  headlineScale: 0.88,
  detailScale: 0.85,
  lineHeight: 1.0,
  letterSpacing: 0,
  paddingScale: 0.7,
  contentWidth: 80,
  elementGap: 10,
  isPreset: true,
};

export const LAYOUT_BREATHE: MotionLayoutConfig = {
  id: "breathe",
  name: "Breathe",
  description: "Luxurious negative space. Small type, big presence.",
  textAlign: "center",
  verticalPosition: 50,
  headlineScale: 0.82,
  detailScale: 0.75,
  lineHeight: 1.2,
  letterSpacing: 1,
  paddingScale: 1.8,
  contentWidth: 65,
  elementGap: 28,
  isPreset: true,
};

export const LAYOUT_ASYMMETRIC: MotionLayoutConfig = {
  id: "asymmetric",
  name: "Asymmetric",
  description: "Off-center tension. Empty space does the talking.",
  textAlign: "left",
  verticalPosition: 35,
  headlineScale: 1.05,
  detailScale: 0.88,
  lineHeight: 0.95,
  letterSpacing: -1,
  paddingScale: 1.1,
  contentWidth: 65,
  elementGap: 16,
  isPreset: true,
};

export const LAYOUT_TITLE_CARD: MotionLayoutConfig = {
  id: "title-card",
  name: "Title Card",
  description: "Cinematic spacing. Wide tracking, measured rhythm.",
  textAlign: "center",
  verticalPosition: 50,
  headlineScale: 1.0,
  detailScale: 0.78,
  lineHeight: 1.05,
  letterSpacing: 3,
  paddingScale: 1.5,
  contentWidth: 80,
  elementGap: 32,
  isPreset: true,
};

export const LAYOUT_RIGHT_FLUSH: MotionLayoutConfig = {
  id: "right-flush",
  name: "Right Flush",
  description: "Right-aligned. Breaks the reading axis. Demands attention.",
  textAlign: "right",
  verticalPosition: 50,
  headlineScale: 1.0,
  detailScale: 0.88,
  lineHeight: 0.95,
  letterSpacing: -1,
  paddingScale: 1.0,
  contentWidth: 80,
  elementGap: 16,
  isPreset: true,
};

export const LAYOUT_STACKED: MotionLayoutConfig = {
  id: "stacked",
  name: "Stacked",
  description: "Tight and modern. Words pile up like a poster.",
  textAlign: "center",
  verticalPosition: 50,
  headlineScale: 1.15,
  detailScale: 0.72,
  lineHeight: 0.88,
  letterSpacing: -2,
  paddingScale: 1.0,
  contentWidth: 95,
  elementGap: 6,
  isPreset: true,
};

export const PRESET_LAYOUTS: MotionLayoutConfig[] = [
  LAYOUT_EDITORIAL,
  LAYOUT_HERO,
  LAYOUT_LOWER_THIRD,
  LAYOUT_STATEMENT,
  LAYOUT_COMPACT,
  LAYOUT_BREATHE,
  LAYOUT_ASYMMETRIC,
  LAYOUT_TITLE_CARD,
  LAYOUT_RIGHT_FLUSH,
  LAYOUT_STACKED,
];

export const DEFAULT_LAYOUT = LAYOUT_EDITORIAL;

export function getLayoutById(id: string): MotionLayoutConfig | undefined {
  return PRESET_LAYOUTS.find((l) => l.id === id);
}

export const LAYOUT_SLIDER_RANGES = {
  headlineScale: { min: 0.6, max: 1.5, step: 0.05 },
  detailScale: { min: 0.6, max: 1.5, step: 0.05 },
  lineHeight: { min: 0.85, max: 1.3, step: 0.05 },
  letterSpacing: { min: -3, max: 3, step: 0.5 },
  paddingScale: { min: 0.5, max: 2.0, step: 0.1 },
  contentWidth: { min: 50, max: 100, step: 5 },
  elementGap: { min: 4, max: 48, step: 2 },
  verticalPosition: { min: 0, max: 100, step: 5 },
} as const;
