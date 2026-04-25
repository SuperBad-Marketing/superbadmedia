"use client";

import React from "react";
import type { ColourPalette } from "@/lib/content-studio/motion/types";

interface PaletteSwatchesProps {
  palettes: ColourPalette[];
  activePaletteId: string;
  onSelect: (palette: ColourPalette) => void;
}

export function PaletteSwatches({
  palettes,
  activePaletteId,
  onSelect,
}: PaletteSwatchesProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: "8px 0",
      }}
    >
      {palettes.map((palette) => {
        const isActive = palette.id === activePaletteId;
        return (
          <button
            key={palette.id}
            onClick={() => onSelect(palette)}
            title={palette.name}
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              border: isActive
                ? "2px solid var(--color-brand-cream)"
                : "2px solid transparent",
              borderRadius: 8,
              background: "transparent",
              cursor: "pointer",
              transition: "border-color 0.15s",
              opacity: isActive ? 1 : 0.7,
            }}
          >
            {[palette.background, palette.primary, palette.accent, palette.text].map(
              (color, i) => (
                <div
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: color,
                    border: "1px solid rgba(253,245,230,0.1)",
                  }}
                />
              ),
            )}
          </button>
        );
      })}
    </div>
  );
}
