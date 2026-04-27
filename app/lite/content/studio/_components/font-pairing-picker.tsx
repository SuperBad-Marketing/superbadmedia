"use client";

import React from "react";
import { FONT_PAIRINGS, type FontPairing } from "@/lib/content-studio/font-pairings";

interface FontPairingPickerProps {
  activePairingId: string | null;
  onSelect: (id: string) => void;
}

const FONT_PREVIEW_STYLE: Record<string, React.CSSProperties> = {
  house: { fontFamily: "'Black Han Sans', sans-serif", fontWeight: 400 },
  editorial: { fontFamily: "'Playfair Display', serif", fontWeight: 700 },
  dispatch: { fontFamily: "'DM Serif Display', serif", fontWeight: 400 },
  modern: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 },
  statement: { fontFamily: "'Black Han Sans', sans-serif", fontWeight: 400 },
  classic: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
  minimal: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
  bold: { fontFamily: "'Righteous', sans-serif", fontWeight: 400 },
};

export function FontPairingPicker({
  activePairingId,
  onSelect,
}: FontPairingPickerProps) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(253,245,230,0.4)",
          marginBottom: 6,
        }}
      >
        Font
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FONT_PAIRINGS.map((pairing) => {
          const isActive = pairing.id === activePairingId;
          return (
            <button
              key={pairing.id}
              onClick={() => onSelect(pairing.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: isActive
                  ? "2px solid var(--color-brand-cream)"
                  : "2px solid transparent",
                background: isActive
                  ? "rgba(253,245,230,0.08)"
                  : "rgba(253,245,230,0.03)",
                color: "var(--color-brand-cream)",
                cursor: "pointer",
                transition: "all 0.15s",
                opacity: isActive ? 1 : 0.7,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minWidth: 72,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  lineHeight: 1.1,
                  ...FONT_PREVIEW_STYLE[pairing.id],
                }}
              >
                Aa
              </span>
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 9,
                  letterSpacing: 0.5,
                  color: "rgba(253,245,230,0.5)",
                  textTransform: "uppercase",
                }}
              >
                {pairing.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
