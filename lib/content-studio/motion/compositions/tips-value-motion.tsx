import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useSlideUp, useScaleIn, useGradientPulse } from "./shared";

export const TipsValueMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 56 : isSquare ? 80 : 96;
  const bodyFontSize = isLandscape ? 18 : 22;
  const pad = isLandscape ? "40px 60px" : "60px 48px";
  const gradientPulse = useGradientPulse();

  const brandFade = useFadeIn(0, 15);
  const headline = useSlideUp(8, 50);
  const divider = useScaleIn(30);
  const taglineFade = useFadeIn(65, 15);
  const footerFade = useFadeIn(75, 15);

  const detailText = copy.detail || "";
  const charsPerFrame = detailText.length / 30;
  const visibleChars = Math.min(
    detailText.length,
    Math.max(0, Math.floor((frame - 40) * charsPerFrame)),
  );
  const detailVisible = detailText.slice(0, visibleChars);
  const detailOpacity = interpolate(frame, [40, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
            color: palette.primary,
            marginBottom: isLandscape ? 20 : 32,
            opacity: brandFade,
          }}
        >
          SuperBad
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: headlineFontSize,
            lineHeight: 0.95,
            letterSpacing: -2,
            marginBottom: isLandscape ? 16 : 24,
            color: palette.text,
            opacity: headline.opacity,
            transform: `translateY(${headline.translateY}px)`,
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            width: 48,
            height: 3,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.primary})`,
            margin: `0 auto ${isLandscape ? 16 : 24}px`,
            borderRadius: 2,
            opacity: divider.opacity,
            transform: `scaleX(${divider.scaleX})`,
          }}
        />

        <div
          style={{
            fontSize: bodyFontSize,
            lineHeight: 1.6,
            color: palette.text,
            opacity: detailOpacity,
          }}
        >
          {detailVisible}
          {visibleChars < detailText.length && (
            <span style={{ opacity: interpolate(frame % 20, [0, 10, 20], [1, 0.3, 1]) }}>|</span>
          )}
        </div>

        <div
          style={{
            fontStyle: "italic",
            fontSize: isLandscape ? 16 : 20,
            color: palette.accent,
            marginTop: isLandscape ? 12 : 20,
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
