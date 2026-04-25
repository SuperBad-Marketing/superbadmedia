import React from "react";
import { AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useSlideUp, useGradientPulse } from "./shared";

export const TestimonialQuoteMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const quoteFontSize = isLandscape ? 28 : isSquare ? 40 : 48;
  const pad = isLandscape ? "40px 60px" : "60px 48px";
  const gradientPulse = useGradientPulse();

  const quoteMarkScale = spring({
    frame: frame - 5,
    fps,
    config: { mass: 0.8, stiffness: 250, damping: 20 },
  });
  const quoteMarkOpacity = interpolate(quoteMarkScale, [0, 1], [0, 1]);

  const quoteFade = useFadeIn(15, 20);
  const attribution = useSlideUp(45, 20);
  const subtextFade = useFadeIn(55, 15);
  const footerFade = useFadeIn(65, 15);

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
            opacity: useFadeIn(0, 15),
          }}
        >
          SuperBad
        </div>

        <div
          style={{
            fontWeight: 900,
            fontSize: quoteFontSize * 2,
            color: palette.primary,
            lineHeight: 0.5,
            marginBottom: 16,
            opacity: quoteMarkOpacity,
            transform: `scale(${quoteMarkScale})`,
          }}
        >
          {"“"}
        </div>

        <div
          style={{
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: quoteFontSize,
            lineHeight: 1.4,
            color: palette.text,
            marginBottom: isLandscape ? 16 : 24,
            opacity: quoteFade,
          }}
        >
          {copy.headline || ""}
        </div>

        <div
          style={{
            width: 48,
            height: 3,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.primary})`,
            margin: `0 auto ${isLandscape ? 12 : 16}px`,
            borderRadius: 2,
            opacity: quoteFade,
          }}
        />

        <div
          style={{
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 16,
            letterSpacing: 2,
            textTransform: "uppercase" as const,
            color: palette.accent,
            opacity: attribution.opacity,
            transform: `translateY(${attribution.translateY}px)`,
          }}
        >
          {copy.detail ? `— ${copy.detail}` : ""}
        </div>

        <div
          style={{
            fontWeight: 600,
            fontSize: isLandscape ? 14 : 16,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: "#8A8A80",
            marginTop: 8,
            opacity: subtextFade,
          }}
        >
          {copy.subtext || ""}
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
