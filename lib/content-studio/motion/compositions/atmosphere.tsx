import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ColourPalette } from "../types";

export const GrainOverlay: React.FC<{ opacity?: number }> = ({
  opacity = 0.035,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={`grain-${frame}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.7"
            numOctaves="3"
            seed={frame}
            stitchTiles="stitch"
          />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#grain-${frame})`}
        />
      </svg>
    </AbsoluteFill>
  );
};

const GRADIENT_POSITIONS: Record<string, string> = {
  "top-left": "30% 25%",
  center: "50% 40%",
  "top-right": "70% 25%",
  bottom: "50% 80%",
};

function hexAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

interface AtmosphereProps {
  palette: ColourPalette;
  transparent: boolean;
  grain?: boolean;
  grainOpacity?: number;
  gradientPosition?: keyof typeof GRADIENT_POSITIONS;
  gradientIntensity?: number;
  secondaryGradient?: boolean;
}

export const Atmosphere: React.FC<AtmosphereProps> = ({
  palette,
  transparent,
  grain = true,
  grainOpacity = 0.035,
  gradientPosition = "center",
  gradientIntensity = 0.25,
  secondaryGradient = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (transparent)
    return grain ? <GrainOverlay opacity={grainOpacity} /> : null;

  const pulse =
    Math.sin((frame / fps) * Math.PI * 0.6) * 0.06 + gradientIntensity;

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 80% 60% at ${GRADIENT_POSITIONS[gradientPosition]}, ${hexAlpha(palette.primary, pulse)}, transparent 65%)`,
        }}
      />
      {secondaryGradient && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse 60% 40% at 50% 90%, ${hexAlpha(palette.accent, pulse * 0.35)}, transparent 50%)`,
          }}
        />
      )}
      {grain && <GrainOverlay opacity={grainOpacity} />}
    </>
  );
};
