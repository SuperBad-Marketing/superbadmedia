import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { MotionTemplateProps } from "../types";
import { useFadeIn, useSlideUp, useScaleIn, useGradientPulse } from "./shared";

export const AnnouncementBoldMotion: React.FC<MotionTemplateProps> = ({
  copy,
  palette,
  transparent,
}) => {
  const { width } = useVideoConfig();
  const isLandscape = width > 1200;
  const isSquare = width === 1080;

  const headlineFontSize = isLandscape ? 56 : isSquare ? 80 : 96;
  const detailFontSize = isLandscape ? 36 : isSquare ? 48 : 56;
  const pad = isLandscape ? "40px 60px" : "60px 48px";

  const brandFade = useFadeIn(0, 15);
  const headline = useSlideUp(10, 40);
  const divider = useScaleIn(30);
  const detailFade = useFadeIn(40, 20);
  const subtextFade = useFadeIn(55, 15);
  const taglineFade = useFadeIn(65, 15);
  const footerFade = useFadeIn(75, 15);
  const gradientPulse = useGradientPulse();

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

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: pad,
          width: "100%",
        }}
      >
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
            fontWeight: 900,
            fontSize: detailFontSize,
            color: palette.primary,
            marginBottom: isLandscape ? 8 : 12,
            opacity: detailFade,
          }}
        >
          {copy.detail || ""}
        </div>

        <div
          style={{
            fontWeight: 600,
            fontSize: isLandscape ? 16 : 20,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: "#8A8A80",
            marginBottom: isLandscape ? 8 : 12,
            opacity: subtextFade,
          }}
        >
          {copy.subtext || ""}
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
