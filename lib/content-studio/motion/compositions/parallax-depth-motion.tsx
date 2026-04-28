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
  FONT_BODY,
  FONT_LABEL,
  FONT_NARRATIVE,
} from "./motion-fonts";
import { GrainOverlay } from "./atmosphere";
import { useFadeIn } from "./shared";

export const ParallaxDepthMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
  fontPairingId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = getCanvasScale(width, height);

  const padX = Math.round(48 * s);
  const padY = Math.round(60 * s);

  const totalFrames = fps * 4;

  // Background layer — giant ghost text, slow drift
  const bgDrift = interpolate(frame, [0, totalFrames], [0, -30 * s], {
    extrapolateRight: "clamp",
  });
  const bgOpacity = interpolate(frame, [0, 20], [0, 0.06], {
    extrapolateRight: "clamp",
  });

  // Middle layer — headline, medium drift
  const midEntry = spring({
    frame: frame - 8,
    fps,
    config: { mass: 1.4, stiffness: 100, damping: 20 },
  });
  const midDrift = interpolate(frame, [0, totalFrames], [0, -18 * s], {
    extrapolateRight: "clamp",
  });
  const midOpacity = interpolate(midEntry, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Foreground layer — detail + tagline, fast drift
  const fgEntry = spring({
    frame: frame - 30,
    fps,
    config: { mass: 1.2, stiffness: 120, damping: 18 },
  });
  const fgDrift = interpolate(frame, [0, totalFrames], [0, -10 * s], {
    extrapolateRight: "clamp",
  });
  const fgOpacity = interpolate(fgEntry, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Accent line in middle layer
  const lineProgress = spring({
    frame: frame - 22,
    fps,
    config: { mass: 1, stiffness: 160, damping: 20 },
  });

  const footerFade = useFadeIn(fps * 2, 15);

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
            background: `radial-gradient(ellipse 80% 60% at 40% 35%, ${palette.primary}0C, transparent 65%)`,
            pointerEvents: "none",
          }}
        />
      )}

      <GrainOverlay opacity={0.025} />

      {/* Background layer — giant ghost headline */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: -Math.round(20 * s),
          right: -Math.round(20 * s),
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: Math.round(240 * s),
          lineHeight: 0.85,
          letterSpacing: -8,
          color: palette.text,
          opacity: bgOpacity,
          transform: `translateY(${bgDrift}px)`,
          pointerEvents: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {(copy.headline || "").toUpperCase()}
      </div>

      {/* Middle layer — headline */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: padX,
          right: padX,
          transform: `translateY(${midDrift}px)`,
          opacity: midOpacity,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: Math.round(84 * s),
            lineHeight: 0.95,
            letterSpacing: -2,
            color: palette.text,
            marginBottom: Math.round(16 * s),
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            width: Math.round(48 * s),
            height: 2,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.primary})`,
            transform: `scaleX(${lineProgress})`,
            transformOrigin: "left",
          }}
        />
      </div>

      {/* Foreground layer — detail + tagline */}
      <div
        style={{
          position: "absolute",
          bottom: padY + Math.round(60 * s),
          left: padX,
          right: padX,
          transform: `translateY(${fgDrift}px)`,
          opacity: fgOpacity,
          zIndex: 3,
        }}
      >
        {copy.detail && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 400,
              fontSize: Math.round(24 * s),
              lineHeight: 1.5,
              color: `${palette.text}BB`,
              maxWidth: "65%",
              marginBottom: Math.round(12 * s),
            }}
          >
            {copy.detail}
          </div>
        )}

        {copy.tagline && (
          <div
            style={{
              fontFamily: FONT_NARRATIVE,
              fontStyle: "italic",
              fontSize: Math.round(18 * s),
              color: palette.accent,
            }}
          >
            {copy.tagline}
          </div>
        )}
      </div>

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
          zIndex: 10,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};
