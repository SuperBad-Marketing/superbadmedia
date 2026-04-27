"use client";

import React, { useState, useCallback } from "react";
import type { CustomPaletteInput as CustomPaletteColors } from "@/lib/content-studio/motion/types";

interface CustomPaletteInputProps {
  initial?: CustomPaletteColors;
  onChange: (colors: CustomPaletteColors) => void;
}

const FIELDS: { key: keyof CustomPaletteColors; label: string }[] = [
  { key: "background", label: "BG" },
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
  { key: "text", label: "Text" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function CustomPaletteInput({ initial, onChange }: CustomPaletteInputProps) {
  const [colors, setColors] = useState<CustomPaletteColors>(
    initial ?? {
      background: "#0F0F0E",
      primary: "#B22848",
      accent: "#F28C52",
      text: "#FDF5E6",
    },
  );

  const handleChange = useCallback(
    (key: keyof CustomPaletteColors, value: string) => {
      const next = { ...colors, [key]: value };
      setColors(next);
      const allValid = Object.values(next).every((v) => HEX_RE.test(v));
      if (allValid) onChange(next);
    },
    [colors, onChange],
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        flexWrap: "wrap",
        padding: "8px 0",
      }}
    >
      {FIELDS.map(({ key, label }) => {
        const val = colors[key];
        const valid = HEX_RE.test(val);
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 9,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "rgba(253,245,230,0.4)",
              }}
            >
              {label}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: valid ? val : "#333",
                  border: "1px solid rgba(253,245,230,0.15)",
                  flexShrink: 0,
                }}
              />
              <input
                type="text"
                value={val}
                onChange={(e) => handleChange(key, e.target.value)}
                maxLength={7}
                style={{
                  width: 80,
                  padding: "4px 6px",
                  borderRadius: 4,
                  border: valid
                    ? "1px solid rgba(253,245,230,0.1)"
                    : "1px solid rgba(178,40,72,0.6)",
                  background: "rgba(253,245,230,0.03)",
                  color: "var(--color-brand-cream)",
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
