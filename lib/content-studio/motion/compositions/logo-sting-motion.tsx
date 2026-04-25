import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useGradientPulse } from "./shared";

export const LogoStingMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const logoFontSize = isLandscape ? 72 : isSquare ? 96 : 120;
  const gradientPulse = useGradientPulse();

  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: { mass: 1.5, stiffness: 140, damping: 18 },
  });
  const logoOpacity = interpolate(logoScale, [0, 1], [0, 1]);
  const logoBlur = interpolate(frame, [5, 20], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const underlineProgress = spring({
    frame: frame - 25,
    fps,
    config: { mass: 1, stiffness: 250, damping: 30 },
  });

  const taglineProgress = spring({
    frame: frame - 35,
    fps,
    config: { mass: 1, stiffness: 220, damping: 25 },
  });
  const taglineY = interpolate(taglineProgress, [0, 1], [20, 0]);
  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : palette.background,
        fontFamily: "'Inter', sans-serif",
        color: palette.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {!transparent && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${palette.primary}${Math.round(gradientPulse * 255).toString(16).padStart(2, "0")}, transparent 70%)`,
          }}
        />
      )}

      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: logoFontSize,
            letterSpacing: -3,
            color: palette.text,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            filter: `blur(${logoBlur}px)`,
          }}
        >
          {copy.logo || "SuperBad"}
        </div>

        <div
          style={{
            width: isLandscape ? 200 : 250,
            height: 3,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.primary})`,
            margin: "0 auto",
            borderRadius: 2,
            transform: `scaleX(${underlineProgress})`,
            transformOrigin: "center",
          }}
        />

        <div
          style={{
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 18,
            letterSpacing: 6,
            textTransform: "uppercase" as const,
            color: palette.accent,
            marginTop: isLandscape ? 16 : 24,
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          {copy.tagline || ""}
        </div>
      </div>
    </AbsoluteFill>
  );
};
