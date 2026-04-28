import type { ContentType } from "@/lib/db/schema/content-studio";
import type { ContentFormat } from "./brief-parser";

const FORMAT_LABELS: Record<ContentFormat, string> = {
  static: "Post",
  animated: "Motion",
  cinematic: "Clip",
  composite: "Reel",
};

const TYPE_LABELS: Record<ContentType, string> = {
  announcement: "Announcement",
  anti_motivation: "Anti-Motivation",
  portfolio: "Portfolio",
  tips: "Tips",
  testimonial: "Testimonial",
  behind_the_scenes: "BTS",
};

export function suggestProjectName(
  brief: string,
  format: ContentFormat,
  contentType: ContentType | null,
  clientName: string | null,
): string {
  const parts: string[] = [];

  if (clientName) {
    parts.push(clientName);
    parts.push("—");
  }

  const topicWords = extractTopic(brief);
  if (topicWords) {
    parts.push(topicWords);
  } else if (contentType) {
    parts.push(TYPE_LABELS[contentType]);
  }

  parts.push(FORMAT_LABELS[format]);

  return parts.join(" ");
}

function extractTopic(brief: string): string | null {
  const lower = brief.toLowerCase();

  const aboutMatch = brief.match(/about\s+(.{3,40})(?:\.|,|$)/i);
  if (aboutMatch) {
    return capitalise(aboutMatch[1].trim());
  }

  const ofMatch = brief.match(/(?:reel|clip|video|post)\s+of\s+(.{3,40})(?:\.|,|$)/i);
  if (ofMatch) {
    return capitalise(ofMatch[1].trim());
  }

  const words = brief
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !STOP_WORDS.has(w.toLowerCase()),
    );

  if (words.length >= 2) {
    return words.slice(0, 4).join(" ");
  }

  return null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const STOP_WORDS = new Set([
  "about", "that", "this", "with", "from", "have", "been",
  "make", "post", "reel", "clip", "video", "animated", "cinematic",
  "composite", "static", "motion", "anti", "motivation",
  "portfolio", "testimonial", "behind", "scenes", "tips",
  "announcement", "content", "create", "want", "like",
  "something", "warm", "tones", "style", "brand",
]);
