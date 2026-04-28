import type { ContentType } from "@/lib/db/schema/content-studio";

export type ContentFormat = "static" | "animated" | "cinematic" | "composite";

export interface ParsedBrief {
  format: ContentFormat;
  contentType: ContentType | null;
  clientName: string | null;
  mood: string | null;
  hasStat: boolean;
  statValue: string | null;
  wantsReel: boolean;
  wantsCarousel: boolean;
  suggestedSlideCount: number;
  confidence: Record<string, number>;
  raw: string;
}

const FORMAT_SIGNALS: Record<ContentFormat, string[]> = {
  cinematic: [
    "cinematic", "hero", "mood piece", "atmosphere", "dolly",
    "slow motion", "film", "footage", "b-roll", "b roll",
  ],
  composite: [
    "reel", "composite", "branded reel", "overlay", "video post",
    "branded video", "case study reel", "portfolio reel",
    "behind the scenes reel", "bts reel",
  ],
  animated: [
    "animated", "motion", "kinetic", "animate", "text reveal",
    "counter", "count up", "stat counter", "logo sting",
  ],
  static: [],
};

const CONTENT_TYPE_SIGNALS: Record<ContentType, string[]> = {
  anti_motivation: [
    "anti-motivation", "anti motivation", "antimotivation",
    "grind", "consistency", "showing up", "keep going",
    "boring", "mundane", "discipline",
  ],
  portfolio: [
    "portfolio", "showcase", "our work", "shoot",
    "case study", "results", "before and after",
  ],
  testimonial: [
    "testimonial", "quote", "review", "said about",
    "client said", "feedback", "recommendation",
  ],
  behind_the_scenes: [
    "behind the scenes", "bts", "on set", "on-set",
    "making of", "setup", "day in the life",
  ],
  tips: [
    "tip", "tips", "value", "how to", "guide",
    "lesson", "advice", "mistake", "insight",
  ],
  announcement: [
    "announce", "announcement", "new", "launch",
    "update", "milestone", "hit", "reached",
  ],
};

const DEFAULT_FORMAT_FOR_TYPE: Partial<Record<ContentType, ContentFormat>> = {
  anti_motivation: "animated",
  portfolio: "composite",
  testimonial: "animated",
  behind_the_scenes: "composite",
  announcement: "animated",
};

const CAROUSEL_SIGNALS = [
  "carousel", "slides", "multi-slide", "swipe",
  "step by step", "list of", "tips for",
];

const STAT_PATTERN = /(\d+[%xk+]|\d+\s*(?:percent|times|clients|bookings|increase|decrease|growth))/i;

export function parseBrief(
  text: string,
  knownClients: string[] = [],
): ParsedBrief {
  const lower = text.toLowerCase();
  const confidence: Record<string, number> = {};

  let format: ContentFormat = "static";
  let bestFormatScore = 0;

  for (const [fmt, signals] of Object.entries(FORMAT_SIGNALS) as [ContentFormat, string[]][]) {
    const matches = signals.filter((s) => lower.includes(s));
    const score = matches.length;
    if (score > bestFormatScore) {
      bestFormatScore = score;
      format = fmt;
    }
    if (score > 0) {
      confidence[`format:${fmt}`] = Math.min(score / 2, 1);
    }
  }

  let contentType: ContentType | null = null;
  let bestTypeScore = 0;

  for (const [ct, signals] of Object.entries(CONTENT_TYPE_SIGNALS) as [ContentType, string[]][]) {
    const matches = signals.filter((s) => lower.includes(s));
    const score = matches.length;
    if (score > bestTypeScore) {
      bestTypeScore = score;
      contentType = ct;
    }
    if (score > 0) {
      confidence[`type:${ct}`] = Math.min(score / 2, 1);
    }
  }

  let clientName: string | null = null;
  for (const name of knownClients) {
    if (lower.includes(name.toLowerCase())) {
      clientName = name;
      confidence["client"] = 1;
      break;
    }
  }

  const statMatch = text.match(STAT_PATTERN);
  const hasStat = !!statMatch;
  const statValue = statMatch ? statMatch[1] : null;

  if (hasStat && format === "static") {
    format = "animated";
    confidence["format:animated"] = Math.max(confidence["format:animated"] ?? 0, 0.6);
  }

  if (format === "static" && contentType && DEFAULT_FORMAT_FOR_TYPE[contentType]) {
    format = DEFAULT_FORMAT_FOR_TYPE[contentType]!;
    confidence[`format:${format}`] = Math.max(confidence[`format:${format}`] ?? 0, 0.5);
  }

  const wantsReel = lower.includes("reel") || format === "composite" || format === "cinematic";
  const wantsCarousel = CAROUSEL_SIGNALS.some((s) => lower.includes(s));

  let suggestedSlideCount = 1;
  if (wantsCarousel) {
    const countMatch = text.match(/(\d+)\s*(?:slide|tip|step|point)/i);
    suggestedSlideCount = countMatch ? Math.min(parseInt(countMatch[1], 10), 10) : 5;
  }

  const mood = extractMood(lower);

  return {
    format,
    contentType,
    clientName,
    mood,
    hasStat,
    statValue,
    wantsReel,
    wantsCarousel,
    suggestedSlideCount,
    confidence,
    raw: text,
  };
}

function extractMood(text: string): string | null {
  const moods: Record<string, string[]> = {
    "warm & cinematic": ["warm", "cinematic", "atmospheric", "golden", "intimate"],
    "bold & punchy": ["bold", "punchy", "energy", "loud", "striking"],
    "minimal & clean": ["minimal", "clean", "simple", "understated", "quiet"],
    "dark & moody": ["dark", "moody", "dramatic", "shadow", "noir"],
    "dry & witty": ["dry", "witty", "tongue in cheek", "deadpan"],
  };

  let bestMood: string | null = null;
  let bestScore = 0;

  for (const [mood, signals] of Object.entries(moods)) {
    const score = signals.filter((s) => text.includes(s)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  return bestMood;
}

export function getFormatLabel(format: ContentFormat): string {
  switch (format) {
    case "static": return "Static Post";
    case "animated": return "Animated Post";
    case "cinematic": return "Cinematic Clip";
    case "composite": return "Composite Reel";
  }
}

export function getFormatDescription(format: ContentFormat): string {
  switch (format) {
    case "static": return "Still image or carousel";
    case "animated": return "Remotion motion graphics";
    case "cinematic": return "AI-generated footage";
    case "composite": return "Footage + brand overlay";
  }
}
