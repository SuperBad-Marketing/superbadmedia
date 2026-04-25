import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useGradientPulse } from "./shared";

export const BtsCaptionMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 26 : isSquare ? 36 : 44;
  const pad = isLandscape ? "40px 60px" : "60px 48px";
  const gradientPulse = useGradientPulse();

  const brandFade = useFadeIn(0, 15);

  const blurAmount = interpolate(frame, [5, 30], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineProgress = spring({
    frame: frame - 35,
    fps,
    config: { mass: 1, stiffness: 220, damping: 25 },
  });
  const taglineX = interpolate(taglineProgress, [0, 1], [40, 0]);
  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1]);

  const footerFade = useFadeIn(55, 15);

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
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 16,
            letterSpacing: 4,
            textTransform: "uppercase" as const,
            color: palette.accent,
            marginBottom: isLandscape ? 20 : 32,
            opacity: brandFade,
          }}
        >
          Behind the scenes
        </div>

        <div
          style={{
            fontWeight: 400,
            fontSize: headlineFontSize,
            lineHeight: 1.5,
            color: palette.text,
            opacity: headlineOpacity,
            filter: `blur(${blurAmount}px)`,
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: palette.accent,
            marginTop: isLandscape ? 12 : 20,
            opacity: taglineOpacity,
            transform: `translateX(${taglineX}px)`,
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
