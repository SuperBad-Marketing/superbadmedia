import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useGradientPulse } from "./shared";

export const AntiMotivationTypographyMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 56 : isSquare ? 80 : 96;
  const pad = isLandscape ? "40px 60px" : "60px 48px";
  const gradientPulse = useGradientPulse();

  const headlineProgress = spring({
    frame: frame - 5,
    fps,
    config: { mass: 1.2, stiffness: 180, damping: 22 },
  });
  const headlineY = interpolate(headlineProgress, [0, 1], [60, 0]);
  const headlineOpacity = interpolate(headlineProgress, [0, 1], [0, 1]);

  const letterSpacing = interpolate(
    frame,
    [30, 50, 70, 90],
    [-3, -1, -3, -1],
    { extrapolateLeft: "clamp", extrapolateRight: "extend" },
  );

  const dividerFade = useFadeIn(35, 15);
  const taglineFade = useFadeIn(45, 20);
  const footerFade = useFadeIn(60, 15);

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
            background: `radial-gradient(ellipse 70% 50% at 50% 30%, ${palette.primary}${Math.round(gradientPulse * 255).toString(16).padStart(2, "0")}, transparent 60%)`,
          }}
        />
      )}

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: pad, width: "100%" }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: headlineFontSize,
            lineHeight: 0.95,
            letterSpacing,
            color: palette.text,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            width: 48,
            height: 3,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.primary})`,
            margin: `${isLandscape ? 16 : 24}px auto`,
            borderRadius: 2,
            opacity: dividerFade,
          }}
        />

        <div
          style={{
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: palette.accent,
            opacity: taglineFade,
          }}
        >
          {copy.tagline || ""}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: isLandscape ? 20 : 40,
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          color: `${palette.text}40`,
          opacity: footerFade,
        }}
      >
        superbadmedia.com.au
      </div>
    </AbsoluteFill>
  );
};
