import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MotionTemplateProps } from "../types";
import { getCanvasScale } from "../layouts";
import {
  MotionFonts,
  FONT_DISPLAY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { GrainOverlay } from "./atmosphere";
import { useFadeIn } from "./shared";

export const ChromaticPulseMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const headlineSize = Math.round(100 * s);
  const padX = Math.round(56 * s);
  const padY = Math.round(56 * s);

  // Entry: scale from slightly larger
  const entryProgress = spring({
    frame,
    fps,
    config: { mass: 0.8, stiffness: 200, damping: 14 },
  });
  const entryScale = interpolate(entryProgress, [0, 1], [1.06, 1]);
  const entryOpacity = interpolate(entryProgress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Chromatic split: starts wide, collapses to zero
  const splitPhase = interpolate(frame, [0, fps * 1.5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const maxOffset = Math.round(15 * s);
  const redOffset = splitPhase * maxOffset;
  const cyanOffset = splitPhase * -maxOffset;

  // Pulse: after collapse, subtle periodic pulse
  const settled = frame > fps * 1.5;
  const pulseOffset = settled
    ? Math.sin(((frame - fps * 1.5) / fps) * Math.PI * 2) * 2 * s
    : 0;

  const taglineFade = useFadeIn(fps * 1.2, 15);
  const footerFade = useFadeIn(fps * 1.8, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        color: palette.text,
        overflow: "hidden",
      }}
    >
      <MotionFonts fontPairingId={fontPairingId} />

      {!transparent && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${palette.primary}0A, transparent 65%)`,
            pointerEvents: "none",
          }}
        />
      )}

      <GrainOverlay opacity={0.03} />

      {/* Red channel */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: padX,
          right: padX,
          transform: `translateY(-50%) translateX(${redOffset + pulseOffset}px) scale(${entryScale})`,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: headlineSize,
          lineHeight: 0.95,
          letterSpacing: -3,
          color: "#FF000060",
          mixBlendMode: "screen",
          opacity: entryOpacity,
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        {copy.headline || ""}
      </div>

      {/* Green channel */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: padX,
          right: padX,
          transform: `translateY(-50%) translateX(${-pulseOffset * 0.5}px) scale(${entryScale})`,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: headlineSize,
          lineHeight: 0.95,
          letterSpacing: -3,
          color: "#00FF0035",
          mixBlendMode: "screen",
          opacity: entryOpacity,
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        {copy.headline || ""}
      </div>

      {/* Blue/Cyan channel */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: padX,
          right: padX,
          transform: `translateY(-50%) translateX(${cyanOffset - pulseOffset}px) scale(${entryScale})`,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: headlineSize,
          lineHeight: 0.95,
          letterSpacing: -3,
          color: "#0088FF50",
          mixBlendMode: "screen",
          opacity: entryOpacity,
          pointerEvents: "none",
          textAlign: "center",
        }}
      >
        {copy.headline || ""}
      </div>

      {/* Main headline — appears as channels converge */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: padX,
          right: padX,
          transform: `translateY(-50%) scale(${entryScale})`,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: headlineSize,
          lineHeight: 0.95,
          letterSpacing: -3,
          color: palette.text,
          opacity: interpolate(splitPhase, [0.3, 0], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          textAlign: "center",
          zIndex: 2,
        }}
      >
        {copy.headline || ""}
      </div>

      {copy.tagline && (
        <div
          style={{
            position: "absolute",
            bottom: padY + Math.round(28 * s),
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_NARRATIVE,
            fontStyle: "italic",
            fontSize: Math.round(18 * s),
            color: palette.accent,
            opacity: taglineFade,
            zIndex: 3,
          }}
        >
          {copy.tagline}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: padY,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: Math.round(12 * s),
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}30`,
          opacity: footerFade,
          zIndex: 3,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};
