"use client";

import * as React from "react";

type OptionKey = "a" | "b" | "c" | "d";

// ── Typeface previews (s1_q07) ──────────────────────────────────────────────

const TYPEFACE_SAMPLES: Record<OptionKey, { family: string; sample: string; fallback: string }> = {
  a: { family: "Georgia, 'Times New Roman', serif", sample: "The quiet details.", fallback: "serif" },
  b: { family: "Inter, system-ui, -apple-system, sans-serif", sample: "The quiet details.", fallback: "sans-serif" },
  c: { family: "'Caveat', 'Segoe Script', cursive", sample: "The quiet details.", fallback: "cursive" },
  d: { family: "'Courier New', 'Fira Mono', monospace", sample: "The quiet details.", fallback: "monospace" },
};

function TypefacePreview({ optionKey, selected }: { optionKey: OptionKey; selected: boolean }) {
  const spec = TYPEFACE_SAMPLES[optionKey];
  return (
    <div
      style={{
        fontFamily: spec.family,
        fontSize: 28,
        lineHeight: 1.2,
        letterSpacing: optionKey === "d" ? "0.5px" : optionKey === "a" ? "-0.3px" : "-0.5px",
        color: selected ? "var(--brand-cream)" : "rgba(253, 245, 230, 0.8)",
        padding: "8px 0",
        transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {spec.sample}
    </div>
  );
}

// ── Colour palette previews (s1_q04, sup_q04) ──────────────────────────────

const COLOUR_PALETTES: Record<string, Record<OptionKey, string[]>> = {
  s1_q04: {
    a: ["#C2703E", "#8B9E6B", "#F5F0E8", "#A17858"],
    b: ["#1A1A1A", "#FFFFFF", "#888888", "#C1202D"],
    c: ["#C9A3A3", "#7E96AA", "#B8AFA8", "#F5F0E8"],
    d: ["#1B2A4A", "#C66A24", "#D4A934", "#2D5E3E"],
  },
  sup_q04: {
    a: ["#6B8FA3", "#2D3E50", "#B0BEC5", "#ECEFF1"],
    b: ["#A17858", "#5D4037", "#D7C4A9", "#F5F0E8"],
    c: ["#C1202D", "#E86A1E", "#1B2A4A", "#D4A934"],
    d: ["#8B9E6B", "#B8AFA8", "#7E96AA", "#C9A3A3"],
  },
};

function ColourPalettePreview({ questionId, optionKey }: { questionId: string; optionKey: OptionKey }) {
  const colours = COLOUR_PALETTES[questionId]?.[optionKey];
  if (!colours) return null;
  return (
    <div style={{ display: "flex", gap: 6, padding: "4px 0" }}>
      {colours.map((hex, i) => (
        <div
          key={i}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: hex,
            border: "1px solid rgba(253, 245, 230, 0.1)",
            transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      ))}
    </div>
  );
}

// ── Image treatment previews (s1_q16, sup_q11) ─────────────────────────────

const IMAGE_TREATMENTS: Record<string, Record<OptionKey, React.CSSProperties>> = {
  s1_q16: {
    a: { filter: "sepia(0.4) saturate(0.8) contrast(0.95)", background: "linear-gradient(135deg, #8B7355 0%, #A18B6E 50%, #6B5A42 100%)" },
    b: { filter: "grayscale(1) contrast(1.6)", background: "linear-gradient(135deg, #1A1A1A 0%, #555555 50%, #2A2A2A 100%)" },
    c: { filter: "blur(0.5px) saturate(0.6) brightness(1.1)", background: "linear-gradient(135deg, #C9A3A3 0%, #D4BCA8 50%, #B8AFA8 100%)" },
    d: { filter: "saturate(1.6) contrast(1.2)", background: "linear-gradient(135deg, #2D5E3E 0%, #C66A24 50%, #1B2A4A 100%)" },
  },
  sup_q11: {
    a: { filter: "brightness(1.05) contrast(1.1)", background: "linear-gradient(135deg, #ECEFF1 0%, #B0BEC5 50%, #CFD8DC 100%)" },
    b: { filter: "sepia(0.2) saturate(0.9) brightness(1.05)", background: "linear-gradient(135deg, #D7C4A9 0%, #A17858 50%, #C9A38A 100%)" },
    c: { filter: "contrast(1.4) brightness(0.85)", background: "linear-gradient(135deg, #1B2A4A 0%, #2D3E50 30%, #C66A24 100%)" },
    d: { filter: "saturate(0.7) contrast(1.3)", background: "linear-gradient(135deg, #5D4037 0%, #8D6E63 50%, #4E342E 100%)" },
  },
};

function ImageTreatmentPreview({ questionId, optionKey }: { questionId: string; optionKey: OptionKey }) {
  const style = IMAGE_TREATMENTS[questionId]?.[optionKey];
  if (!style) return null;
  return (
    <div
      style={{
        width: "100%",
        height: 48,
        borderRadius: 8,
        ...style,
        border: "1px solid rgba(253, 245, 230, 0.08)",
      }}
    />
  );
}

// ── Decade visual mood (s1_q11) ─────────────────────────────────────────────

const DECADE_MOODS: Record<OptionKey, { gradient: string; label: string; fontStyle: React.CSSProperties }> = {
  a: {
    gradient: "linear-gradient(135deg, #C2703E 0%, #8B7355 40%, #D4A934 100%)",
    label: "'70s",
    fontStyle: { fontFamily: "Georgia, serif", fontStyle: "italic", letterSpacing: "1px" },
  },
  b: {
    gradient: "linear-gradient(135deg, #1A1A1A 0%, #444 40%, #888 100%)",
    label: "'90s",
    fontStyle: { fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "-0.5px" },
  },
  c: {
    gradient: "linear-gradient(135deg, #F5F0E8 0%, #B0BEC5 40%, #E0E0E0 100%)",
    label: "'20s",
    fontStyle: { fontFamily: "Inter, system-ui, sans-serif", fontWeight: 300, letterSpacing: "3px" },
  },
  d: {
    gradient: "linear-gradient(135deg, #C2703E 0%, #1B2A4A 33%, #8B9E6B 66%, #C9A3A3 100%)",
    label: "Mix",
    fontStyle: { fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500, letterSpacing: "1.5px" },
  },
};

function DecadeMoodPreview({ optionKey }: { optionKey: OptionKey }) {
  const mood = DECADE_MOODS[optionKey];
  return (
    <div
      style={{
        width: "100%",
        height: 40,
        borderRadius: 8,
        background: mood.gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(253, 245, 230, 0.08)",
      }}
    >
      <span
        style={{
          fontSize: 14,
          color: optionKey === "c" ? "#333" : "rgba(253, 245, 230, 0.9)",
          textTransform: "uppercase",
          ...mood.fontStyle,
        }}
      >
        {mood.label}
      </span>
    </div>
  );
}

// ── Creative aesthetic (s4_q09) ─────────────────────────────────────────────

const AESTHETIC_STYLES: Record<OptionKey, { gradient: string; texture: string }> = {
  a: { gradient: "linear-gradient(135deg, #C2703E 0%, #D4A934 100%)", texture: "Album cover" },
  b: { gradient: "linear-gradient(135deg, #1A1A1A 0%, #333 100%)", texture: "Brutalist" },
  c: { gradient: "linear-gradient(135deg, #8B7355 0%, #A18B6E 100%)", texture: "Handmade" },
  d: { gradient: "linear-gradient(135deg, #2D3E50 0%, #6B8FA3 100%)", texture: "Motion" },
};

function AestheticPreview({ optionKey }: { optionKey: OptionKey }) {
  const style = AESTHETIC_STYLES[optionKey];
  return (
    <div
      style={{
        width: "100%",
        height: 40,
        borderRadius: 8,
        background: style.gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(253, 245, 230, 0.08)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontFamily: "var(--font-label)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "rgba(253, 245, 230, 0.7)",
        }}
      >
        {style.texture}
      </span>
    </div>
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

const VISUAL_QUESTIONS = new Set([
  "s1_q04", "s1_q07", "s1_q11", "s1_q16",
  "s4_q04", "s4_q09", "s4_q14",
  "sup_q04", "sup_q11",
]);

export function isVisualQuestion(questionId: string): boolean {
  return VISUAL_QUESTIONS.has(questionId);
}

export function getVisualPreview(
  questionId: string,
  optionKey: OptionKey,
  selected: boolean,
): React.ReactNode {
  switch (questionId) {
    case "s1_q07":
      return <TypefacePreview optionKey={optionKey} selected={selected} />;
    case "s1_q04":
    case "sup_q04":
      return <ColourPalettePreview questionId={questionId} optionKey={optionKey} />;
    case "s1_q11":
      return <DecadeMoodPreview optionKey={optionKey} />;
    case "s1_q16":
    case "sup_q11":
      return <ImageTreatmentPreview questionId={questionId} optionKey={optionKey} />;
    case "s4_q09":
      return <AestheticPreview optionKey={optionKey} />;
    default:
      return null;
  }
}
