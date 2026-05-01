/**
 * Shared helper for building signal scores display data from raw profile tags.
 * Used by all reveal page server components.
 */

import {
  SIGNAL_DEFINITIONS,
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  formatTagName,
} from "@/lib/brand-dna/signal-definitions";
import type { SignalScoreEntry } from "@/components/lite/brand-dna/signal-scores";

const MIN_FREQUENCY = 3;
const MAX_SIGNALS = 12;

export function buildSignalScoresData(
  rawTags: string | null,
  descriptions: Record<string, string>,
): { scores: SignalScoreEntry[]; longTail: string[] } {
  if (!rawTags) return { scores: [], longTail: [] };

  let tagMap: Record<string, number>;
  try {
    const parsed = JSON.parse(rawTags);
    if (Array.isArray(parsed)) {
      tagMap = {};
      for (const t of parsed) {
        if (typeof t === "string") tagMap[t] = (tagMap[t] ?? 0) + 1;
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      tagMap = parsed as Record<string, number>;
    } else {
      return { scores: [], longTail: [] };
    }
  } catch {
    return { scores: [], longTail: [] };
  }

  const sorted = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);

  const scores: SignalScoreEntry[] = sorted
    .filter(([, freq]) => freq >= MIN_FREQUENCY)
    .slice(0, MAX_SIGNALS)
    .map(([tag, frequency]) => {
      const def = SIGNAL_DEFINITIONS[tag];
      const domain = def?.domain ?? "values";
      return {
        tag,
        displayName: formatTagName(tag),
        frequency,
        domain,
        domainLabel: DOMAIN_LABELS[domain],
        domainColor: DOMAIN_COLORS[domain],
        staticDefinition: def?.definition ?? "",
        contextualDescription: descriptions[tag] ?? "",
      };
    });

  const scoredTags = new Set(scores.map((s) => s.tag));
  const longTail = sorted
    .filter(([tag, freq]) => freq < MIN_FREQUENCY && !scoredTags.has(tag))
    .map(([tag]) => formatTagName(tag));

  return { scores, longTail };
}

export function parseSignalTagNames(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s): s is string => typeof s === "string")
        .slice(0, 8)
        .map((t) => t.replace(/_/g, " "));
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as Record<string, number>)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 8)
        .map(([tag]) => tag.replace(/_/g, " "));
    }
  } catch { /* malformed JSON */ }
  return [];
}
